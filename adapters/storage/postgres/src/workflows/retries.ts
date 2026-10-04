import {
  PlatformError,
  toInstant,
  type Instant,
  type TaskId,
  type TenantId,
} from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export type PersistedRetryDisposition =
  | {
      readonly kind: "retry-scheduled";
      readonly failureCount: number;
      readonly delayMs: number;
      readonly reasonCode: string;
    }
  | {
      readonly kind: "dead-letter";
      readonly failureCount: number;
      readonly reasonCode: string;
    }
  | {
      readonly kind: "needs-attention";
      readonly failureCount: number;
      readonly reasonCode: string;
    };

export interface WorkflowTaskRetryState {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly failureCount: number;
  readonly disposition:
    | "retry-scheduled"
    | "ready"
    | "dead-letter"
    | "needs-attention";
  readonly reasonCode: string;
  readonly safeErrorCode: string;
  readonly safeErrorMessage: string;
  readonly nextAttemptAt: Instant | null;
  readonly lastFailureAt: Instant;
  readonly updatedAt: Instant;
}

interface RetryRow {
  tenant_id: TenantId;
  task_id: TaskId;
  failure_count: number;
  disposition: WorkflowTaskRetryState["disposition"];
  reason_code: string;
  safe_error_code: string;
  safe_error_message: string;
  next_attempt_at: Date | null;
  last_failure_at: Date;
  updated_at: Date;
}

function retryState(row: RetryRow): WorkflowTaskRetryState {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    failureCount: row.failure_count,
    disposition: row.disposition,
    reasonCode: row.reason_code,
    safeErrorCode: row.safe_error_code,
    safeErrorMessage: row.safe_error_message,
    nextAttemptAt: row.next_attempt_at ? toInstant(row.next_attempt_at) : null,
    lastFailureAt: toInstant(row.last_failure_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(`${name} must be non-empty and no longer than ${max} characters`);
  }
  return value;
}

function assertFence(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("leaseFence must be a positive safe integer");
  }
}

function assertFailureCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError("failureCount must be an integer between 1 and 100");
  }
}

export async function readWorkflowTaskRetryState(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly taskId: TaskId;
  },
): Promise<WorkflowTaskRetryState | null> {
  const result = await pool.query<RetryRow>(
    `SELECT tenant_id, task_id, failure_count, disposition, reason_code,
            safe_error_code, safe_error_message, next_attempt_at,
            last_failure_at, updated_at
       FROM workflows.task_retry_state
      WHERE tenant_id = $1 AND task_id = $2`,
    [input.tenantId, input.taskId],
  );
  return result.rows[0] ? retryState(result.rows[0]) : null;
}

export async function recordWorkflowTaskFailure(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly taskId: TaskId;
    readonly workerId: string;
    readonly leaseFence: number;
    readonly at: Instant;
    readonly safeErrorCode: string;
    readonly safeErrorMessage: string;
    readonly disposition: PersistedRetryDisposition;
  },
): Promise<WorkflowTaskRetryState> {
  if (!input.workerId.trim()) {
    throw new TypeError("workerId is required");
  }
  assertFence(input.leaseFence);
  assertFailureCount(input.disposition.failureCount);

  const safeErrorCode = bounded(input.safeErrorCode, "safeErrorCode", 160);
  const safeErrorMessage =
    input.safeErrorMessage.length > 2_000
      ? input.safeErrorMessage.slice(0, 2_000)
      : input.safeErrorMessage;
  const reasonCode = bounded(input.disposition.reasonCode, "reasonCode", 160);

  let nextAttemptAt: Instant | null = null;
  if (input.disposition.kind === "retry-scheduled") {
    if (
      !Number.isSafeInteger(input.disposition.delayMs) ||
      input.disposition.delayMs < 1 ||
      input.disposition.delayMs > 7 * 24 * 60 * 60 * 1000
    ) {
      throw new RangeError("retry delayMs must be between 1 and 604800000");
    }
    nextAttemptAt = toInstant(
      new Date(new Date(input.at).getTime() + input.disposition.delayMs),
    );
  }

  return withTransaction(pool, async (client) => {
    const task = await client.query(
      `SELECT 1
         FROM workflows.tasks
        WHERE tenant_id = $1
          AND task_id = $2
          AND state = 'running'
          AND lease_owner = $3
          AND lease_fence = $4
          AND lease_expires_at > $5::timestamptz
          AND started_at <= $5::timestamptz
        FOR UPDATE`,
      [
        input.tenantId,
        input.taskId,
        input.workerId,
        input.leaseFence,
        input.at,
      ],
    );
    if (task.rowCount !== 1) {
      throw new PlatformError({
        code: "workflows.task_stale_lease",
        category: "conflict",
        message: "Workflow Task lease is no longer current",
        retryable: false,
      });
    }

    const currentRetry = await client.query<{ failure_count: number }>(
      `SELECT failure_count
         FROM workflows.task_retry_state
        WHERE tenant_id = $1 AND task_id = $2
        FOR UPDATE`,
      [input.tenantId, input.taskId],
    );
    const expectedFailureCount =
      (currentRetry.rows[0]?.failure_count ?? 0) + 1;
    if (input.disposition.failureCount !== expectedFailureCount) {
      throw new PlatformError({
        code: "workflows.task_retry_count_conflict",
        category: "conflict",
        message: "Workflow Task failure count is stale",
        retryable: false,
      });
    }

    if (input.disposition.kind === "retry-scheduled") {
      await client.query(
        `UPDATE workflows.tasks
            SET state = 'waiting',
                revision = revision + 1,
                updated_at = $5,
                terminal_at = NULL,
                wait_reason = 'retry_backoff',
                failure_code = NULL,
                failure_message = NULL,
                cancellation_reason = NULL,
                lease_owner = NULL,
                leased_at = NULL,
                lease_expires_at = NULL,
                heartbeat_at = NULL
          WHERE tenant_id = $1
            AND task_id = $2
            AND lease_owner = $3
            AND lease_fence = $4`,
        [
          input.tenantId,
          input.taskId,
          input.workerId,
          input.leaseFence,
          input.at,
        ],
      );
    } else {
      await client.query(
        `UPDATE workflows.tasks
            SET state = 'failed',
                revision = revision + 1,
                updated_at = $5,
                terminal_at = $5,
                wait_reason = NULL,
                failure_code = $6,
                failure_message = $7,
                cancellation_reason = NULL,
                lease_owner = NULL,
                leased_at = NULL,
                lease_expires_at = NULL,
                heartbeat_at = NULL
          WHERE tenant_id = $1
            AND task_id = $2
            AND lease_owner = $3
            AND lease_fence = $4`,
        [
          input.tenantId,
          input.taskId,
          input.workerId,
          input.leaseFence,
          input.at,
          safeErrorCode,
          safeErrorMessage,
        ],
      );
    }

    const persisted = await client.query<RetryRow>(
      `INSERT INTO workflows.task_retry_state (
         tenant_id, task_id, failure_count, disposition, reason_code,
         safe_error_code, safe_error_message, next_attempt_at,
         last_failure_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       ON CONFLICT (tenant_id, task_id)
       DO UPDATE SET
         failure_count = EXCLUDED.failure_count,
         disposition = EXCLUDED.disposition,
         reason_code = EXCLUDED.reason_code,
         safe_error_code = EXCLUDED.safe_error_code,
         safe_error_message = EXCLUDED.safe_error_message,
         next_attempt_at = EXCLUDED.next_attempt_at,
         last_failure_at = EXCLUDED.last_failure_at,
         updated_at = EXCLUDED.updated_at
       RETURNING tenant_id, task_id, failure_count, disposition, reason_code,
                 safe_error_code, safe_error_message, next_attempt_at,
                 last_failure_at, updated_at`,
      [
        input.tenantId,
        input.taskId,
        input.disposition.failureCount,
        input.disposition.kind,
        reasonCode,
        safeErrorCode,
        safeErrorMessage,
        nextAttemptAt,
        input.at,
      ],
    );

    return retryState(persisted.rows[0]!);
  });
}

export async function releaseDueWorkflowTaskRetries(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly limit: number;
  },
): Promise<readonly TaskId[]> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }

  return withTransaction(pool, async (client) => {
    const candidates = await client.query<{ task_id: TaskId }>(
      `SELECT r.task_id
         FROM workflows.task_retry_state AS r
         JOIN workflows.tasks AS t
           ON t.tenant_id = r.tenant_id
          AND t.task_id = r.task_id
        WHERE r.tenant_id = $1
          AND r.disposition = 'retry-scheduled'
          AND r.next_attempt_at <= clock_timestamp()
          AND t.state = 'waiting'
          AND t.wait_reason = 'retry_backoff'
        ORDER BY r.next_attempt_at, r.task_id
        FOR UPDATE OF r, t SKIP LOCKED
        LIMIT $2`,
      [input.tenantId, input.limit],
    );

    const taskIds = candidates.rows.map((row) => row.task_id);
    if (taskIds.length === 0) {
      return Object.freeze([]);
    }

    await client.query(
      `UPDATE workflows.tasks
          SET state = 'ready',
              revision = revision + 1,
              updated_at = clock_timestamp(),
              wait_reason = NULL
        WHERE tenant_id = $1
          AND task_id = ANY($2::text[])`,
      [input.tenantId, taskIds],
    );

    await client.query(
      `UPDATE workflows.task_retry_state
          SET disposition = 'ready',
              next_attempt_at = NULL,
              updated_at = clock_timestamp()
        WHERE tenant_id = $1
          AND task_id = ANY($2::text[])`,
      [input.tenantId, taskIds],
    );

    return Object.freeze(taskIds);
  });
}

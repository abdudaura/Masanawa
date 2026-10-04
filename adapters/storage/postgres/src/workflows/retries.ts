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
  | "retry-scheduled"
  | "retry-ready"
  | "dead-letter"
  | "needs-attention";

export interface PersistedTaskRetryState {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly policyKey: string;
  readonly policyVersion: number;
  readonly maxAttempts: number;
  readonly completedAttempts: number;
  readonly disposition: PersistedRetryDisposition;
  readonly nextAttemptAt: Instant | null;
  readonly lastFailureCode: string;
  readonly lastFailureMessage: string;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export type PersistRetryDecision =
  | {
      readonly disposition: "retry-scheduled";
      readonly delayMs: number;
    }
  | {
      readonly disposition: "dead-letter" | "needs-attention";
      readonly delayMs: null;
    };

export interface RecordWorkflowTaskFailureInput {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workerId: string;
  readonly leaseFence: number;
  readonly policyKey: string;
  readonly policyVersion: number;
  readonly maxAttempts: number;
  readonly completedAttempts: number;
  readonly decision: PersistRetryDecision;
  readonly failure: Readonly<{ code: string; message: string }>;
  readonly at: Instant;
}

interface RetryRow {
  tenant_id: TenantId;
  task_id: TaskId;
  policy_key: string;
  policy_version: number;
  max_attempts: number;
  completed_attempts: number;
  disposition: PersistedRetryDisposition;
  next_attempt_at: Date | null;
  last_failure_code: string;
  last_failure_message: string;
  revision: string;
  created_at: Date;
  updated_at: Date;
}

function retryState(row: RetryRow): PersistedTaskRetryState {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    policyKey: row.policy_key,
    policyVersion: row.policy_version,
    maxAttempts: row.max_attempts,
    completedAttempts: row.completed_attempts,
    disposition: row.disposition,
    nextAttemptAt: row.next_attempt_at ? toInstant(row.next_attempt_at) : null,
    lastFailureCode: row.last_failure_code,
    lastFailureMessage: row.last_failure_message,
    revision: Number(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(`${name} must be non-empty and no longer than ${max} characters`);
  }
  return value;
}

function assertInput(input: RecordWorkflowTaskFailureInput): void {
  bounded(input.workerId, "workerId", 200);
  bounded(input.policyKey, "policyKey", 96);
  bounded(input.failure.code, "failure.code", 160);
  if (input.failure.message.length > 2_000) {
    throw new TypeError("failure.message must be no longer than 2000 characters");
  }
  if (!Number.isSafeInteger(input.leaseFence) || input.leaseFence < 1) {
    throw new RangeError("leaseFence must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.policyVersion) || input.policyVersion < 1) {
    throw new RangeError("policyVersion must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 20
  ) {
    throw new RangeError("maxAttempts must be between 1 and 20");
  }
  if (
    !Number.isSafeInteger(input.completedAttempts) ||
    input.completedAttempts < 1 ||
    input.completedAttempts > input.maxAttempts
  ) {
    throw new RangeError("completedAttempts is outside the retry policy range");
  }
  if (input.decision.disposition === "retry-scheduled") {
    if (
      !Number.isSafeInteger(input.decision.delayMs) ||
      input.decision.delayMs < 100 ||
      input.decision.delayMs > 604_800_000
    ) {
      throw new RangeError("retry delayMs is outside the supported range");
    }
    if (input.completedAttempts >= input.maxAttempts) {
      throw new TypeError("retry cannot be scheduled after maxAttempts is reached");
    }
  }
}

export async function recordWorkflowTaskFailure(
  pool: Pool,
  input: RecordWorkflowTaskFailureInput,
): Promise<PersistedTaskRetryState> {
  assertInput(input);

  return withTransaction(pool, async (client) => {
    const prior = await client.query<RetryRow>(
      `SELECT tenant_id, task_id, policy_key, policy_version, max_attempts,
              completed_attempts, disposition, next_attempt_at,
              last_failure_code, last_failure_message, revision::text,
              created_at, updated_at
         FROM workflows.task_retry_state
        WHERE tenant_id = $1 AND task_id = $2
        FOR UPDATE`,
      [input.tenantId, input.taskId],
    );
    const previous = prior.rows[0];

    if (previous) {
      if (
        previous.policy_key !== input.policyKey ||
        previous.policy_version !== input.policyVersion ||
        previous.max_attempts !== input.maxAttempts
      ) {
        throw new PlatformError({
          code: "workflows.retry_policy_conflict",
          category: "conflict",
          message: "Workflow Task retry policy changed during an active retry sequence",
          retryable: false,
        });
      }
      if (input.completedAttempts !== previous.completed_attempts + 1) {
        throw new PlatformError({
          code: "workflows.retry_attempt_conflict",
          category: "conflict",
          message: "Workflow Task retry attempt sequence is stale or non-contiguous",
          retryable: false,
        });
      }
    } else if (input.completedAttempts !== 1) {
      throw new PlatformError({
        code: "workflows.retry_attempt_conflict",
        category: "conflict",
        message: "First Workflow Task retry decision must record completed attempt 1",
        retryable: false,
      });
    }

    const nextAttemptAt =
      input.decision.disposition === "retry-scheduled"
        ? toInstant(
            new Date(
              new Date(input.at).getTime() + input.decision.delayMs,
            ),
          )
        : null;
    const taskState =
      input.decision.disposition === "dead-letter" ? "failed" : "waiting";
    const waitReason =
      input.decision.disposition === "retry-scheduled"
        ? "retry_scheduled"
        : input.decision.disposition === "needs-attention"
          ? "needs_attention"
          : null;
    const terminalAt =
      input.decision.disposition === "dead-letter" ? input.at : null;
    const failureCode =
      input.decision.disposition === "dead-letter" ? input.failure.code : null;
    const failureMessage =
      input.decision.disposition === "dead-letter"
        ? input.failure.message
        : null;

    const taskUpdate = await client.query(
      `UPDATE workflows.tasks
          SET state = $5,
              revision = revision + 1,
              updated_at = $6,
              terminal_at = $7,
              wait_reason = $8,
              failure_code = $9,
              failure_message = $10,
              cancellation_reason = NULL,
              lease_owner = NULL,
              leased_at = NULL,
              heartbeat_at = NULL,
              lease_expires_at = NULL
        WHERE tenant_id = $1
          AND task_id = $2
          AND state = 'running'
          AND lease_owner = $3
          AND lease_fence = $4
          AND started_at <= $6::timestamptz
          AND lease_expires_at > $6::timestamptz`,
      [
        input.tenantId,
        input.taskId,
        input.workerId,
        input.leaseFence,
        taskState,
        input.at,
        terminalAt,
        waitReason,
        failureCode,
        failureMessage,
      ],
    );

    if (taskUpdate.rowCount !== 1) {
      throw new PlatformError({
        code: "workflows.task_stale_lease",
        category: "conflict",
        message: "Workflow Task lease is no longer current",
        retryable: false,
      });
    }

    const result = await client.query<RetryRow>(
      `INSERT INTO workflows.task_retry_state (
         tenant_id, task_id, policy_key, policy_version, max_attempts,
         completed_attempts, disposition, next_attempt_at,
         last_failure_code, last_failure_message, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tenant_id, task_id)
       DO UPDATE SET
         completed_attempts = EXCLUDED.completed_attempts,
         disposition = EXCLUDED.disposition,
         next_attempt_at = EXCLUDED.next_attempt_at,
         last_failure_code = EXCLUDED.last_failure_code,
         last_failure_message = EXCLUDED.last_failure_message,
         revision = workflows.task_retry_state.revision + 1,
         updated_at = EXCLUDED.updated_at
       RETURNING tenant_id, task_id, policy_key, policy_version, max_attempts,
                 completed_attempts, disposition, next_attempt_at,
                 last_failure_code, last_failure_message, revision::text,
                 created_at, updated_at`,
      [
        input.tenantId,
        input.taskId,
        input.policyKey,
        input.policyVersion,
        input.maxAttempts,
        input.completedAttempts,
        input.decision.disposition,
        nextAttemptAt,
        input.failure.code,
        input.failure.message,
        input.at,
      ],
    );

    return retryState(result.rows[0]!);
  });
}

export interface PromotedWorkflowTaskRetry {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly completedAttempts: number;
  readonly retryRevision: number;
}

export async function promoteDueWorkflowTaskRetries(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly limit: number;
    readonly at: Instant;
  },
): Promise<readonly PromotedWorkflowTaskRetry[]> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<{
      tenant_id: TenantId;
      task_id: TaskId;
      completed_attempts: number;
      revision: string;
    }>(
      `WITH candidates AS (
         SELECT r.tenant_id, r.task_id
           FROM workflows.task_retry_state AS r
           JOIN workflows.tasks AS t
             ON t.tenant_id = r.tenant_id
            AND t.task_id = r.task_id
          WHERE r.tenant_id = $1
            AND r.disposition = 'retry-scheduled'
            AND r.next_attempt_at <= $2::timestamptz
            AND t.state = 'waiting'
            AND t.wait_reason = 'retry_scheduled'
          ORDER BY r.next_attempt_at, r.task_id
          FOR UPDATE OF r, t SKIP LOCKED
          LIMIT $3
       ),
       promoted_tasks AS (
         UPDATE workflows.tasks AS t
            SET state = 'ready',
                revision = t.revision + 1,
                updated_at = $2,
                wait_reason = NULL
           FROM candidates
          WHERE t.tenant_id = candidates.tenant_id
            AND t.task_id = candidates.task_id
         RETURNING t.tenant_id, t.task_id
       )
       UPDATE workflows.task_retry_state AS r
          SET disposition = 'retry-ready',
              next_attempt_at = NULL,
              revision = r.revision + 1,
              updated_at = $2
         FROM promoted_tasks
        WHERE r.tenant_id = promoted_tasks.tenant_id
          AND r.task_id = promoted_tasks.task_id
       RETURNING r.tenant_id, r.task_id, r.completed_attempts, r.revision::text`,
      [input.tenantId, input.at, input.limit],
    );

    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          tenantId: row.tenant_id,
          taskId: row.task_id,
          completedAttempts: row.completed_attempts,
          retryRevision: Number(row.revision),
        }),
      ),
    );
  });
}

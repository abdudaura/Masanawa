import {
  PlatformError,
  toInstant,
  type Instant,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export interface LeasedWorkflowTask {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly nodeKey: string;
  readonly state: "running";
  readonly revision: number;
  readonly leaseOwner: string;
  readonly leaseFence: number;
  readonly leasedAt: Instant;
  readonly leaseExpiresAt: Instant;
}

interface LeaseRow {
  tenant_id: TenantId;
  task_id: TaskId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  node_key: string;
  state: "running";
  revision: string;
  lease_owner: string;
  lease_fence: string;
  leased_at: Date;
  lease_expires_at: Date;
}

function leasedTask(row: LeaseRow): LeasedWorkflowTask {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    nodeKey: row.node_key,
    state: "running",
    revision: Number(row.revision),
    leaseOwner: row.lease_owner,
    leaseFence: Number(row.lease_fence),
    leasedAt: toInstant(row.leased_at),
    leaseExpiresAt: toInstant(row.lease_expires_at),
  });
}

function assertWorkerId(workerId: string): void {
  if (!workerId.trim() || workerId.length > 200) {
    throw new TypeError("workerId must be a non-empty string no longer than 200 characters");
  }
}

function assertLeaseMs(leaseMs: number): void {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0 || leaseMs > 86_400_000) {
    throw new RangeError("leaseMs must be a positive safe integer no greater than 86400000");
  }
}

export async function checkoutWorkflowTasks(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  },
): Promise<readonly LeasedWorkflowTask[]> {
  assertWorkerId(input.workerId);
  assertLeaseMs(input.leaseMs);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<LeaseRow>(
      `WITH candidates AS (
         SELECT tenant_id, task_id
           FROM workflows.tasks
          WHERE tenant_id = $1
            AND state = 'ready'
            AND lease_owner IS NULL
          ORDER BY created_at, task_id
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE workflows.tasks AS t
          SET state = 'running',
              revision = t.revision + 1,
              started_at = COALESCE(t.started_at, clock_timestamp()),
              updated_at = clock_timestamp(),
              lease_owner = $3,
              lease_fence = t.lease_fence + 1,
              leased_at = clock_timestamp(),
              lease_expires_at =
                clock_timestamp() + ($4::bigint * interval '1 millisecond')
         FROM candidates
        WHERE t.tenant_id = candidates.tenant_id
          AND t.task_id = candidates.task_id
       RETURNING
         t.tenant_id,
         t.task_id,
         t.workflow_run_id,
         t.workflow_version_id,
         t.graph_signature,
         t.node_key,
         t.state,
         t.revision::text,
         t.lease_owner,
         t.lease_fence::text,
         t.leased_at,
         t.lease_expires_at`,
      [input.tenantId, input.limit, input.workerId, input.leaseMs],
    );

    return Object.freeze(result.rows.map(leasedTask));
  });
}

export type FencedTaskSettlement =
  | {
      readonly state: "completed";
    }
  | {
      readonly state: "failed";
      readonly failure: Readonly<{ code: string; message: string }>;
    }
  | {
      readonly state: "waiting";
      readonly waitReason: string;
    }
  | {
      readonly state: "cancelled";
      readonly cancellationReason: string;
    };

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(`${name} must be non-empty and no longer than ${max} characters`);
  }
  return value;
}

export async function settleWorkflowTaskLease(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly taskId: TaskId;
    readonly workerId: string;
    readonly leaseFence: number;
    readonly settlement: FencedTaskSettlement;
    readonly at: Instant;
  },
): Promise<void> {
  assertWorkerId(input.workerId);
  if (!Number.isSafeInteger(input.leaseFence) || input.leaseFence < 1) {
    throw new RangeError("leaseFence must be a positive safe integer");
  }

  const state = input.settlement.state;
  const waitReason =
    state === "waiting"
      ? bounded(input.settlement.waitReason, "waitReason", 500)
      : null;
  const failureCode =
    state === "failed"
      ? bounded(input.settlement.failure.code, "failure.code", 160)
      : null;
  const failureMessage =
    state === "failed"
      ? input.settlement.failure.message.slice(0, 2_000)
      : null;
  const cancellationReason =
    state === "cancelled"
      ? bounded(input.settlement.cancellationReason, "cancellationReason", 500)
      : null;
  const terminalAt =
    state === "completed" || state === "failed" || state === "cancelled"
      ? input.at
      : null;

  const result = await client.query(
    `UPDATE workflows.tasks
        SET state = $5,
            revision = revision + 1,
            updated_at = $6,
            terminal_at = $7,
            wait_reason = $8,
            failure_code = $9,
            failure_message = $10,
            cancellation_reason = $11,
            lease_owner = NULL,
            leased_at = NULL,
            lease_expires_at = NULL
      WHERE tenant_id = $1
        AND task_id = $2
        AND state = 'running'
        AND lease_owner = $3
        AND lease_fence = $4
        AND lease_expires_at > $6::timestamptz`,
    [
      input.tenantId,
      input.taskId,
      input.workerId,
      input.leaseFence,
      state,
      input.at,
      terminalAt,
      waitReason,
      failureCode,
      failureMessage,
      cancellationReason,
    ],
  );

  if (result.rowCount !== 1) {
    throw new PlatformError({
      code: "workflows.task_stale_lease",
      category: "conflict",
      message: "Workflow Task lease is no longer current",
      retryable: false,
    });
  }
}

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

export interface RecoveredWorkflowTask {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly nodeKey: string;
  readonly state: "running";
  readonly revision: number;
  readonly startedAt: Instant;
  readonly leaseOwner: string;
  readonly leaseFence: number;
  readonly leasedAt: Instant;
  readonly heartbeatAt: Instant;
  readonly leaseExpiresAt: Instant;
  readonly adoptionCount: number;
}

interface RecoveryRow {
  tenant_id: TenantId;
  task_id: TaskId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  node_key: string;
  state: "running";
  revision: string;
  started_at: Date;
  lease_owner: string;
  lease_fence: string;
  leased_at: Date;
  heartbeat_at: Date;
  lease_expires_at: Date;
  adoption_count: string;
}

function recoveredTask(row: RecoveryRow): RecoveredWorkflowTask {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    nodeKey: row.node_key,
    state: "running",
    revision: Number(row.revision),
    startedAt: toInstant(row.started_at),
    leaseOwner: row.lease_owner,
    leaseFence: Number(row.lease_fence),
    leasedAt: toInstant(row.leased_at),
    heartbeatAt: toInstant(row.heartbeat_at),
    leaseExpiresAt: toInstant(row.lease_expires_at),
    adoptionCount: Number(row.adoption_count),
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

export async function heartbeatWorkflowTaskLease(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly taskId: TaskId;
    readonly workerId: string;
    readonly leaseFence: number;
    readonly leaseMs: number;
  },
): Promise<Readonly<{ heartbeatAt: Instant; leaseExpiresAt: Instant }>> {
  assertWorkerId(input.workerId);
  assertLeaseMs(input.leaseMs);
  if (!Number.isSafeInteger(input.leaseFence) || input.leaseFence < 1) {
    throw new RangeError("leaseFence must be a positive safe integer");
  }

  const result = await client.query<{
    heartbeat_at: Date;
    lease_expires_at: Date;
  }>(
    `UPDATE workflows.tasks
        SET heartbeat_at = clock_timestamp(),
            lease_expires_at =
              clock_timestamp() + ($5::bigint * interval '1 millisecond'),
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND task_id = $2
        AND state = 'running'
        AND lease_owner = $3
        AND lease_fence = $4
        AND lease_expires_at > clock_timestamp()
      RETURNING heartbeat_at, lease_expires_at`,
    [
      input.tenantId,
      input.taskId,
      input.workerId,
      input.leaseFence,
      input.leaseMs,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "workflows.task_stale_lease",
      category: "conflict",
      message: "Workflow Task lease is no longer current",
      retryable: false,
    });
  }
  return Object.freeze({
    heartbeatAt: toInstant(row.heartbeat_at),
    leaseExpiresAt: toInstant(row.lease_expires_at),
  });
}

export async function adoptExpiredWorkflowTasks(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  },
): Promise<readonly RecoveredWorkflowTask[]> {
  assertWorkerId(input.workerId);
  assertLeaseMs(input.leaseMs);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<RecoveryRow>(
      `WITH stale AS (
         SELECT tenant_id, task_id
           FROM workflows.tasks
          WHERE tenant_id = $1
            AND state = 'running'
            AND lease_owner IS NOT NULL
            AND lease_expires_at <= clock_timestamp()
          ORDER BY lease_expires_at, task_id
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE workflows.tasks AS t
          SET revision = t.revision + 1,
              updated_at = clock_timestamp(),
              lease_owner = $3,
              lease_fence = t.lease_fence + 1,
              leased_at = clock_timestamp(),
              heartbeat_at = clock_timestamp(),
              lease_expires_at =
                clock_timestamp() + ($4::bigint * interval '1 millisecond'),
              adoption_count = t.adoption_count + 1
         FROM stale
        WHERE t.tenant_id = stale.tenant_id
          AND t.task_id = stale.task_id
       RETURNING
         t.tenant_id,
         t.task_id,
         t.workflow_run_id,
         t.workflow_version_id,
         t.graph_signature,
         t.node_key,
         t.state,
         t.revision::text,
         t.started_at,
         t.lease_owner,
         t.lease_fence::text,
         t.leased_at,
         t.heartbeat_at,
         t.lease_expires_at,
         t.adoption_count::text`,
      [input.tenantId, input.limit, input.workerId, input.leaseMs],
    );

    return Object.freeze(result.rows.map(recoveredTask));
  });
}

import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  normalizeWorkflowExecutorLease,
  planWorkflowExecutorLeaseAcquire,
  planWorkflowExecutorLeaseRelease,
  planWorkflowExecutorLeaseRenew,
  type WorkflowExecutorLease,
  type WorkflowExecutorLeaseRepository,
  type WorkflowRunState,
} from "@masanawa/workflows";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface LeaseRow {
  tenant_id: WorkflowExecutorLease["tenantId"];
  workflow_run_id: WorkflowExecutorLease["workflowRunId"];
  holder_id: string;
  fence: string;
  state: WorkflowExecutorLease["state"];
  acquired_at: Date;
  renewed_at: Date;
  expires_at: Date;
  released_at: Date | null;
}

interface RunStateRow {
  state: WorkflowRunState;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function missing(): PlatformError {
  return new PlatformError({
    code: "workflows.run_not_found",
    category: "not-found",
    message: "WorkflowRun was not found for executor lease",
    retryable: false,
  });
}

function rowToLease(row: LeaseRow): WorkflowExecutorLease {
  return normalizeWorkflowExecutorLease({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    holderId: row.holder_id,
    fence: Number(row.fence),
    state: row.state,
    acquiredAt: toInstant(row.acquired_at),
    renewedAt: toInstant(row.renewed_at),
    expiresAt: toInstant(row.expires_at),
    releasedAt:
      row.released_at === null ? null : toInstant(row.released_at),
  });
}

async function clock(client: PoolClient): Promise<Instant> {
  const result = await client.query<{ at: Date }>(
    "SELECT clock_timestamp() AS at",
  );
  return toInstant(result.rows[0]!.at);
}

async function lockRun(
  client: PoolClient,
  tenantId: WorkflowExecutorLease["tenantId"],
  workflowRunId: WorkflowExecutorLease["workflowRunId"],
): Promise<WorkflowRunState> {
  const result = await client.query<RunStateRow>(
    `SELECT state
       FROM workflows.workflow_runs
      WHERE tenant_id = $1
        AND workflow_run_id = $2
      FOR UPDATE`,
    [tenantId, workflowRunId],
  );
  if (!result.rows[0]) throw missing();
  return result.rows[0].state;
}

async function loadLease(
  client: PoolClient,
  tenantId: WorkflowExecutorLease["tenantId"],
  workflowRunId: WorkflowExecutorLease["workflowRunId"],
  write: boolean,
): Promise<WorkflowExecutorLease | null> {
  const result = await client.query<LeaseRow>(
    `SELECT *
       FROM workflows.workflow_executor_leases
      WHERE tenant_id = $1
        AND workflow_run_id = $2
      ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [tenantId, workflowRunId],
  );
  return result.rows[0] ? rowToLease(result.rows[0]) : null;
}

function normalizedScope(input: {
  readonly tenantId: WorkflowExecutorLease["tenantId"];
  readonly workflowRunId: WorkflowExecutorLease["workflowRunId"];
}) {
  return {
    tenantId: parseCanonicalId("tenant", input.tenantId),
    workflowRunId: parseCanonicalId("workflow-run", input.workflowRunId),
  };
}

function assertCallerObservationNotFuture(
  observedAt: Instant,
  databaseAt: Instant,
): void {
  const observed = Date.parse(toInstant(observedAt));
  const database = Date.parse(databaseAt);
  if (observed > database + 60_000) {
    throw conflict(
      "workflows.executor_lease_clock_invalid",
      "Executor lease request clock is too far ahead of the database clock",
    );
  }
}

export function createPostgresWorkflowExecutorLeaseRepository(
  pool: Pool,
): WorkflowExecutorLeaseRepository {
  return Object.freeze({
    async acquire(raw) {
      const scope = normalizedScope(raw);
      return withTransaction(pool, async (client) => {
        const runState = await lockRun(
          client,
          scope.tenantId,
          scope.workflowRunId,
        );
        if (runState !== raw.runState) {
          throw conflict(
            "workflows.executor_lease_run_state_stale",
            "WorkflowRun state changed before executor lease acquisition",
          );
        }
        const at = await clock(client);
        assertCallerObservationNotFuture(raw.now, at);
        const current = await loadLease(
          client,
          scope.tenantId,
          scope.workflowRunId,
          true,
        );
        const planned = planWorkflowExecutorLeaseAcquire({
          current,
          ...scope,
          holderId: raw.holderId,
          runState,
          now: at,
          durationMs: raw.durationMs,
        });

        if (
          current !== null &&
          planned.fence === current.fence &&
          planned.state === current.state &&
          planned.holderId === current.holderId &&
          planned.renewedAt === current.renewedAt &&
          planned.expiresAt === current.expiresAt
        ) {
          return current;
        }

        const result =
          current === null
            ? await client.query<LeaseRow>(
                `INSERT INTO workflows.workflow_executor_leases(
                   tenant_id, workflow_run_id, holder_id, fence, state,
                   acquired_at, renewed_at, expires_at, released_at
                 )
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 RETURNING *`,
                [
                  planned.tenantId,
                  planned.workflowRunId,
                  planned.holderId,
                  planned.fence,
                  planned.state,
                  planned.acquiredAt,
                  planned.renewedAt,
                  planned.expiresAt,
                  planned.releasedAt,
                ],
              )
            : await client.query<LeaseRow>(
                `UPDATE workflows.workflow_executor_leases
                    SET holder_id = $3,
                        fence = $4,
                        state = $5,
                        acquired_at = $6,
                        renewed_at = $7,
                        expires_at = $8,
                        released_at = $9
                  WHERE tenant_id = $1
                    AND workflow_run_id = $2
                    AND fence = $10
                  RETURNING *`,
                [
                  planned.tenantId,
                  planned.workflowRunId,
                  planned.holderId,
                  planned.fence,
                  planned.state,
                  planned.acquiredAt,
                  planned.renewedAt,
                  planned.expiresAt,
                  planned.releasedAt,
                  current.fence,
                ],
              );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.executor_lease_conflict",
            "WorkflowRun executor lease changed before acquisition",
          );
        }
        return rowToLease(result.rows[0]);
      });
    },

    async renew(raw) {
      const scope = normalizedScope(raw);
      return withTransaction(pool, async (client) => {
        await lockRun(client, scope.tenantId, scope.workflowRunId);
        const at = await clock(client);
        assertCallerObservationNotFuture(raw.now, at);
        const current = await loadLease(
          client,
          scope.tenantId,
          scope.workflowRunId,
          true,
        );
        if (current === null) {
          throw conflict(
            "workflows.executor_lease_missing",
            "WorkflowRun executor lease does not exist",
          );
        }
        const planned = planWorkflowExecutorLeaseRenew({
          current,
          holderId: raw.holderId,
          fence: raw.fence,
          now: at,
          durationMs: raw.durationMs,
        });
        const result = await client.query<LeaseRow>(
          `UPDATE workflows.workflow_executor_leases
              SET renewed_at = $5,
                  expires_at = $6
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND holder_id = $3
              AND fence = $4
              AND state = 'held'
            RETURNING *`,
          [
            scope.tenantId,
            scope.workflowRunId,
            planned.holderId,
            planned.fence,
            planned.renewedAt,
            planned.expiresAt,
          ],
        );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.executor_lease_fenced",
            "WorkflowRun executor lease was fenced before renewal",
          );
        }
        return rowToLease(result.rows[0]);
      });
    },

    async read(raw) {
      const scope = normalizedScope(raw);
      return withTransaction(
        pool,
        async (client) =>
          loadLease(
            client,
            scope.tenantId,
            scope.workflowRunId,
            false,
          ),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async release(raw) {
      const scope = normalizedScope(raw);
      return withTransaction(pool, async (client) => {
        await lockRun(client, scope.tenantId, scope.workflowRunId);
        const at = await clock(client);
        assertCallerObservationNotFuture(raw.now, at);
        const current = await loadLease(
          client,
          scope.tenantId,
          scope.workflowRunId,
          true,
        );
        if (current === null) {
          throw conflict(
            "workflows.executor_lease_missing",
            "WorkflowRun executor lease does not exist",
          );
        }
        const planned = planWorkflowExecutorLeaseRelease({
          lease: current,
          holderId: raw.holderId,
          fence: raw.fence,
          at,
        });
        const result = await client.query<LeaseRow>(
          `UPDATE workflows.workflow_executor_leases
              SET state = 'released',
                  released_at = $5
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND holder_id = $3
              AND fence = $4
              AND state = 'held'
            RETURNING *`,
          [
            scope.tenantId,
            scope.workflowRunId,
            planned.holderId,
            planned.fence,
            planned.releasedAt,
          ],
        );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.executor_lease_fenced",
            "WorkflowRun executor lease was fenced before release",
          );
        }
        return rowToLease(result.rows[0]);
      });
    },
  });
}

import type {
  WorkflowExecutionGuard,
  WorkflowExecutionLock,
} from "@masanawa/workflows";
import type { Pool, PoolClient } from "pg";

function lockKey(tenantId: string, workflowRunId: string): string {
  return `workflow-run:${tenantId}:${workflowRunId}`;
}

/**
 * Holds a PostgreSQL session advisory lock for one bounded resume invocation.
 *
 * Locks coordinate executor workers only; consequential domain operations still
 * require their own idempotency/reconciliation and current-authority checks.
 */
export function createPostgresWorkflowExecutionGuard(
  pool: Pool,
): WorkflowExecutionGuard {
  return Object.freeze({
    async acquire(input): Promise<WorkflowExecutionLock | null> {
      const client = await pool.connect();
      const key = lockKey(input.tenantId, input.workflowRunId);
      let released = false;

      try {
        const result = await client.query<{ acquired: boolean }>(
          `SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired`,
          [key],
        );
        if (result.rows[0]?.acquired !== true) {
          client.release();
          return null;
        }
      } catch (error) {
        client.release();
        throw error;
      }

      return Object.freeze({
        async release() {
          if (released) return;
          released = true;
          try {
            await client.query(
              `SELECT pg_advisory_unlock(hashtextextended($1, 0))`,
              [key],
            );
          } finally {
            client.release();
          }
        },
      });
    },
  });
}

import type { Pool, PoolClient } from "pg";
import type { OperatorActor, OperatorTaskEvent, OperatorTaskPhase, OperatorTaskRecord, OperatorTaskRepository } from "./index.js";
import { OperatorTaskError } from "./index.js";

type RawTask = {
  task_id: string; tenant_id: string; user_id: string; request_id: string;
  scope: OperatorTaskRecord["scope"]; capability_id: string; capability_version: number;
  argument_digest: string; phase: OperatorTaskPhase; version: number;
  operation_class: OperatorTaskRecord["operationClass"]; operation_id: string | null;
  terms_digest: string | null; approval_digest: string | null; approval_session_digest: string | null;
  approval_expires_at: Date | string | null; receipt_ref: string | null; error_code: string | null;
  created_at: Date | string; updated_at: Date | string;
};
type RawEvent = {
  task_id: string; task_version: number; phase: OperatorTaskPhase;
  occurred_at: Date | string; code: string | null;
};

function iso(v: Date | string): string { return new Date(v).toISOString(); }
function task(row: RawTask): OperatorTaskRecord {
  return Object.freeze({
    taskId: row.task_id, tenantId: row.tenant_id as OperatorActor["tenantId"],
    userId: row.user_id as OperatorActor["userId"], requestId: row.request_id, scope: row.scope,
    capabilityId: row.capability_id, capabilityVersion: row.capability_version,
    argumentDigest: row.argument_digest, phase: row.phase, version: row.version,
    operationClass: row.operation_class, operationId: row.operation_id,
    termsDigest: row.terms_digest, approvalDigest: row.approval_digest,
    approvalSessionDigest: row.approval_session_digest,
    approvalExpiresAt: row.approval_expires_at ? iso(row.approval_expires_at) : null,
    receiptRef: row.receipt_ref, errorCode: row.error_code,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  });
}
function event(row: RawEvent): OperatorTaskEvent {
  return Object.freeze({
    taskId: row.task_id, version: row.task_version, phase: row.phase,
    at: iso(row.occurred_at), code: row.code,
  });
}
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally { client.release(); }
}
const COLUMN: Record<string, string> = Object.freeze({
  phase: "phase", operationClass: "operation_class", operationId: "operation_id",
  termsDigest: "terms_digest", approvalDigest: "approval_digest",
  approvalSessionDigest: "approval_session_digest", approvalExpiresAt: "approval_expires_at",
  receiptRef: "receipt_ref", errorCode: "error_code",
});

export function createPostgresOperatorTaskRepository(pool: Pool): OperatorTaskRepository {
  return Object.freeze<OperatorTaskRepository>({
    async createOrRead({ actor, task: value }) {
      return transaction(pool, async client => {
        await client.query(
          `INSERT INTO operator_tasks.tasks(
            tenant_id,user_id,task_id,request_id,scope,capability_id,capability_version,
            argument_digest,phase,version,operation_class,operation_id,terms_digest,
            approval_digest,approval_session_digest,approval_expires_at,receipt_ref,error_code,
            created_at,updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          ON CONFLICT (tenant_id,user_id,request_id) DO NOTHING`,
          [actor.tenantId,actor.userId,value.taskId,value.requestId,value.scope,
           value.capabilityId,value.capabilityVersion,value.argumentDigest,value.phase,
           value.version,value.operationClass,value.operationId,value.termsDigest,
           value.approvalDigest,value.approvalSessionDigest,value.approvalExpiresAt,
           value.receiptRef,value.errorCode,value.createdAt,value.updatedAt],
        );
        const selected = await client.query<RawTask>(
          `SELECT * FROM operator_tasks.tasks WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3 FOR UPDATE`,
          [actor.tenantId,actor.userId,value.requestId],
        );
        const row = selected.rows[0];
        if (!row) throw new OperatorTaskError("TASK_PERSISTENCE_UNAVAILABLE", 503);
        // Initial event is only emitted once. It cannot be duplicated by a retried request.
        await client.query(
          `INSERT INTO operator_tasks.events(tenant_id,user_id,task_id,task_version,phase,occurred_at,code)
           VALUES ($1,$2,$3,1,'proposed',$4,NULL) ON CONFLICT DO NOTHING`,
          [actor.tenantId,actor.userId,row.task_id,row.created_at],
        );
        return task(row);
      });
    },
    async read({ actor, taskId }) {
      const rows = await pool.query<RawTask>(
        `SELECT * FROM operator_tasks.tasks WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3`,
        [actor.tenantId,actor.userId,taskId],
      );
      return rows.rows[0] ? task(rows.rows[0]) : null;
    },
    async list({ actor, limit, before }) {
      const result = await pool.query<RawTask>(
        `SELECT * FROM operator_tasks.tasks t
          WHERE t.tenant_id=$1 AND t.user_id=$2
            AND ($3::text IS NULL OR (t.created_at,t.task_id) <
             (SELECT b.created_at,b.task_id FROM operator_tasks.tasks b
              WHERE b.tenant_id=$1 AND b.user_id=$2 AND b.task_id=$3))
          ORDER BY t.created_at DESC,t.task_id DESC LIMIT $4`,
        [actor.tenantId,actor.userId,before ?? null,limit],
      );
      return Object.freeze(result.rows.map(task));
    },
    async events({ actor, taskId, afterVersion, limit }) {
      const result = await pool.query<RawEvent>(
        `SELECT task_id,task_version,phase,occurred_at,code FROM operator_tasks.events
          WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3 AND task_version>$4
          ORDER BY task_version ASC LIMIT $5`,
        [actor.tenantId,actor.userId,taskId,afterVersion,limit],
      );
      return Object.freeze(result.rows.map(event));
    },
    async change({ actor, taskId, expectedVersion, allowedFrom, patch, at, requireUnexpiredApproval = false }) {
      return transaction(pool, async client => {
        const selected = await client.query<RawTask>(
          `SELECT * FROM operator_tasks.tasks
            WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3 FOR UPDATE`,
          [actor.tenantId,actor.userId,taskId],
        );
        const row = selected.rows[0];
        if (!row) throw new OperatorTaskError("TASK_NOT_FOUND", 404);
        if (row.version !== expectedVersion || !allowedFrom.includes(row.phase)) {
          throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
        }
        const keys = Object.keys(patch).filter(key => patch[key as keyof typeof patch] !== undefined);
        if (!keys.includes("phase")) throw new OperatorTaskError("TASK_INVALID_TRANSITION", 400);
        for (const key of keys) if (!COLUMN[key]) throw new OperatorTaskError("TASK_INVALID_TRANSITION", 400);
        const assignments = keys.map((key, index) => `${COLUMN[key]}=$${index + 4}`);
        const values = keys.map(key => patch[key as keyof typeof patch]);
        const updated = await client.query<RawTask>(
          `UPDATE operator_tasks.tasks SET ${assignments.join(",")},
              version=version+1,updated_at=$${values.length+4}
            WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3
              AND ($${values.length+5}::boolean = false OR
                (phase='awaiting_approval' AND approval_expires_at > clock_timestamp()))
            RETURNING *`,
          [actor.tenantId,actor.userId,taskId,...values,at,requireUnexpiredApproval],
        );
        const next = updated.rows[0];
        // The database clock is the final expiry authority at the actual CAS
        // admission write, including delays acquiring the row lock.
        if (!next && requireUnexpiredApproval) {
          throw new OperatorTaskError("TASK_APPROVAL_INVALID", 403);
        }
        if (!next) throw new OperatorTaskError("TASK_PERSISTENCE_UNAVAILABLE", 503);
        await client.query(
          `INSERT INTO operator_tasks.events(
             tenant_id,user_id,task_id,task_version,phase,occurred_at,code
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [actor.tenantId,actor.userId,taskId,next.version,next.phase,at,next.error_code],
        );
        return task(next);
      });
    },
  });
}

import type { Pool, PoolClient } from "pg";
import type { OperatorDomainOutcome, OperatorTaskPhase } from "./index.js";

/**
 * U02 service-principal, status-only recovery. This module is NOT an HTTP route
 * or a domain executor. It may be wired only to a trusted canonical operation
 * status adapter; never an AI/model result or a provider "submit" endpoint.
 *
 * The PostgreSQL lock/CAS revision doubles as the recovery lease. It is
 * intentionally separate from a customer's ephemeral access-token session.
 */
export interface RecoveryOperation {
  readonly tenantId: string;
  readonly userId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly capabilityId: string;
  readonly version: number;
}
/**
 * Domain receipt readback MUST echo the durable operation identity, not merely
 * a bare success code. The canonical adapter checks its own backing record;
 * this worker independently rejects accidental cross-user/operation results.
 */
export interface RecoveryVerifiedReadback {
  readonly tenantId: string;
  readonly userId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly capabilityId: string;
  readonly outcome: OperatorDomainOutcome;
}
export interface RecoveryStatusSource {
  /** Read-only authoritative receipt; NEVER a quote, submit or re-execute API. */
  readback(operation: RecoveryOperation): Promise<RecoveryVerifiedReadback>;
}
export interface RecoveryJournal {
  claim(input: Readonly<{ before: string; now: string; limit: number }>): Promise<readonly RecoveryOperation[]>;
  settle(input: Readonly<{
    operation: RecoveryOperation;
    outcome: OperatorDomainOutcome;
    now: string;
  }>): Promise<"settled" | "stale" | "unknown">;
}
export interface RecoveryBatchResult {
  readonly claimed: number;
  readonly confirmed: number;
  readonly rejected: number;
  readonly unknown: number;
  readonly stale: number;
}

function iso(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("RECOVERY_INVALID_CLOCK");
  return date.toISOString();
}
function positiveInt(value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error("RECOVERY_INVALID_LIMIT");
  }
  return value;
}
function validReceipt(ref: string): boolean {
  return ref.length > 0 && ref.length <= 200 && /^[a-zA-Z0-9:_./-]+$/u.test(ref);
}
function validRejectionCode(code: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,63}$/u.test(code);
}
/** A verified domain record must bind a result to the *claimed* operation. */
function boundOutcome(
  operation: RecoveryOperation,
  result: RecoveryVerifiedReadback,
): OperatorDomainOutcome {
  if (!result || result.tenantId !== operation.tenantId ||
      result.userId !== operation.userId || result.taskId !== operation.taskId ||
      result.operationId !== operation.operationId ||
      result.capabilityId !== operation.capabilityId ||
      !result.outcome || typeof result.outcome !== "object") {
    return { status: "unknown" };
  }
  const outcome = result.outcome;
  if (outcome.status === "unknown") return { status: "unknown" };
  if (outcome.status === "confirmed" && typeof outcome.receiptRef === "string" && validReceipt(outcome.receiptRef)) return outcome;
  if (outcome.status === "rejected" && typeof outcome.code === "string" && validRejectionCode(outcome.code)) return outcome;
  return { status: "unknown" };
}

async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
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
  } finally {
    client.release();
  }
}

type ClaimedRow = {
  tenant_id: string;
  user_id: string;
  task_id: string;
  operation_id: string;
  capability_id: string;
  version: number;
};
type VersionRow = { phase: OperatorTaskPhase; version: number };

/**
 * Only a dedicated internal worker with restricted DB grants may call this.
 * Lock+UPDATE+event are a single committed transaction. Concurrent workers
 * use SKIP LOCKED and can never lease a row twice during one batch. The
 * updated_at cutoff enforces an inter-run retry delay after a crash.
 */
export function createPostgresRecoveryJournal(pool: Pool): RecoveryJournal {
  return Object.freeze({
    async claim({ before, now, limit }) {
      positiveInt(limit, 25);
      const cutoff = iso(before), at = iso(now);
      if (Date.parse(cutoff) > Date.parse(at)) throw new Error("RECOVERY_INVALID_CLOCK");
      return inTransaction(pool, async client => {
        const rows = await client.query<ClaimedRow>(
          `WITH eligible AS (
             SELECT tenant_id,user_id,task_id
               FROM operator_tasks.tasks
              WHERE phase IN ('running','reconciling')
                AND updated_at <= $1::timestamptz AND operation_id IS NOT NULL
              ORDER BY updated_at,task_id
              LIMIT $2 FOR UPDATE SKIP LOCKED
           ), leased AS (
             UPDATE operator_tasks.tasks t
                SET phase='reconciling', version=t.version+1,
                    updated_at=$3::timestamptz, error_code='DOMAIN_OUTCOME_UNKNOWN'
               FROM eligible e
              WHERE t.tenant_id=e.tenant_id AND t.user_id=e.user_id
                AND t.task_id=e.task_id
              RETURNING t.tenant_id,t.user_id,t.task_id,t.operation_id,
                        t.capability_id,t.version,t.phase,t.updated_at,t.error_code
           ), recorded AS (
             INSERT INTO operator_tasks.events
                 (tenant_id,user_id,task_id,task_version,phase,occurred_at,code)
             SELECT tenant_id,user_id,task_id,version,phase,updated_at,error_code
               FROM leased
             RETURNING tenant_id,user_id,task_id,task_version
           )
           SELECT l.tenant_id,l.user_id,l.task_id,l.operation_id,
                  l.capability_id,l.version
             FROM leased l JOIN recorded r
             ON r.tenant_id=l.tenant_id AND r.user_id=l.user_id
                AND r.task_id=l.task_id AND r.task_version=l.version`,
          [cutoff,limit,at],
        );
        return Object.freeze(rows.rows.map(row => Object.freeze({
          tenantId: row.tenant_id, userId: row.user_id, taskId: row.task_id,
          operationId: row.operation_id, capabilityId: row.capability_id,
          version: row.version,
        })));
      });
    },
    async settle({ operation, outcome, now }) {
      const at = iso(now);
      if (outcome.status === "unknown") return "unknown";
      // Invalid receipts are NEVER promoted to success. A bad domain code
      // cannot be injected into an audit row as raw provider/user text.
      if (outcome.status === "confirmed" && !validReceipt(outcome.receiptRef)) return "unknown";
      if (outcome.status === "rejected" && !validRejectionCode(outcome.code)) return "unknown";
      const phase: "succeeded" | "failed" = outcome.status === "confirmed" ? "succeeded" : "failed";
      const receipt = outcome.status === "confirmed" ? outcome.receiptRef : null;
      const errorCode = outcome.status === "rejected" ? outcome.code : null;
      return inTransaction(pool, async client => {
        const found = await client.query<VersionRow>(
          `SELECT phase,version FROM operator_tasks.tasks
            WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3
              AND operation_id=$4 AND capability_id=$5 FOR UPDATE`,
          [operation.tenantId,operation.userId,operation.taskId,operation.operationId,operation.capabilityId],
        );
        const task = found.rows[0];
        if (!task || task.phase !== "reconciling" || task.version !== operation.version) return "stale";
        const result = await client.query<{ version: number }>(
          `UPDATE operator_tasks.tasks SET phase=$5,receipt_ref=$6,error_code=$7,
                   version=version+1,updated_at=$8::timestamptz
            WHERE tenant_id=$1 AND user_id=$2 AND task_id=$3 AND operation_id=$4
                  AND version=$9 AND phase='reconciling' AND capability_id=$10 RETURNING version`,
          [operation.tenantId,operation.userId,operation.taskId,operation.operationId,
           phase,receipt,errorCode,at,operation.version,operation.capabilityId],
        );
        const updated = result.rows[0];
        if (!updated) return "stale";
        await client.query(
          `INSERT INTO operator_tasks.events
             (tenant_id,user_id,task_id,task_version,phase,occurred_at,code)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [operation.tenantId,operation.userId,operation.taskId,
           updated.version,phase,at,errorCode],
        );
        return "settled";
      });
    },
  });
}

export function createStatusOnlyRecovery(input: Readonly<{
  journal: RecoveryJournal;
  status: RecoveryStatusSource;
  now?: () => Date;
  minAgeMs?: number;
  limit?: number;
  timeoutMs?: number;
}>): Readonly<{ runOnce(): Promise<RecoveryBatchResult> }> {
  const clock = input.now ?? (() => new Date());
  const minAgeMs = input.minAgeMs ?? 60_000;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const limit = positiveInt(input.limit ?? 10, 25);
  if (!Number.isSafeInteger(minAgeMs) || minAgeMs < 10_000 || minAgeMs > 86_400_000 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) {
    throw new Error("RECOVERY_INVALID_CONFIGURATION");
  }
  return Object.freeze({
    async runOnce() {
      const now = clock();
      const at = iso(now);
      const before = iso(new Date(now.getTime() - minAgeMs));
      const operations = await input.journal.claim({ before, now: at, limit });
      let confirmed = 0, rejected = 0, unknown = 0, stale = 0;
      for (const operation of operations) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let outcome: OperatorDomainOutcome = { status: "unknown" };
        try {
          const deadline = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("RECOVERY_LOOKUP_TIMEOUT")), timeoutMs);
          });
          const readback = await Promise.race([input.status.readback(operation), deadline]);
          outcome = boundOutcome(operation, readback);
        } catch {
          outcome = { status: "unknown" };
        } finally {
          if (timer) clearTimeout(timer);
        }
        // Status lookup failure leaves a leased reconciling row for a later
        // read-only retry. NEVER re-execute the external operation.
        const result = await input.journal.settle({ operation, outcome, now: at });
        if (result === "stale") stale++;
        else if (result === "unknown" || outcome.status === "unknown") unknown++;
        else if (outcome.status === "confirmed") confirmed++;
        else rejected++;
      }
      return Object.freeze({ claimed: operations.length, confirmed, rejected, unknown, stale });
    },
  });
}

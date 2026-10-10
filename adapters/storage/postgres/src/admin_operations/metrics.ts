import type { Pool } from "pg";
/**
 * A01: read-only tenant aggregates from the pre-existing durable event ledger.
 * Deliberately no second queue, event store, status table or financial authority.
 */
export function createPostgresAdminOperationsMetrics(pool:Pool) {
  return {async read(tenantId:string) {
    const [outbox,finance]=await Promise.all([
      pool.query<{pending_jobs:string;active_leases:string;dead_letters:string;oldest_seconds:string|null}>(`
        SELECT
          count(*) FILTER(WHERE state IN ('pending','retry-scheduled'))::text AS pending_jobs,
          count(*) FILTER(WHERE state='claimed' AND lease_expires_at>clock_timestamp())::text AS active_leases,
          count(*) FILTER(WHERE state='dead-letter')::text AS dead_letters,
          floor(EXTRACT(EPOCH FROM (clock_timestamp()-min(created_at) FILTER(
             WHERE state IN ('pending','retry-scheduled')))))::text AS oldest_seconds
        FROM events.outbox WHERE tenant_id=$1`,[tenantId]),
      pool.query<{cases:string}>(`
        SELECT count(*)::text AS cases FROM events.reconciliation_cases
        WHERE tenant_id=$1 AND status IN ('open','checking','needs-attention')`,[tenantId])
    ]);
    const q=outbox.rows[0],f=finance.rows[0];
    return {pendingJobs:Number(q?.pending_jobs??0),activeJobLeases:Number(q?.active_leases??0),
      deadLetters:Number(q?.dead_letters??0),oldestPendingSeconds:q?.oldest_seconds===null || q?.oldest_seconds===undefined?null:Number(q.oldest_seconds),
      openFinancialReconciliation:Number(f?.cases??0),
      // These become numbers only after L-ROOMS/L-VIDEO/L-FIN exposes trusted metric sources.
      roomAnswerAgeSeconds:null,externalSyncLagSeconds:null,entitlementErrors:null,budgetWarnings:null};
  }};
}

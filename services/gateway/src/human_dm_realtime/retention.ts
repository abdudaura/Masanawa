/** C03 operator-only journal retention. No authenticated API exposes pruning.
 * Run via an explicitly enabled, dedicated scheduled/one-off operator with
 * a tenant-scoped credential and a verified backup/recovery plan.
 */
export interface PruneSqlPool {
  query(
    sql: string, values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}
// An operator must preflight the exact pool/tenant immediately before one run.
// A WeakMap keeps this fail-closed safeguard private to this process and does
// not pretend to replace PostgreSQL role privileges or restore evidence.
const authorizedRuns = new WeakMap<PruneSqlPool, { tenantId: string; checkedAt: number }>();
const PREFLIGHT_TTL_MS = 5 * 60 * 1000;

export interface PruneResult {
  readonly deleted: number;
  readonly batches: number;
  readonly possiblyMore: boolean;
}
/** Preflight MUST run before operator mutation. Database and tenant are checked
 * through the connected database, not inferred from the connection URL.
 * This is a safety gate, not proof the backup reference is recoverable.
 */
export async function verifyHumanDmRetentionTarget(input: {
  pool: PruneSqlPool;
  tenantId: string;
  expectedDatabase: string;
}): Promise<{ database: string; role: string }> {
  if (!input.tenantId || input.tenantId.length > 256 ||
      !input.expectedDatabase || input.expectedDatabase.length > 128) {
    throw new Error("Incomplete C03 retention target");
  }
  // Even a failed recheck revokes any earlier authorization on this pool.
  authorizedRuns.delete(input.pool);
  const result = await input.pool.query(`
    SELECT current_database()::text AS database_name,
      current_user::text AS database_role,
      EXISTS(SELECT 1 FROM identity.tenants WHERE tenant_id=$1) AS tenant_exists,
      COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('talks.trim_human_dm_events(text,timestamptz,integer)'),
        'EXECUTE'),false) AS can_trim
  `,[input.tenantId]);
  const row=result.rows[0];
  if(!row || row.database_name!==input.expectedDatabase ||
      typeof row.database_role!=="string" || !row.database_role ||
      row.tenant_exists!==true || row.can_trim!==true) {
    throw new Error("C03 retention database/tenant/role preflight failed");
  }
  if(result.rows.length!==1 || result.rowCount!==1) {
    throw new Error("C03 retention database/tenant/role preflight failed");
  }
  const checkedAt=Date.now();
  if(!Number.isSafeInteger(checkedAt) || checkedAt<0) {
    throw new Error("C03 retention database/tenant/role preflight failed");
  }
  authorizedRuns.set(input.pool,{tenantId:input.tenantId,checkedAt});
  return {database:row.database_name as string,role:row.database_role as string};
}

export async function pruneHumanDmJournal(input: {
  pool: PruneSqlPool;
  tenantId: string;
  retentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
}): Promise<PruneResult> {
  const {pool,tenantId}=input;
  const retentionDays=input.retentionDays??30;
  const batchSize=input.batchSize??500;
  const maxBatches=input.maxBatches??20;
  if (!tenantId || tenantId.length>256 ||
      !Number.isSafeInteger(retentionDays) || retentionDays<7 || retentionDays>365 ||
      !Number.isSafeInteger(batchSize) || batchSize<1 || batchSize>1000 ||
      !Number.isSafeInteger(maxBatches) || maxBatches<1 || maxBatches>100) {
    throw new Error("Unsafe C03 journal retention configuration");
  }
  // Consume the one-use authorization before the first async mutation. It
  // cannot be reused for a second run, another tenant, or after its TTL.
  const authorization=authorizedRuns.get(pool);
  authorizedRuns.delete(pool);
  const now=Date.now();
  if(!authorization || authorization.tenantId!==tenantId ||
      !Number.isSafeInteger(now) || !Number.isSafeInteger(authorization.checkedAt) ||
      now<authorization.checkedAt ||
      now-authorization.checkedAt>PREFLIGHT_TTL_MS) {
    throw new Error("C03 retention requires a fresh matching target preflight");
  }
  let deleted=0;
  let batches=0;
  let possiblyMore=false;
  for (;batches<maxBatches;batches++) {
    // Database clock is authoritative. The PostgreSQL function enforces
    // an independent minimum age and serializes with message event commits.
    const result=await pool.query(`
      SELECT talks.trim_human_dm_events(
        $1::text, clock_timestamp()-($2::integer*interval '1 day'),
        $3::integer) AS deleted
    `,[tenantId,retentionDays,batchSize]);
    const raw=result.rows[0]?.deleted;
    // Missing/NULL/boolean/non-decimal rows are not equivalent to zero.
    // A malformed SQL reply must not be logged as a successful prune.
    if (!(typeof raw==="number" || (typeof raw==="string" && /^(0|[1-9][0-9]*)$/u.test(raw)))) {
      throw new Error("Invalid C03 prune result");
    }
    const count=Number(raw);
    if (!Number.isSafeInteger(count) || count<0 || count>batchSize) {
      throw new Error("Invalid C03 prune result");
    }
    deleted+=count;
    possiblyMore=count===batchSize;
    if (count<batchSize) return {deleted,batches:batches+1,possiblyMore:false};
  }
  return {deleted,batches,possiblyMore};
}

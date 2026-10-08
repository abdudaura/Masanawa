/** C03 operator-only journal retention. No authenticated API exposes pruning.
 * Run via an explicitly enabled, dedicated scheduled/one-off operator with
 * a tenant-scoped credential and a verified backup/recovery plan.
 */
export interface PruneSqlPool {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
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
  const result = await input.pool.query<{
    database_name:string;
    database_role:string;
    tenant_exists:boolean;
    can_trim:boolean;
  }>(`
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
      row.tenant_exists!==true || row.can_trim!==true) {
    throw new Error("C03 retention database/tenant/role preflight failed");
  }
  return {database:row.database_name,role:row.database_role};
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
  let deleted=0;
  let batches=0;
  let possiblyMore=false;
  for (;batches<maxBatches;batches++) {
    // Database clock is authoritative. The PostgreSQL function enforces
    // an independent minimum age and serializes with message event commits.
    const result=await pool.query<{deleted:string|number}>(`
      SELECT talks.trim_human_dm_events(
        $1::text, clock_timestamp()-($2::integer*interval '1 day'),
        $3::integer) AS deleted
    `,[tenantId,retentionDays,batchSize]);
    const count=Number(result.rows[0]?.deleted);
    if (!Number.isSafeInteger(count) || count<0 || count>batchSize) {
      throw new Error("Invalid C03 prune result");
    }
    deleted+=count;
    possiblyMore=count===batchSize;
    if (count<batchSize) return {deleted,batches:batches+1,possiblyMore:false};
  }
  return {deleted,batches,possiblyMore};
}

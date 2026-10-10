import type { HumanAiBudget, Principal } from "./service.js";
export interface HumanAiBudgetSql {
  query<Row extends Record<string, unknown>>(text: string, params: readonly unknown[]): Promise<{rows: Row[]}>;
}
/**
 * Bounded per-hour model cost. Atomic INSERT/CONFLICT guards simultaneous
 * device requests; missing migration/database rejects processing, not bypasses.
 * No DM content or inference result is persisted here.
 */
export function createPostgresHumanAiBudget(pool:HumanAiBudgetSql):HumanAiBudget {
  return Object.freeze({
    async reserve({tenantId,userId}:Principal):Promise<boolean> {
      const result=await pool.query<{usage_count:number}&Record<string,unknown>>(`
        INSERT INTO talks.human_ai_assist_quota AS quota
          (tenant_id,user_id,window_start,usage_count)
        SELECT u.tenant_id,u.user_id,date_trunc('hour',clock_timestamp()),1
          FROM identity.users u
         WHERE u.tenant_id=$1 AND u.user_id=$2 AND u.state='active'
        ON CONFLICT (tenant_id,user_id,window_start)
        DO UPDATE SET usage_count=quota.usage_count+1
          WHERE quota.usage_count < 20
        RETURNING usage_count
      `,[tenantId,userId]);
      return result.rows.length===1;
    },
  });
}

import type { Pool } from "pg";

/**
 * Handler for canonical events.outbox destination 'masana.follow_counts'.
 * Safe on lease retry: recompute instead of incrementing, so duplicate delivery
 * never over-counts. AF00 wires this into the existing lease/fence/outbox worker.
 */
export async function refreshMasanaFollowCount(
  pool: Pick<Pool,"query">,
  event: {readonly tenantId:string;readonly characterId:string},
):Promise<void>{
  if(!/^tenant_[a-zA-Z0-9_-]{1,128}$/.test(event.tenantId) ||
     !/^[a-zA-Z0-9_-]{1,160}$/.test(event.characterId)) throw new TypeError("invalid_masana_event");
  await pool.query(`INSERT INTO masana.follow_counts(tenant_id,character_id,follower_count,refreshed_at)
    SELECT $1,$2,count(*),now() FROM masana.follows WHERE tenant_id=$1 AND character_id=$2
    ON CONFLICT(tenant_id,character_id) DO UPDATE
    SET follower_count=EXCLUDED.follower_count,refreshed_at=EXCLUDED.refreshed_at`,[event.tenantId,event.characterId]);
}

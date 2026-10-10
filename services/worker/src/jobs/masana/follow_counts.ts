interface QueryPool { query(sql:string,parameters:readonly string[]):Promise<unknown> }
/** Existing outbox lease manager calls this idempotent recomputation at 'masana.follow_counts'. */
export async function refreshMasanaFollowCount(pool:QueryPool,event:{tenantId:string;characterId:string}):Promise<void>{
 if(!/^tenant_[a-zA-Z0-9_-]{1,128}$/.test(event.tenantId) ||
 !/^[a-zA-Z0-9_-]{1,160}$/.test(event.characterId)) throw new TypeError("invalid_masana_event");
 await pool.query("INSERT INTO masana.follow_counts(tenant_id,character_id,follower_count,refreshed_at) SELECT $1,$2,count(*),now() FROM masana.follows WHERE tenant_id=$1 AND character_id=$2 ON CONFLICT(tenant_id,character_id) DO UPDATE SET follower_count=EXCLUDED.follower_count,refreshed_at=EXCLUDED.refreshed_at",[event.tenantId,event.characterId]);
}

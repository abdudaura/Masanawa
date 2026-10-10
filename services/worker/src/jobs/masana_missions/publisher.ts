import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
/** J12 publisher. Requires durable Postgres and the canonical Feed publish(idempotencyKey)
 * implementation; does not itself create a second Feed/post table. */
export interface LeasedMissionPost {
  tenantId:string; missionId:string; slotId:string; characterId:string;
  publicationKey:string; leaseToken:string; kind:"text"|"image"|"audio";
  draftBody:string; topic:string; estimatedCostMinor:string; attempt:number;
}
export interface FeedPostPublisher {
  /** Must atomically deduplicate tenant+idempotencyKey for process restart safety. */
  publish(input:{tenantId:string;characterId:string;kind:"text"|"image"|"audio";
    body:string;topic:string;idempotencyKey:string}):Promise<{postId:string}>;
}
export interface PublicationGate {
  /** Rechecks the live kill switch, tenant authorization and worker principal. */
  enabled(tenantId:string,characterId:string):Promise<boolean>;
}
export interface MissionPublishQueue {
  lease():Promise<LeasedMissionPost|null>;
  eligible(post:LeasedMissionPost):Promise<boolean>;
  complete(post:LeasedMissionPost,postId:string):Promise<boolean>;
  failure(post:LeasedMissionPost,reason:"feed_unavailable"|"not_eligible"|"unsupported_media"):Promise<void>;
}
async function transaction<T>(pool:Pool, fn:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect();
  try { await client.query("BEGIN"); const r=await fn(client); await client.query("COMMIT"); return r; }
  catch(e){await client.query("ROLLBACK");throw e;}
  finally{client.release();}
}
export class PostgresMissionPublishQueue implements MissionPublishQueue {
  constructor(private readonly pool:Pool) {}
  async lease():Promise<LeasedMissionPost|null>{
    return transaction(this.pool,async db=>{
      // Locks a slot, then its single parent budget row. Concurrent workers SKIP LOCKED.
      const a=await db.query(`
        SELECT s.*,m.autonomy_level FROM masana.posting_slots s
        JOIN masana.missions m ON m.tenant_id=s.tenant_id AND m.mission_id=s.mission_id
        JOIN identity.characters c ON c.tenant_id=s.tenant_id AND c.character_id=s.character_id
        WHERE m.state='active' AND c.state='active' AND s.approved_by IS NOT NULL
          AND s.scheduled_at<=now() AND s.next_retry_at<=now()
          AND (s.state='approved' OR (s.state='publishing' AND s.lease_until<now()))
          AND s.attempt_count<6
        ORDER BY s.scheduled_at,s.slot_id LIMIT 1 FOR UPDATE OF s SKIP LOCKED`);
      if(!a.rowCount)return null;
      const s=a.rows[0];
      const m=await db.query("SELECT * FROM masana.missions WHERE tenant_id=$1 AND mission_id=$2 FOR UPDATE",
        [s.tenant_id,s.mission_id]);
      if(!m.rowCount || m.rows[0].state!=="active")return null;
      const reserved=await db.query(`
        SELECT COALESCE(SUM(estimated_cost_minor),0)::text AS cost
        FROM masana.posting_slots WHERE tenant_id=$1 AND mission_id=$2
        AND state='publishing' AND slot_id<>$3`,[s.tenant_id,s.mission_id,s.slot_id]);
      const projected=BigInt(m.rows[0].spent_minor)+BigInt(reserved.rows[0].cost)
        +BigInt(s.estimated_cost_minor);
      if(projected>BigInt(m.rows[0].budget_minor)){
        await db.query(`UPDATE masana.posting_slots SET state='failed',last_error='budget_exceeded',
            lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=now()
            WHERE tenant_id=$1 AND slot_id=$2`,[s.tenant_id,s.slot_id]);
        return null;
      }
      const token=randomUUID(),runId="mission-run_"+randomUUID();
      await db.query(`UPDATE masana.posting_slots SET state='publishing',
        attempt_count=attempt_count+1,lease_token=$3,lease_until=now()+INTERVAL '90 seconds',
        revision=revision+1,updated_at=now()
        WHERE tenant_id=$1 AND slot_id=$2`,[s.tenant_id,s.slot_id,token]);
      await db.query(`INSERT INTO masana.mission_runs
        (tenant_id,run_id,slot_id,publication_key,attempt,status)
        VALUES ($1,$2,$3,$4,$5,'leased')`,
        [s.tenant_id,runId,s.slot_id,s.publication_key,s.attempt_count+1]);
      return {tenantId:s.tenant_id,missionId:s.mission_id,slotId:s.slot_id,
        characterId:s.character_id,publicationKey:s.publication_key,
        leaseToken:token,kind:s.kind,draftBody:s.draft_body,topic:s.topic,
        estimatedCostMinor:String(s.estimated_cost_minor),attempt:s.attempt_count+1};
    });
  }
  async eligible(p:LeasedMissionPost):Promise<boolean>{
    const r=await this.pool.query(`
      SELECT 1 FROM masana.posting_slots s JOIN masana.missions m
        ON m.tenant_id=s.tenant_id AND m.mission_id=s.mission_id
      JOIN identity.characters c ON c.tenant_id=s.tenant_id AND c.character_id=s.character_id
      WHERE s.tenant_id=$1 AND s.slot_id=$2 AND s.lease_token=$3
        AND s.state='publishing' AND m.state='active' AND c.state='active'
        AND s.approved_by IS NOT NULL AND s.lease_until>now()`,
      [p.tenantId,p.slotId,p.leaseToken]);return r.rowCount===1;
  }
  async complete(p:LeasedMissionPost,postId:string):Promise<boolean>{
    if(!postId || postId.length>160)throw new Error("invalid_feed_post_id");
    return transaction(this.pool,async db=>{
      const locked=await db.query(`
        SELECT s.state,s.lease_token,s.estimated_cost_minor,s.mission_id
        FROM masana.posting_slots s WHERE tenant_id=$1 AND slot_id=$2 FOR UPDATE`,
        [p.tenantId,p.slotId]);
      if(!locked.rowCount || locked.rows[0].state!=="publishing"
        ||locked.rows[0].lease_token!==p.leaseToken)return false;
      const updated=await db.query(`UPDATE masana.missions SET spent_minor=spent_minor+$3::bigint,
        revision=revision+1,updated_at=now()
        WHERE tenant_id=$1 AND mission_id=$2 AND spent_minor+$3::bigint<=budget_minor`,
        [p.tenantId,p.missionId,p.estimatedCostMinor]);
      if(updated.rowCount!==1)throw new Error("reserved_budget_conservation_failed");
      await db.query(`UPDATE masana.posting_slots
        SET state='published',post_id=$3,published_at=now(),lease_token=NULL,lease_until=NULL,
          last_error=NULL,revision=revision+1,updated_at=now()
        WHERE tenant_id=$1 AND slot_id=$2`,[p.tenantId,p.slotId,postId]);
      await db.query(`UPDATE masana.mission_runs SET status='published',finished_at=now()
        WHERE tenant_id=$1 AND slot_id=$2 AND attempt=$3`,[p.tenantId,p.slotId,p.attempt]);
      return true;
    });
  }
  async failure(p:LeasedMissionPost,reason:"feed_unavailable"|"not_eligible"|"unsupported_media"):Promise<void>{
    const exhausted=p.attempt>=6 || reason==="unsupported_media";
    await transaction(this.pool,async db=>{
      const r=await db.query(`UPDATE masana.posting_slots
        SET state=$4,last_error=$5,next_retry_at=now()+($6::integer*INTERVAL '1 second'),
          lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=now()
        WHERE tenant_id=$1 AND slot_id=$2 AND lease_token=$3 AND state='publishing'
        RETURNING slot_id`,[p.tenantId,p.slotId,p.leaseToken,exhausted?"failed":"approved",reason,
        Math.min(3600,Math.pow(2,p.attempt)*30)]);
      if(r.rowCount)await db.query(`UPDATE masana.mission_runs SET status=$4,finished_at=now(),
        failure_code=$5 WHERE tenant_id=$1 AND slot_id=$2 AND attempt=$3`,
        [p.tenantId,p.slotId,p.attempt,exhausted?"exhausted":"retry",reason]);
    });
  }
}
/** One poll iteration. AF00 wires this to the existing durable outbox/worker loop.
 * No paid model generation, remote effects or polling starts on module import. */
export async function runMissionPublicationOnce(deps:{
  queue:MissionPublishQueue;publisher:FeedPostPublisher;gate:PublicationGate;
}):Promise<"idle"|"published"|"retry"|"denied">{
  const post=await deps.queue.lease();
  if(!post)return "idle";
  try{
    if(!(await deps.queue.eligible(post)) || !(await deps.gate.enabled(post.tenantId,post.characterId))){
      await deps.queue.failure(post,"not_eligible");return "denied";
    }
    // Approved rich-media objects need canonical S3 rights/media verification;
    // do not invent or auto-publish them from a plain text slot.
    if(post.kind!=="text"){await deps.queue.failure(post,"unsupported_media");return "denied";}
    const published=await deps.publisher.publish({tenantId:post.tenantId,characterId:post.characterId,
      kind:post.kind,body:post.draftBody,topic:post.topic,idempotencyKey:post.publicationKey});
    if(await deps.queue.complete(post,published.postId))return "published";
    return "retry"; // stale lease: same idempotency key retained for successor
  }catch{
    await deps.queue.failure(post,"feed_unavailable");
    return "retry"; // never generate a replacement publication key
  }
}

import {createCanonicalId,parseCanonicalId,toInstant} from "@masanawa/contracts";
import {enqueueOutbox} from "../events/outbox.js";
import type {Pool,PoolClient} from "pg";
interface Fan {tenantId:string;userId:string}
interface Rel {relationship_id:string;enabled:boolean;revision:string}
async function owner(c:PoolClient,p:Fan,ch:string,write=false):Promise<Rel|null>{
 const q=await c.query<Rel>(`SELECT r.relationship_id,COALESCE(f.enabled,false) enabled,
 COALESCE(f.revision,0)::text revision FROM identity.relationships r
 JOIN identity.users u ON u.tenant_id=r.tenant_id AND u.user_id=r.user_id AND u.state='active'
 JOIN identity.characters a ON a.tenant_id=r.tenant_id AND a.character_id=r.character_id AND a.state='active'
 LEFT JOIN memory.fan_controls f ON f.tenant_id=r.tenant_id AND f.relationship_id=r.relationship_id
 WHERE r.tenant_id=$1 AND r.user_id=$2 AND r.character_id=$3 AND r.state='active' ${write?'FOR UPDATE OF r':''}`,
 [p.tenantId,p.userId,ch]);return q.rows[0]??null;
}
export function createPostgresFanMemoryStore(pool:Pool){
 return {
 async read(p:Fan,ch:string){
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   const o=await owner(c,p,ch);
   if(!o){await c.query("COMMIT");return null;}
   // Hold a row-share lock on live consent until the read completes.
   const approved=await c.query<{enabled:boolean;revision:string}>(`
     SELECT enabled,revision::text FROM memory.fan_controls
     WHERE tenant_id=$1 AND relationship_id=$2 FOR SHARE`,
     [p.tenantId,o.relationship_id]);
   const enabled=approved.rows[0]?.enabled===true;
   const revision=approved.rows[0]?.revision??"0";
   const q=enabled?await c.query<{memory_record_id:string;content:string;updated_at:Date;expires_at:Date|null}>(`
     SELECT m.memory_record_id,v.content,m.updated_at,v.expires_at
     FROM memory.records m JOIN memory.revisions v ON v.tenant_id=m.tenant_id
      AND v.memory_record_id=m.memory_record_id AND v.revision_number=m.revision
     WHERE m.tenant_id=$1 AND m.scope_kind='relationship' AND m.scope_ref_id=$2
      AND m.lifecycle_state='active' AND (v.expires_at IS NULL OR v.expires_at>clock_timestamp())
     ORDER BY m.updated_at DESC,m.memory_record_id LIMIT 50`,[p.tenantId,o.relationship_id]):{rows:[]};
   await c.query("COMMIT");
   return {characterId:ch,enabled,revision:Number(revision),
     items:q.rows.map(x=>({id:x.memory_record_id,content:x.content,
       updatedAt:x.updated_at.toISOString(),expiresAt:x.expires_at?.toISOString()??null}))};
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 },
 async setEnabled(p:Fan,ch:string,enabled:boolean,expectedRevision:number){
  const c=await pool.connect();try{
   await c.query("BEGIN");const o=await owner(c,p,ch,true);
   if(!o||Number(o.revision)!==expectedRevision){await c.query("ROLLBACK");return null;}
   const r=await c.query<{revision:string}>(`INSERT INTO memory.fan_controls(tenant_id,relationship_id,enabled,revision)
     SELECT $1,$2,$3,1 WHERE $4=0
     ON CONFLICT(tenant_id,relationship_id) DO UPDATE SET
      enabled=EXCLUDED.enabled,revision=memory.fan_controls.revision+1,changed_at=clock_timestamp()
     WHERE memory.fan_controls.revision=$4 RETURNING revision::text`,
     [p.tenantId,o.relationship_id,enabled,expectedRevision]);
   if(!r.rows[0]){await c.query("ROLLBACK");return null;}
   await c.query(`INSERT INTO memory.fan_control_audit
    (tenant_id,relationship_id,revision,enabled,actor_user_id) VALUES($1,$2,$3,$4,$5)`,
    [p.tenantId,o.relationship_id,r.rows[0].revision,enabled,p.userId]);
   await c.query("COMMIT");
   return {characterId:ch,enabled,revision:Number(r.rows[0].revision),items:[]};
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 },
 async enqueueErase(p:Fan,ch:string,recordId:string|null,key:string){
  const c=await pool.connect();try{
   await c.query("BEGIN");const o=await owner(c,p,ch,true);
   if(!o){await c.query("ROLLBACK");return null;}
   // Identical replay returns the original receipt without a second consent revision.
   const prior=await c.query<{request_id:string;state:string;target_record_id:string|null}>(`
    SELECT request_id,state,target_record_id FROM memory.fan_erase_requests
    WHERE tenant_id=$1 AND relationship_id=$2 AND idempotency_key=$3 FOR UPDATE`,
    [p.tenantId,o.relationship_id,key]);
   if(prior.rows[0]){
    if(prior.rows[0].target_record_id!==recordId){await c.query("ROLLBACK");return null;}
    await c.query("COMMIT");
    return {requestId:prior.rows[0].request_id,state:prior.rows[0].state};
   }
   if(recordId){
    const r=await c.query(`SELECT 1 FROM memory.records WHERE tenant_id=$1 AND
      memory_record_id=$2 AND scope_kind='relationship' AND scope_ref_id=$3
      AND lifecycle_state='active' FOR UPDATE`,[p.tenantId,recordId,o.relationship_id]);
    if(r.rowCount!==1){await c.query("ROLLBACK");return null;}
   }
   if(recordId===null){
    await c.query(`INSERT INTO memory.fan_controls(tenant_id,relationship_id,enabled)
     VALUES($1,$2,false) ON CONFLICT(tenant_id,relationship_id) DO UPDATE
     SET enabled=false,revision=memory.fan_controls.revision+1,changed_at=clock_timestamp()`,
    [p.tenantId,o.relationship_id]);
    await c.query(`INSERT INTO memory.fan_control_audit(tenant_id,relationship_id,revision,enabled,actor_user_id)
     SELECT tenant_id,relationship_id,revision,false,$3 FROM memory.fan_controls
     WHERE tenant_id=$1 AND relationship_id=$2`,[p.tenantId,o.relationship_id,p.userId]);
   }
   const requestId=createCanonicalId("request");
   const r=await c.query<{request_id:string;state:string}>(`INSERT INTO memory.fan_erase_requests
    (tenant_id,request_id,relationship_id,actor_user_id,target_record_id,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(tenant_id,relationship_id,idempotency_key) DO UPDATE
    SET idempotency_key=EXCLUDED.idempotency_key
    WHERE memory.fan_erase_requests.target_record_id IS NOT DISTINCT FROM EXCLUDED.target_record_id
    RETURNING request_id,state`,
    [p.tenantId,requestId,o.relationship_id,p.userId,recordId,key]);
   if(!r.rows[0]){await c.query("ROLLBACK");return null;}
   // Atomic with the request: canonical events.outbox owns all retries and leases.
   await enqueueOutbox(c,{
    tenantId:parseCanonicalId("tenant",p.tenantId),eventId:createCanonicalId("event"),
    eventType:"fan_memory.erase_requested",schemaVersion:1,
    aggregateType:"fan_memory_erase",aggregateId:requestId,
    correlationId:createCanonicalId("correlation"),causationId:null,
    destination:"fan-memory-erase",availableAt:toInstant(new Date().toISOString()),
    payload:{tenantId:p.tenantId,requestId}
   });
   await c.query("COMMIT");
   return {requestId:r.rows[0].request_id,state:r.rows[0].state};
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }
 };
}

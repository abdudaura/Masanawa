import {createCanonicalId,parseCanonicalId,toInstant} from "@masanawa/contracts";
import {createMemoryRecord} from "../memory/repository.js";
import type {Pool,PoolClient} from "pg";
interface Candidate {content:string;category:string;messageId:string;confidence:number;sourceHash:string}
interface ExtractionPort {
 enabled(t:string,r:string):Promise<boolean>;
 commit(t:string,r:string,items:readonly Candidate[],ttlDays:180):Promise<number>;
}

/**
 * Inject a server-owned message ACL. Source IDs and hashes supplied by an LLM
 * are untrusted; the callback must verify the message belongs to this fan and Masana.
 */
export type SourceMessageFence=(client:PoolClient,tenant:string,relationship:string,
 messageId:string,sourceHash:string)=>Promise<boolean>;

export function createPostgresFanExtractionPort(pool:Pool,checkMessage:SourceMessageFence):ExtractionPort{
 return {
 async enabled(t:string,r:string):Promise<boolean>{
  const q=await pool.query(`SELECT 1 FROM identity.relationships rel
   JOIN identity.users fan ON fan.tenant_id=rel.tenant_id AND fan.user_id=rel.user_id
   JOIN identity.characters character ON character.tenant_id=rel.tenant_id
     AND character.character_id=rel.character_id
   JOIN memory.fan_controls consent ON consent.tenant_id=rel.tenant_id
     AND consent.relationship_id=rel.relationship_id
   WHERE rel.tenant_id=$1 AND rel.relationship_id=$2 AND rel.state='active'
     AND fan.state='active' AND character.state='active' AND consent.enabled=true`,
   [t,r]);return q.rowCount===1;
 },
 async commit(t:string,r:string,items:readonly Candidate[],ttlDays:180):Promise<number>{
  if(ttlDays!==180||items.length>8)throw new Error("Fan memory policy mismatch");
  const c=await pool.connect();try{
   await c.query("BEGIN");
   // Lock consent through the entire canonical memory insert; a concurrent
   // disable waits, and a disable that won the race refuses all model outputs.
   const consent=await c.query(`SELECT 1 FROM memory.fan_controls control
    JOIN identity.relationships rel ON rel.tenant_id=control.tenant_id
     AND rel.relationship_id=control.relationship_id
    JOIN identity.users fan ON fan.tenant_id=rel.tenant_id AND fan.user_id=rel.user_id
    JOIN identity.characters character ON character.tenant_id=rel.tenant_id
     AND character.character_id=rel.character_id
    WHERE control.tenant_id=$1 AND control.relationship_id=$2
     AND control.enabled=true AND rel.state='active' AND fan.state='active'
     AND character.state='active' FOR UPDATE OF control`,[t,r]);
   if(consent.rowCount!==1){await c.query("ROLLBACK");return 0;}
   let count=0;
   for(const i of items){
    if(!await checkMessage(c,t,r,i.messageId,i.sourceHash))continue;
    const old=await c.query(`SELECT 1 FROM memory.records m
     JOIN memory.revisions v ON v.tenant_id=m.tenant_id AND v.memory_record_id=m.memory_record_id
     JOIN memory.evidence e ON e.tenant_id=v.tenant_id AND e.memory_revision_id=v.memory_revision_id
     WHERE m.tenant_id=$1 AND m.scope_kind='relationship' AND m.scope_ref_id=$2
       AND m.lifecycle_state='active' AND e.source_kind='message' AND e.source_reference=$3
       LIMIT 1`,[t,r,i.messageId]);
    if(old.rowCount)continue;
    const now=toInstant(new Date().toISOString());
    const until=toInstant(new Date(Date.now()+180*24*60*60*1000).toISOString());
    await createMemoryRecord(c,{
     tenantId:parseCanonicalId("tenant",t),
     memoryRecordId:createCanonicalId("memory-record"),
     memoryRevisionId:createCanonicalId("memory-revision"),
     memoryType:"preference",scope:{kind:"relationship",relationshipId:parseCanonicalId("relationship",r)},
     createdAt:now,content:i.content,payload:{category:i.category},confidence:i.confidence,
     extractionMethod:"fan-memory-idle-v1",observedAt:now,expiresAt:until,
     evidence:[{sourceKind:"message",sourceReference:i.messageId,
       sourceContentHash:i.sourceHash,observedAt:now}]
    });
    count++;
   }
   await c.query("COMMIT");return count;
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }
 };
}

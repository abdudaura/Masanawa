import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
type Job={tenantId:string;runId:string;characterId:string;revision:number;mode:'chat'|'post'|'call';prompt:string;attempt:number;leaseToken:string;draftProfile:unknown};
async function tx<T>(pool:Pool,f:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();try{await c.query('BEGIN');const v=await f(c);await c.query('COMMIT');return v}
 catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
export function createMasanaRehearsalStore(pool:Pool) {
 return {
 async enqueue(i:{tenantId:string;staffId:string;characterId:string;revision:number;mode:'chat'|'post'|'call';prompt:string;idempotencyKey:string}){
  return tx(pool,async c=>{
   const draft=await c.query("SELECT 1 FROM masana.character_revisions r JOIN identity.characters ch USING(tenant_id,character_id) JOIN identity.character_ownership o USING(tenant_id,character_id) WHERE r.tenant_id=$1 AND r.character_id=$2 AND r.revision=$3 AND r.state='draft' AND ch.state='active' AND o.kind='platform' FOR SHARE OF r",[i.tenantId,i.characterId,i.revision]);
   if(!draft.rowCount)throw Object.assign(new Error('draft_not_available'),{statusCode:409});
   const runId='rehearsal_'+randomUUID();
   const inserted=await c.query("INSERT INTO masana.rehearsal_runs(tenant_id,run_id,character_id,revision,staff_id,mode,prompt,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id,staff_id,idempotency_key) DO NOTHING RETURNING run_id",[i.tenantId,runId,i.characterId,i.revision,i.staffId,i.mode,i.prompt,i.idempotencyKey]);
   if(!inserted.rowCount){
    const p=(await c.query("SELECT run_id,state,character_id,revision,mode,prompt FROM masana.rehearsal_runs WHERE tenant_id=$1 AND staff_id=$2 AND idempotency_key=$3",[i.tenantId,i.staffId,i.idempotencyKey])).rows[0];
    if(!p||p.character_id!==i.characterId||Number(p.revision)!==i.revision||p.mode!==i.mode||p.prompt!==i.prompt)throw Object.assign(new Error('idempotency_conflict'),{statusCode:409});
    return {runId:p.run_id as string,state:p.state as string,reused:true};
   }
   const eid=randomUUID();
   await c.query("INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload) VALUES($1,$2,$3,'masana.rehearsal_requested',1,'masana',$4,$5,'masana.rehearsals',$6::jsonb)",['outbox-event_'+eid,i.tenantId,'event_'+eid,runId,'correlation_'+eid,JSON.stringify({tenantId:i.tenantId,runId})]);
   await c.query("INSERT INTO events.audit_events(audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload) VALUES($1,$2,'masana.rehearsal_requested',1,'masana',$3,now(),$4::jsonb,$5,'internal',$6::jsonb)",['audit-event_'+eid,i.tenantId,runId,JSON.stringify({staffId:i.staffId}),'correlation_'+eid,JSON.stringify({characterId:i.characterId,revision:i.revision,mode:i.mode})]);
   return {runId,state:'queued',reused:false};
  });
 },
 async read(i:{tenantId:string;staffId:string;characterId:string;runId:string}){
  const x=await pool.query('SELECT run_id AS "runId",state,mode,revision,preview,error_code AS "errorCode" FROM masana.rehearsal_runs WHERE tenant_id=$1 AND staff_id=$2 AND character_id=$3 AND run_id=$4',[i.tenantId,i.staffId,i.characterId,i.runId]);
  return x.rows[0]??null;
 },
 async claim(tenantId:string,runId:string):Promise<Job|null>{
  const token='lease_'+randomUUID();
  const x=await pool.query("UPDATE masana.rehearsal_runs q SET state='running',attempt=q.attempt+1,lease_token=$3,lease_until=now()+interval '90 seconds',updated_at=now() FROM masana.character_revisions r WHERE q.tenant_id=$1 AND q.run_id=$2 AND r.tenant_id=q.tenant_id AND r.character_id=q.character_id AND r.revision=q.revision AND r.state='draft' AND q.attempt<3 AND (q.state='queued' OR(q.state='running' AND q.lease_until<now())) RETURNING q.tenant_id,q.run_id,q.character_id,q.revision,q.mode,q.prompt,q.attempt,q.lease_token,r.profile",[tenantId,runId,token]);
  const v=x.rows[0];return v?{tenantId:v.tenant_id,runId:v.run_id,characterId:v.character_id,revision:Number(v.revision),mode:v.mode,prompt:v.prompt,attempt:Number(v.attempt),leaseToken:v.lease_token,draftProfile:v.profile}:null;
 },
 async complete(i:Job,preview:{summary:string;previewText:string;audioMediaId?:string}){
  const r=await pool.query("UPDATE masana.rehearsal_runs SET state='succeeded',preview=$4::jsonb,lease_token=NULL,lease_until=NULL,error_code=NULL,updated_at=now() WHERE tenant_id=$1 AND run_id=$2 AND lease_token=$3 AND state='running' AND lease_until>=now()",[i.tenantId,i.runId,i.leaseToken,JSON.stringify(preview)]);
  return r.rowCount===1;
 },
 async fail(i:Job,code:'runner_unavailable'|'voice_not_qualified'|'rehearsal_failed'){
  await pool.query("UPDATE masana.rehearsal_runs SET state=CASE WHEN attempt>=3 OR $4='voice_not_qualified' THEN 'failed' ELSE 'queued' END,error_code=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND run_id=$2 AND lease_token=$3 AND state='running'",[i.tenantId,i.runId,i.leaseToken,code]);
 }
 };
}
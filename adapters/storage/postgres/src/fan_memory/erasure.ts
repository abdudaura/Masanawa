import type {Pool} from "pg";
import {claimOutboxBatch,settleOutboxClaim,type ClaimedOutboxRecord} from "../events/outbox.js";
export interface FanEraseJob{tenantId:string;requestId:string;relationshipId:string;targetRecordId:string|null}
type ApprovedTombstone=(job:FanEraseJob,recordId:string)=>Promise<boolean>;
/** Uses the existing events.outbox claim/fence and the existing approved memory tombstone.
 * No SQL DELETE or fabricated approval is permitted.
 */
export function createPostgresFanErasurePort(pool:Pool,workerId:string,approved:ApprovedTombstone){
 let lease:ClaimedOutboxRecord<{requestId:string;tenantId:string}>|null=null;
 function fence(job:FanEraseJob){
  if(!lease||job.tenantId!==lease.tenantId||job.requestId!==lease.payload.requestId)
   throw new Error("Stale fan-memory erase lease");
  return lease;
 }
 async function settle(job:FanEraseJob,mode:"completed"|"needs_review"){
  const record=fence(job);const c=await pool.connect();
  try{
   await c.query("BEGIN");
   const request=await c.query(`SELECT 1 FROM memory.fan_erase_requests
    WHERE tenant_id=$1 AND request_id=$2 AND relationship_id=$3 FOR UPDATE`,
    [job.tenantId,job.requestId,job.relationshipId]);
   if(request.rowCount!==1)throw new Error("Fan erase request missing");
   if(mode==="completed"){
    const remaining=await c.query(`SELECT 1 FROM memory.records WHERE tenant_id=$1
     AND scope_kind='relationship' AND scope_ref_id=$2 AND lifecycle_state='active'
     AND ($3::text IS NULL OR memory_record_id=$3) LIMIT 1`,
     [job.tenantId,job.relationshipId,job.targetRecordId]);
    if(remaining.rowCount)throw new Error("Cannot complete erasure with active records");
   }
   await c.query(`UPDATE memory.fan_erase_requests SET state=$4,
    resolved_at=CASE WHEN $4='completed' THEN clock_timestamp() ELSE NULL END
    WHERE tenant_id=$1 AND request_id=$2 AND relationship_id=$3`,
    [job.tenantId,job.requestId,job.relationshipId,mode]);
   await settleOutboxClaim(c,{outboxEventId:record.outboxEventId,
    workerId,fence:record.fence,state:mode==="completed"?"acknowledged":"unknown",
    ...(mode==="needs_review"?{safeErrorCode:"fan_memory_approval_required"}:{})});
   await c.query("COMMIT");lease=null;
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }
 return {
 async claim():Promise<FanEraseJob|null>{
  if(lease)throw new Error("Outstanding erase lease");
  const events=await claimOutboxBatch(pool,{workerId,destination:"fan-memory-erase",limit:1,leaseMs:60000});
  const x=events[0] as ClaimedOutboxRecord<{tenantId:string;requestId:string}>|undefined;
  if(!x)return null;lease=x;
  if(!x.payload||x.payload.tenantId!==x.tenantId||typeof x.payload.requestId!=="string")
   throw new Error("Invalid fan-memory erase event");
  const r=await pool.query<{relationship_id:string;target_record_id:string|null}>(`
   SELECT relationship_id,target_record_id FROM memory.fan_erase_requests
    WHERE tenant_id=$1 AND request_id=$2 AND state IN ('queued','applying','needs_review')`,
    [x.tenantId,x.payload.requestId]);
  if(!r.rows[0])throw new Error("Fan-memory erase request unavailable");
  return {tenantId:x.tenantId,requestId:x.payload.requestId,
    relationshipId:r.rows[0].relationship_id,targetRecordId:r.rows[0].target_record_id};
 },
 async scopedActive(job:FanEraseJob):Promise<readonly string[]>{
  fence(job);
  const r=await pool.query<{memory_record_id:string}>(`SELECT memory_record_id FROM memory.records
   WHERE tenant_id=$1 AND scope_kind='relationship' AND scope_ref_id=$2
   AND lifecycle_state='active' ORDER BY memory_record_id LIMIT 501`,
   [job.tenantId,job.relationshipId]);
  if(r.rows.length>500)throw new Error("Large erasure needs supervised batch");
  return r.rows.map(x=>x.memory_record_id);
 },
 async approvedTombstone(job:FanEraseJob,id:string):Promise<boolean>{
  fence(job);
  const r=await pool.query(`SELECT 1 FROM memory.records WHERE tenant_id=$1
   AND memory_record_id=$2 AND scope_kind='relationship' AND scope_ref_id=$3`,
   [job.tenantId,id,job.relationshipId]);
  if(r.rowCount!==1)throw new Error("Refused cross-relationship erasure");
  return approved(job,id);
 },
 complete:(job:FanEraseJob)=>settle(job,"completed"),
 needsReview:(job:FanEraseJob)=>settle(job,"needs_review"),
 };
}

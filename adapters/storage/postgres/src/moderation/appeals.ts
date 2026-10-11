import type {Pool} from "pg";
import type {AppealRecord} from "@masanawa/moderation";
import {CaseError} from "@masanawa/moderation";

type AppealRow = {
 tenant_id:string; appeal_id:string; case_id:string; appellant_user_id:string;
 reason:string; state:AppealRecord["state"]; reviewed_by:string|null;
 second_reviewed_by:string|null; version:number; created_at:Date;
};
function mapped(r:AppealRow):AppealRecord{
 return {tenantId:r.tenant_id,appealId:r.appeal_id,caseId:r.case_id,
 appellantUserId:r.appellant_user_id,reason:r.reason,state:r.state,
 reviewedBy:r.reviewed_by,secondReviewedBy:r.second_reviewed_by,
 version:r.version,createdAt:r.created_at.toISOString()};
}
/** Two distinct staff approvals are required to uphold an appeal that can reverse an action.
 * A single staff rejection never directly rolls back external enforcement. All approved
 * reversals are dispatched by the already-existing events.outbox worker.
 */
export function createPostgresAppealReview(pool:Pool){
 return async function resolveAppeal(tenantId:string,caseId:string,appealId:string,
 reviewerId:string,uphold:boolean,expectedVersion:number):Promise<AppealRecord> {
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const found=await client.query<AppealRow>(
    "SELECT * FROM moderation.appeals WHERE tenant_id=$1 AND case_id=$2 AND appeal_id=$3 FOR UPDATE",
    [tenantId,caseId,appealId]);
   const previous=found.rows[0];
   if(!previous)throw new CaseError("moderation.appeal_not_found",404);
   if(previous.version!==expectedVersion||
    !["pending","under_review"].includes(previous.state))
    throw new CaseError("moderation.appeal_conflict",409);
   if(previous.appellant_user_id===reviewerId||previous.reviewed_by===reviewerId)
    throw new CaseError("moderation.self_approval_forbidden",403);
   // Second approver may not overturn a first reviewer without escalating.
   if(previous.reviewed_by!==null&&!uphold)throw new CaseError("moderation.appeal_decision_conflict",409);
   const second=uphold&&previous.reviewed_by!==null?reviewerId:null;
   const state=uphold?(second?"upheld":"under_review"):"rejected";
   const saved=await client.query<AppealRow>(
    `UPDATE moderation.appeals SET state=$4,reviewed_by=$5,second_reviewed_by=$6,
     version=version+1,reviewed_at=now()
     WHERE tenant_id=$1 AND case_id=$2 AND appeal_id=$3 RETURNING *`,
    [tenantId,caseId,appealId,state,previous.reviewed_by??reviewerId,second]);
   await client.query(
    `INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [tenantId,"evt_"+appealId+"_"+(expectedVersion+1),caseId,reviewerId,
      state==="upheld"?"appeal_upheld":state==="rejected"?"appeal_rejected":"appeal_under_review",
      "version "+(expectedVersion+1)]);
   if(state==="upheld"){
    await client.query(
     "UPDATE moderation.cases SET state='investigating',version=version+1,updated_at=now() "+
     "WHERE tenant_id=$1 AND case_id=$2",[tenantId,caseId]);
    const applied=await client.query<{action_id:string}>(
     "SELECT action_id FROM moderation.actions WHERE tenant_id=$1 AND case_id=$2 AND state='applied' FOR UPDATE",
     [tenantId,caseId]);
    for(const a of applied.rows){
     // Same outbox authority. A failed external reversal keeps action applied until successful receipt.
     const suffix=appealId+"_"+a.action_id;
     await client.query(
      `INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,
       schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload)
       VALUES($1,$2,$3,'moderation.action.appeal_reversal',1,'moderation.action',$4,$5,
       'moderation.action.reverse',$6::jsonb) ON CONFLICT(outbox_event_id) DO NOTHING`,
      ["outbox-event_appeal_"+suffix,tenantId,"event_appeal_"+suffix,
       a.action_id,"correlation_appeal_"+appealId,
       JSON.stringify({tenantId,caseId,actionId:a.action_id,appealId})]);
    }
   }
   if(state==="rejected"){
    await client.query(
     "UPDATE moderation.cases SET state='closed',version=version+1,updated_at=now() "+
     "WHERE tenant_id=$1 AND case_id=$2",[tenantId,caseId]);
   }
   await client.query("COMMIT");
   return mapped(saved.rows[0]!);
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}
  finally{client.release();}
 };
}

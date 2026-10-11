import type {Pool,PoolClient} from "pg";
import type {CaseRecord,CaseEvent,ActionRecord,CaseTarget,CaseCategory,CaseState,ActionKind,AppealRecord,CaseEvidence} from "@masanawa/moderation";
import {CaseError,decisionRequiredApprovals} from "@masanawa/moderation";
import {createPostgresAppealReview} from "./appeals.js";
type CaseRow={tenant_id:string;case_id:string;reporter_user_id:string;target_kind:CaseTarget;target_id:string;category:CaseCategory;details:string;state:CaseState;version:number;created_at:Date;updated_at:Date;sla_due_at:Date;client_request_id:string};
type EventRow={event_id:string;case_id:string;actor_id:string;kind:string;detail:string;created_at:Date};
type ActionRow={tenant_id:string;action_id:string;case_id:string;target_kind:CaseTarget;target_id:string;kind:ActionKind;state:ActionRecord["state"];reason:string;proposed_by:string;approved_by:string|null;second_approved_by:string|null;expires_at:Date|null;version:number};
function mapped(row:CaseRow):CaseRecord{return {tenantId:row.tenant_id,caseId:row.case_id,reporterUserId:row.reporter_user_id,targetKind:row.target_kind,targetId:row.target_id,category:row.category,details:row.details,state:row.state,version:row.version,slaDueAt:row.sla_due_at.toISOString(),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()};}
function event(row:EventRow):CaseEvent{return {eventId:row.event_id,caseId:row.case_id,actorId:row.actor_id,type:row.kind,details:row.detail,createdAt:row.created_at.toISOString()};}
function action(row:ActionRow):ActionRecord{return {tenantId:row.tenant_id,actionId:row.action_id,caseId:row.case_id,targetKind:row.target_kind,targetId:row.target_id,kind:row.kind,state:row.state,reason:row.reason,proposedBy:row.proposed_by,approvedBy:row.approved_by,secondApprovedBy:row.second_approved_by,expiresAt:row.expires_at?.toISOString()??null,version:row.version};}
async function transaction<T>(pool:Pool,work:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();try{await c.query("BEGIN");const result=await work(c);await c.query("COMMIT");return result;}catch(e){await c.query("ROLLBACK").catch(()=>undefined);throw e;}finally{c.release();}
}
export function createPostgresCaseRepository(pool:Pool){
 return {
  async create(record:CaseRecord & {clientRequestId:string}):Promise<CaseRecord>{
   return transaction(pool,async c=>{
    const rs=await c.query<CaseRow>(`INSERT INTO moderation.cases
     (tenant_id,case_id,reporter_user_id,target_kind,target_id,category,details,client_request_id,state,version,sla_due_at,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT(tenant_id,reporter_user_id,client_request_id) DO NOTHING RETURNING *`,
     [record.tenantId,record.caseId,record.reporterUserId,record.targetKind,record.targetId,record.category,record.details,record.clientRequestId,record.state,record.version,record.slaDueAt,record.createdAt,record.updatedAt]);
    let row=rs.rows[0];
    if(!row){const existing=await c.query<CaseRow>(`SELECT * FROM moderation.cases WHERE tenant_id=$1 AND reporter_user_id=$2 AND client_request_id=$3`,
      [record.tenantId,record.reporterUserId,record.clientRequestId]);row=existing.rows[0];}
    if(!row)throw new CaseError("moderation.create_conflict",409);
    if(row.target_kind!==record.targetKind||row.target_id!==record.targetId||row.category!==record.category||row.details!==record.details)
     throw new CaseError("moderation.idempotency_conflict",409);
    if(row.case_id===record.caseId)await c.query(`INSERT INTO moderation.evidence_refs(
      tenant_id,evidence_id,case_id,source_kind,source_id,submitted_by)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [record.tenantId,"evidence_"+record.caseId,record.caseId,record.targetKind,record.targetId,record.reporterUserId]);
    if(row.case_id===record.caseId)await c.query(`INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail) VALUES($1,$2,$3,$4,'opened','')`,
     [record.tenantId,"evt_"+record.caseId,record.caseId,record.reporterUserId]);
    return mapped(row);
   });
  },
  async find(tenantId:string,caseId:string){
   return transaction(pool,async c=>{
    const rs=await c.query<CaseRow>(`SELECT * FROM moderation.cases WHERE tenant_id=$1 AND case_id=$2`,[tenantId,caseId]);
    const row=rs.rows[0];if(!row)return null;
    const events=await c.query<EventRow>(`SELECT * FROM moderation.case_events WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at,event_id`,[tenantId,caseId]);
    const evidence=await c.query<{evidence_id:string;source_kind:CaseTarget;source_id:string;submitted_by:string;created_at:Date}>(`
     SELECT evidence_id,source_kind,source_id,submitted_by,created_at FROM moderation.evidence_refs
     WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at,evidence_id`,[tenantId,caseId]);
    const actions=await c.query<ActionRow>(`SELECT * FROM moderation.actions WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at,action_id`,[tenantId,caseId]);
    const appeals=await c.query<{tenant_id:string;appeal_id:string;case_id:string;appellant_user_id:string;reason:string;state:AppealRecord["state"];reviewed_by:string|null;second_reviewed_by:string|null;version:number;created_at:Date}>(
       "SELECT * FROM moderation.appeals WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at,appeal_id",[tenantId,caseId]);
    return {...mapped(row),events:events.rows.map(event),actions:actions.rows.map(action),
      evidence:evidence.rows.map((e):CaseEvidence=>({evidenceId:e.evidence_id,sourceKind:e.source_kind,
       sourceId:e.source_id,submittedBy:e.submitted_by,createdAt:e.created_at.toISOString()})),
      appeals:appeals.rows.map(a=>({tenantId:a.tenant_id,appealId:a.appeal_id,caseId:a.case_id,appellantUserId:a.appellant_user_id,
       reason:a.reason,state:a.state,reviewedBy:a.reviewed_by,secondReviewedBy:a.second_reviewed_by,version:a.version,
       createdAt:a.created_at.toISOString()}))};
   });
  },
  async list(tenantId:string,reporterId:string|null,limit:number){
   const rs=await pool.query<CaseRow>(`SELECT * FROM moderation.cases
     WHERE tenant_id=$1 AND ($2::text IS NULL OR reporter_user_id=$2)
     ORDER BY sla_due_at,created_at,case_id LIMIT $3`,[tenantId,reporterId,Math.min(100,Math.max(1,limit))]);
   return rs.rows.map(mapped);
  },
  async propose(input:ActionRecord,expectedCaseVersion:number){
   return transaction(pool,async c=>{
    const found=await c.query<CaseRow>(`SELECT * FROM moderation.cases WHERE tenant_id=$1 AND case_id=$2 FOR UPDATE`,[input.tenantId,input.caseId]);
    const rec=found.rows[0];if(!rec)throw new CaseError("moderation.not_found",404);
    if(rec.version!==expectedCaseVersion)throw new CaseError("moderation.version_conflict",409);
    if(["closed","dismissed"].includes(rec.state))throw new CaseError("moderation.case_closed",409);
    if(rec.target_id!==input.targetId||rec.target_kind!==input.targetKind)throw new CaseError("moderation.target_changed",409);
    const rs=await c.query<ActionRow>(`INSERT INTO moderation.actions
     (tenant_id,action_id,case_id,target_kind,target_id,kind,state,reason,proposed_by,expires_at,version)
     VALUES($1,$2,$3,$4,$5,$6,'proposed',$7,$8,$9,1) RETURNING *`,
     [input.tenantId,input.actionId,input.caseId,input.targetKind,input.targetId,input.kind,input.reason,input.proposedBy,input.expiresAt]);
    await c.query(`UPDATE moderation.cases SET state='awaiting_review',version=version+1,updated_at=now() WHERE tenant_id=$1 AND case_id=$2`,[input.tenantId,input.caseId]);
    await c.query(`INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail) VALUES($1,$2,$3,$4,'action_proposed',$5)`,
     [input.tenantId,"evt_"+input.actionId,input.caseId,input.proposedBy,input.kind]);
    return action(rs.rows[0]!);
   });
  },
  async review(tenantId:string,caseId:string,actionId:string,reviewerId:string,approve:boolean,expectedVersion:number){
   return transaction(pool,async c=>{
    const rs=await c.query<ActionRow>(`SELECT * FROM moderation.actions WHERE tenant_id=$1 AND case_id=$2 AND action_id=$3 FOR UPDATE`,[tenantId,caseId,actionId]);
    const row=rs.rows[0];if(!row)throw new CaseError("moderation.action_not_found",404);
    if(row.version!==expectedVersion||row.state!=="proposed")throw new CaseError("moderation.action_conflict",409);
    if(row.proposed_by===reviewerId||row.approved_by===reviewerId)throw new CaseError("moderation.self_approval_forbidden",403);
    const first=approve?(row.approved_by??reviewerId):row.approved_by;
    const second=approve && row.approved_by!==null?reviewerId:null;
    const finalApproval=approve && (decisionRequiredApprovals(row.kind)===1||second!==null);
    const nextState=approve?(finalApproval?"approved":"proposed"):"rejected";
    const updated=await c.query<ActionRow>(`UPDATE moderation.actions
      SET approved_by=$4,second_approved_by=$5,state=$6,version=version+1,updated_at=now()
      WHERE tenant_id=$1 AND case_id=$2 AND action_id=$3 RETURNING *`,
      [tenantId,caseId,actionId,first,second,nextState]);
    await c.query(`INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail)
      VALUES($1,$2,$3,$4,$5,$6)`,[tenantId,`evt_${actionId}_${expectedVersion+1}`,caseId,reviewerId,
       approve?"action_approved":"action_rejected",nextState]);
    if(!approve){
      const others=await c.query(
       "SELECT 1 FROM moderation.actions WHERE tenant_id=$1 AND case_id=$2 "+
       "AND action_id<>$3 AND state IN ('proposed','approved','applied') LIMIT 1",
       [tenantId,caseId,actionId]);
      if(!others.rowCount){
       await c.query(
        "UPDATE moderation.cases SET state='investigating',version=version+1,updated_at=now() "+
        "WHERE tenant_id=$1 AND case_id=$2",[tenantId,caseId]);
      }
    }
    if(finalApproval){
     await c.query(
      "INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload) "+
      "VALUES($1,$2,$3,'moderation.action.approved',1,'moderation.action',$4,$5,'moderation.action.apply',$6::jsonb) "+
      "ON CONFLICT(outbox_event_id) DO NOTHING",
      ["outbox-event_"+actionId,tenantId,"event_"+actionId,actionId,"correlation_"+actionId,
       JSON.stringify({actionId,caseId,tenantId})]);
    }
    return action(updated.rows[0]!);
   });
  },
  resolveAppeal:createPostgresAppealReview(pool),
  async dismiss(tenantId:string,caseId:string,actorId:string,reason:string,expectedVersion:number){
   return transaction(pool,async c=>{
    const rec=await c.query<CaseRow>(
     "SELECT * FROM moderation.cases WHERE tenant_id=$1 AND case_id=$2 FOR UPDATE",[tenantId,caseId]);
    const old=rec.rows[0];
    if(!old)throw new CaseError("moderation.not_found",404);
    if(old.version!==expectedVersion || !["open","investigating"].includes(old.state))
      throw new CaseError("moderation.case_conflict",409);
    const pending=await c.query(
     "SELECT 1 FROM moderation.actions WHERE tenant_id=$1 AND case_id=$2 AND state IN ('proposed','approved','applied') LIMIT 1",
     [tenantId,caseId]);
    if(pending.rowCount)throw new CaseError("moderation.pending_action",409);
    const next=await c.query<CaseRow>(
     "UPDATE moderation.cases SET state='dismissed',version=version+1,updated_at=now() WHERE tenant_id=$1 AND case_id=$2 RETURNING *",
     [tenantId,caseId]);
    await c.query(`INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail)
      VALUES($1,$2,$3,$4,'dismissed',$5)`,
     [tenantId,"evt_dismissed_"+caseId+"_"+(expectedVersion+1),caseId,actorId,reason]);
    return mapped(next.rows[0]!);
   });
  },
  async appeal(tenantId:string,caseId:string,appealId:string,actorId:string,reason:string,clientRequestId:string){
   await transaction(pool,async c=>{
    // Serialize retries and concurrent appeal submissions through the existing case lock.
    const rs=await c.query<CaseRow>(
     "SELECT * FROM moderation.cases WHERE tenant_id=$1 AND case_id=$2 FOR UPDATE",[tenantId,caseId]);
    const rec=rs.rows[0];
    if(!rec||rec.reporter_user_id!==actorId)throw new CaseError("moderation.not_found",404);
    const replay=await c.query<{reason:string}>(
     "SELECT reason FROM moderation.appeals WHERE tenant_id=$1 AND case_id=$2 AND appellant_user_id=$3 AND client_request_id=$4",
     [tenantId,caseId,actorId,clientRequestId]);
    if(replay.rows[0]){
     if(replay.rows[0].reason!==reason)throw new CaseError("moderation.idempotency_conflict",409);
     return; // no second appeal, event, case transition or reversal
    }
    if(!["actioned","dismissed","closed"].includes(rec.state))
     throw new CaseError("moderation.appeal_not_ready",409);
    const pending=await c.query(
     "SELECT 1 FROM moderation.appeals WHERE tenant_id=$1 AND case_id=$2 AND state IN ('pending','under_review')",
     [tenantId,caseId]);
    if(pending.rowCount)throw new CaseError("moderation.appeal_pending",409);
    await c.query(
     "INSERT INTO moderation.appeals(tenant_id,appeal_id,case_id,appellant_user_id,reason,client_request_id) VALUES($1,$2,$3,$4,$5,$6)",
     [tenantId,appealId,caseId,actorId,reason,clientRequestId]);
    await c.query(
     "UPDATE moderation.cases SET state='appealed',version=version+1,updated_at=now() WHERE tenant_id=$1 AND case_id=$2",
     [tenantId,caseId]);
    await c.query(
     "INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail) VALUES($1,$2,$3,$4,'appealed','')",
     [tenantId,"evt_"+appealId,caseId,actorId]);
   });
  }
 };
}

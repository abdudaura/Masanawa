import type {Pool,PoolClient} from "pg";
/** Single events.outbox authority; ACK happens inside the same transaction as case transition. */
async function transact<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();
 try{await c.query("BEGIN");const value=await fn(c);await c.query("COMMIT");return value;}
 catch(error){await c.query("ROLLBACK").catch(()=>undefined);throw error;}
 finally{c.release();}
}
type DeliveryInput={tenantId:string;actionId:string;operationId:string;fence:number;evidenceId:string};
export function createPostgresModerationDeliveryRepository(pool:Pool){
 async function finish(input:DeliveryInput,reverse:boolean):Promise<boolean> {
  if(!Number.isSafeInteger(input.fence)||input.fence<1)return false;
  const destination=reverse?"moderation.action.reverse":"moderation.action.apply";
  return transact(pool,async c=>{
   const job=await c.query<{fence:string;state:string;payload:{actionId:string};destination:string;lease_expires_at:Date|null}>(`SELECT fence::text,state,payload,destination,lease_expires_at
     FROM events.outbox WHERE tenant_id=$1 AND outbox_event_id=$2 FOR UPDATE`,
     [input.tenantId,input.operationId]);
   const row=job.rows[0];
   if(!row||row.state!=="claimed"||row.fence!==String(input.fence)||
       row.destination!==destination||row.payload?.actionId!==input.actionId||
       !row.lease_expires_at||row.lease_expires_at.getTime()<=Date.now())return false;
   const state=reverse?"applied":"approved",next=reverse?"reversed":"applied";
   const result=await c.query<{case_id:string;expires_at:Date|null}>(`UPDATE moderation.actions
     SET state=$3,version=version+1,updated_at=now()
     WHERE tenant_id=$1 AND action_id=$2 AND state=$4
     RETURNING case_id,expires_at`,
     [input.tenantId,input.actionId,next,state]);
   const action=result.rows[0];if(!action)return false;
   await c.query(`UPDATE moderation.cases SET state=$3,version=version+1,updated_at=now()
      WHERE tenant_id=$1 AND case_id=$2`,
     [input.tenantId,action.case_id,reverse?"closed":"actioned"]);
   await c.query(`INSERT INTO moderation.case_events(tenant_id,event_id,case_id,actor_id,kind,detail)
      VALUES($1,$2,$3,'moderation-worker',$4,$5)`,
     [input.tenantId,"evt_"+(reverse?"reversed_":"applied_")+input.actionId,
       action.case_id,reverse?"action_reversed":"action_applied",input.evidenceId]);
   // Expiry uses the SAME durable outbox, never a process-local timer.
   if(!reverse&&action.expires_at){
     await c.query(`INSERT INTO events.outbox(outbox_event_id,tenant_id,event_id,event_type,
       schema_version,aggregate_type,aggregate_id,correlation_id,destination,available_at,payload)
       VALUES($1,$2,$3,'moderation.action.expire',1,'moderation.action',$4,$5,
        'moderation.action.reverse',$6,$7::jsonb)
       ON CONFLICT(outbox_event_id) DO NOTHING`,
       ["outbox-event_expire_"+input.actionId,input.tenantId,"event_expire_"+input.actionId,
         input.actionId,"correlation_"+input.actionId,action.expires_at,
         JSON.stringify({tenantId:input.tenantId,actionId:input.actionId})]);
   }
   await c.query(`UPDATE events.outbox SET state='acknowledged',terminal_receipt_ref=$3,
     updated_at=now() WHERE tenant_id=$1 AND outbox_event_id=$2`,
     [input.tenantId,input.operationId,input.evidenceId]);
   return true;
  });
 }
 return Object.freeze({
  acknowledge:(input:DeliveryInput)=>finish(input,false),
  acknowledgeReversal:(input:DeliveryInput)=>finish(input,true),
 });
}

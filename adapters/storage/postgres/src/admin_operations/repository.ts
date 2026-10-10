import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { AuditRecord, FlagMutation, FlagSnapshot, OperationsFlag, OperationsRepository } from "../../../../../services/gateway/src/modules/admin_operations/service.js";
import { FLAG_NAMES, OperationsError } from "../../../../../services/gateway/src/modules/admin_operations/service.js";
type Row={flag_name:OperationsFlag;enabled:boolean;revision:string|number;changed_at:Date|string|null};
function fromRow(row:Row):FlagSnapshot {return {name:row.flag_name,enabled:row.enabled,revision:Number(row.revision),updatedAt:row.changed_at ? new Date(row.changed_at).toISOString():null};}
async function transaction<T>(pool:Pool, fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool.connect();try{await c.query("BEGIN");const output=await fn(c);await c.query("COMMIT");return output;}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
/** Always supply a server-verified tenant ID. No client-controlled tenant column accepted. */
export function createPostgresOperationsRepository(pool:Pool): OperationsRepository {
 return {
  async listFlags(tenantId){
   const rows=await pool.query<Row>("SELECT flag_name,enabled,revision,changed_at FROM admin_operations.flags WHERE tenant_id=$1",[tenantId]);
   const found=new Map(rows.rows.map(row=>[row.flag_name,fromRow(row)]));
   return FLAG_NAMES.map(name=>found.get(name)??{name,enabled:false,revision:0,updatedAt:null});
  },
  async setFlag(input){
   return transaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`ops:${input.tenantId}:${input.name}:${input.actorId}`]);
    // Unique request keys are scoped per staff actor. Disallow reusing a key for a different request.
    const prior=await client.query<{flag_name:string;requested_enabled:boolean;expected_revision:string;reason:string;result_revision:string}>(
      "SELECT flag_name,requested_enabled,expected_revision,reason,result_revision FROM admin_operations.flag_requests WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3 FOR UPDATE",
      [input.tenantId,input.actorId,input.idempotencyKey]);
    if(prior.rows[0]){
      const x=prior.rows[0];if(x.flag_name!==input.name || x.requested_enabled!==input.enabled || Number(x.expected_revision)!==input.expectedRevision || x.reason!==input.reason) throw new OperationsError("conflict",409);
      const snap=await client.query<Row>("SELECT flag_name,enabled,revision,changed_at FROM admin_operations.flags WHERE tenant_id=$1 AND flag_name=$2",[input.tenantId,input.name]);
      const current=snap.rows[0];if(!current) throw new OperationsError("unavailable",503);
      // Do not falsely claim replay's original snapshot if later changes exist.
      return fromRow(current);
    }
    await client.query("INSERT INTO admin_operations.flags(tenant_id,flag_name) VALUES($1,$2) ON CONFLICT DO NOTHING",[input.tenantId,input.name]);
    const current=await client.query<Row>("SELECT flag_name,enabled,revision,changed_at FROM admin_operations.flags WHERE tenant_id=$1 AND flag_name=$2 FOR UPDATE",[input.tenantId,input.name]);
    const row=current.rows[0];if(!row) throw new OperationsError("unavailable",503);
    if(Number(row.revision)!==input.expectedRevision) throw new OperationsError("conflict",409);
    // No-op still writes a durable audit and consumes exactly one revision.
    const next=await client.query<Row>("UPDATE admin_operations.flags SET enabled=$3,revision=revision+1,changed_by=$4,changed_at=NOW() WHERE tenant_id=$1 AND flag_name=$2 RETURNING flag_name,enabled,revision,changed_at",[input.tenantId,input.name,input.enabled,input.actorId]);
    const updated=next.rows[0];if(!updated) throw new OperationsError("unavailable",503);
    await client.query("INSERT INTO admin_operations.flag_requests(tenant_id,actor_id,request_key,flag_name,expected_revision,requested_enabled,reason,result_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[input.tenantId,input.actorId,input.idempotencyKey,input.name,input.expectedRevision,input.enabled,input.reason,updated.revision]);
    await client.query("INSERT INTO admin_operations.audit(tenant_id,event_id,actor_id,action,subject,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[input.tenantId,randomUUID(),input.actorId,"flag.change",input.name,JSON.stringify({before:row.enabled,after:input.enabled,reason:input.reason,revision:updated.revision})]);
    return fromRow(updated);
   });
  },
  async audit(tenantId,limit) {
   const result=await pool.query<{event_id:string;action:string;actor_id:string;created_at:Date|string;subject:string}>("SELECT event_id,action,actor_id,created_at,subject FROM admin_operations.audit WHERE tenant_id=$1 ORDER BY created_at DESC,event_id DESC LIMIT $2",[tenantId,limit]);
   return result.rows.map(row=>({eventId:row.event_id,action:row.action,actorId:row.actor_id,at:new Date(row.created_at).toISOString(),subject:row.subject} satisfies AuditRecord));
  }
 };
}

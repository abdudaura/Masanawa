import { createCanonicalId } from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
// Deliberately structural: the canonical module adapter is wired by AF00 to avoid a
// cross-project TypeScript build dependency before workspace contracts are registered.
const FLAG_NAMES = ["posting","teaching","imports","calls","paid_joins"] as const;
type OperationsFlag = (typeof FLAG_NAMES)[number];
interface FlagSnapshot {readonly name:OperationsFlag; readonly enabled:boolean; readonly revision:number; readonly updatedAt:string|null;}
interface AuditRecord {readonly eventId:string;readonly action:string;readonly actorId:string;readonly at:string;readonly subject:string;}
interface FlagMutation {readonly name:OperationsFlag;readonly enabled:boolean;readonly expectedRevision:number;readonly idempotencyKey:string;readonly reason:string;}
interface OperationsRepository {
 listFlags(tenantId:string):Promise<readonly FlagSnapshot[]>;
 setFlag(input:FlagMutation & {tenantId:string;actorId:string}):Promise<FlagSnapshot>;
 audit(tenantId:string,limit:number):Promise<readonly AuditRecord[]>;
}
class OperationsStorageError extends Error {constructor(readonly code:string){super("admin_ops."+code);}}

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
    // Acquire idempotency lock before flag lock: same-key/different-flag races
    // now deterministically report a conflict rather than an unhandled SQL 23505.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[
      `ops:req:${input.tenantId}:${input.actorId}:${input.idempotencyKey}`
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[
      `ops:flag:${input.tenantId}:${input.name}`
    ]);
    // Unique request keys are scoped per staff actor. Disallow reusing a key for a different request.
    const prior=await client.query<{flag_name:string;requested_enabled:boolean;expected_revision:string;reason:string;result_revision:string}>(
      "SELECT flag_name,requested_enabled,expected_revision,reason,result_revision FROM admin_operations.flag_requests WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3 FOR UPDATE",
      [input.tenantId,input.actorId,input.idempotencyKey]);
    if(prior.rows[0]){
      const x=prior.rows[0];if(x.flag_name!==input.name || x.requested_enabled!==input.enabled || Number(x.expected_revision)!==input.expectedRevision || x.reason!==input.reason) throw new OperationsStorageError("conflict");
      const snap=await client.query<Row>("SELECT flag_name,enabled,revision,changed_at FROM admin_operations.flags WHERE tenant_id=$1 AND flag_name=$2",[input.tenantId,input.name]);
      const current=snap.rows[0];if(!current) throw new OperationsStorageError("unavailable");
      // Do not falsely claim replay's original snapshot if later changes exist.
      return fromRow(current);
    }
    await client.query("INSERT INTO admin_operations.flags(tenant_id,flag_name) VALUES($1,$2) ON CONFLICT DO NOTHING",[input.tenantId,input.name]);
    const current=await client.query<Row>("SELECT flag_name,enabled,revision,changed_at FROM admin_operations.flags WHERE tenant_id=$1 AND flag_name=$2 FOR UPDATE",[input.tenantId,input.name]);
    const row=current.rows[0];if(!row) throw new OperationsStorageError("unavailable");
    if(Number(row.revision)!==input.expectedRevision) throw new OperationsStorageError("conflict");
    // No-op still writes a durable audit and consumes exactly one revision.
    const next=await client.query<Row>("UPDATE admin_operations.flags SET enabled=$3,revision=revision+1,changed_by=$4,changed_at=NOW() WHERE tenant_id=$1 AND flag_name=$2 RETURNING flag_name,enabled,revision,changed_at",[input.tenantId,input.name,input.enabled,input.actorId]);
    const updated=next.rows[0];if(!updated) throw new OperationsStorageError("unavailable");
    await client.query("INSERT INTO admin_operations.flag_requests(tenant_id,actor_id,request_key,flag_name,expected_revision,requested_enabled,reason,result_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[input.tenantId,input.actorId,input.idempotencyKey,input.name,input.expectedRevision,input.enabled,input.reason,updated.revision]);
    // Reuse the canonical immutable audit journal; no second audit authority.
    await client.query(
      `INSERT INTO events.audit_events(
         audit_event_id,tenant_id,event_type,schema_version,aggregate_type,
         aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload)
       VALUES($1,$2,$3,1,$4,$5,clock_timestamp(),$6::jsonb,$7,'restricted',$8::jsonb)`,
      [createCanonicalId("audit-event"),input.tenantId,"admin_ops.flag_change",
       "admin_feature_flag",input.name,JSON.stringify({userId:input.actorId}),
       createCanonicalId("correlation"),
       JSON.stringify({before:row.enabled,after:input.enabled,reason:input.reason,
         revision:updated.revision,idempotencyKey:input.idempotencyKey})]
    );
    return fromRow(updated);
   });
  },
  async audit(tenantId,limit) {
   const result=await pool.query<{audit_event_id:string;event_type:string;actor_id:string|null;recorded_at:Date|string;aggregate_id:string}>(
     `SELECT audit_event_id,event_type,actor->>'userId' AS actor_id,
         recorded_at,aggregate_id
       FROM events.audit_events
       WHERE tenant_id=$1 AND aggregate_type='admin_feature_flag'
       ORDER BY recorded_at DESC,audit_event_id DESC LIMIT $2`,
     [tenantId,limit]);
   return result.rows.map(row=>({eventId:row.audit_event_id,action:row.event_type,
     actorId:row.actor_id??"unknown",at:new Date(row.recorded_at).toISOString(),
     subject:row.aggregate_id} satisfies AuditRecord));
  }
 };
}

/** AF00 uses this verified tenant scoped reader to wire the existing events.outbox worker. */
export function createPostgresProductJobFlags(pool: Pool) {
 return { async read(input:{tenantId:string;family:OperationsFlag}):Promise<boolean> {
  const row=await pool.query<{enabled:boolean}>("SELECT enabled FROM admin_operations.flags WHERE tenant_id=$1 AND flag_name=$2",[input.tenantId,input.family]);
  return row.rows[0]?.enabled===true;
 }};
}

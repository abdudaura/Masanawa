import {randomUUID} from "node:crypto";
import type {Pool, PoolClient} from "pg";
import type {SocialDeliveryJob,SocialDeliveryGate,DeliveryPermission,SocialProvider} from "@masanawa/masana-social";
interface GateRow {
 provider:SocialProvider; verified_at:Date|null; connection_mode:DeliveryPermission["mode"];
 paused:boolean; authorization_ref:string|null; permission_expiry:Date|null;
 capability_json:{actions?:unknown}; consent_scope:string|null; status:string;
}
async function scoped(client:Pool|PoolClient,job:SocialDeliveryJob,lock=false){
 const result=await client.query<GateRow>(`SELECT i.provider,i.verified_at,c.connection_mode,c.paused,
 c.authorization_ref,c.permission_expiry,c.capability_json,e.consent_scope,e.status
 FROM masana.social_events e
 JOIN masana.social_identities i ON i.tenant_id=e.tenant_id
  AND i.identity_id=e.identity_id AND i.provider=e.provider
 JOIN masana.social_connections c ON c.tenant_id=i.tenant_id
  AND c.identity_id=i.identity_id
 JOIN identity.character_ownership o ON o.tenant_id=i.tenant_id
  AND o.character_id=i.character_id
 WHERE e.tenant_id=$1 AND e.identity_id=$2 AND i.character_id=$3
   AND e.provider_event_id=$4 AND e.external_fan_hash=$5
   AND o.kind='platform' AND i.publish_state='published'
   ${lock?"FOR UPDATE OF e":""}`,[job.tenantId,job.identityId,job.characterId,
  job.eventId,job.externalFanHash]);
 return result.rows[0]??null;
}
/**
 * Social event attempts are audit/replay records; jobs originate exclusively
 * from existing events.outbox (no second queue). Provider transport is injected
 * by the worker only after live authorization and consent rechecks.
 */
export function createPostgresSocialDeliveryGate(pool:Pool):SocialDeliveryGate{
 return {
  async readPermission(job){
    const row=await scoped(pool,job);
    if(!row || row.status!=="processing")return null;
    const actions=row.capability_json?.actions;
    return {
      provider:row.provider,verifiedAt:row.verified_at?.toISOString()??null,
      mode:row.connection_mode,paused:row.paused,
      authorizationRef:row.authorization_ref,
      authorizationExpiresAt:row.permission_expiry?.toISOString()??null,
      permittedActions:Array.isArray(actions)?actions.filter((x):x is string=>typeof x==="string"):[],
      fanConsented:row.consent_scope==="reply_opt_in",
    };
  },
  async claim(job){
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const row=await scoped(client,job,true);
      if(!row || row.status==="held" || row.status==="held_unknown"){
        await client.query("COMMIT");return "busy";
      }
      if(row.status==="processed" || row.status==="rejected"){
        await client.query("COMMIT");return "duplicate";
      }
      if(row.status!=="eligible"){
        await client.query("COMMIT");return "busy";
      }
      const attemptId="social_attempt_"+randomUUID();
      await client.query(`INSERT INTO masana.social_delivery_attempts
        (tenant_id,attempt_id,provider,provider_event_id,identity_id,status)
        VALUES($1,$2,$3,$4,$5,'pending')`,
        [job.tenantId,attemptId,row.provider,job.eventId,job.identityId]);
      await client.query(`UPDATE masana.social_events SET status='processing'
        WHERE tenant_id=$1 AND provider=$2 AND provider_event_id=$3`,
        [job.tenantId,row.provider,job.eventId]);
      await client.query("COMMIT");
      return "acquired";
    }catch(err){
      await client.query("ROLLBACK");
      if((err as {code?:unknown}).code==="23505")return "duplicate";
      throw err;
    }finally{client.release();}
  },
  async finish(job,outcome,reason){
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const row=await scoped(client,job,true);
      if(!row || row.status!=="processing")throw new Error("SOCIAL_EVENT_NOT_CLAIMED");
      const eventStatus=outcome==="sent"?"processed":outcome==="blocked"?"rejected":"held_unknown";
      await client.query(`UPDATE masana.social_delivery_attempts
       SET status=$1
       WHERE tenant_id=$2 AND provider=$3 AND provider_event_id=$4
         AND identity_id=$5 AND status='pending'`,
       [outcome,job.tenantId,row.provider,job.eventId,job.identityId]);
      // reason remains a typed internal worker result; no raw fan content/credentials stored.
      void reason;
      await client.query(`UPDATE masana.social_events SET status=$1
       WHERE tenant_id=$2 AND provider=$3 AND provider_event_id=$4 AND status='processing'`,
       [eventStatus,job.tenantId,row.provider,job.eventId]);
      await client.query("COMMIT");
    }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
  },
 };
}

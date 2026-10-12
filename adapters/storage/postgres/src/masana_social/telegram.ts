import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import type {AuthorizedTelegramBot,TelegramInboxStore,TelegramPrivateUpdate,TelegramIngestResult} from "@masanawa/masana-social";
import {telegramEventId,TelegramIngressError} from "@masanawa/masana-social";
type BotRow={tenant_id:string;identity_id:string;character_id:string};
const botQuery=`SELECT i.tenant_id,i.identity_id,i.character_id
 FROM masana.social_identities i
 JOIN masana.social_connections c ON c.tenant_id=i.tenant_id AND c.identity_id=i.identity_id
 JOIN identity.character_ownership o ON o.tenant_id=i.tenant_id AND o.character_id=i.character_id
 WHERE i.identity_id=$1 AND i.provider='telegram' AND i.publish_state='published'
  AND i.verified_at IS NOT NULL AND o.kind='platform'
  AND NOT c.paused AND c.connection_mode='verified_automation_eligible'
  AND c.authorization_ref IS NOT NULL AND c.permission_expiry>now()
  AND c.capability_json->'actions' ? 'receive'
 ORDER BY i.tenant_id LIMIT 2`;
const consent=(q:Pool|PoolClient,b:AuthorizedTelegramBot,fanHash:string)=>
 q.query<{state:string;consent_version:string}>(`
 SELECT state,consent_version FROM masana.telegram_fan_consents
 WHERE tenant_id=$1 AND identity_id=$2 AND external_fan_hash=$3`,
 [b.tenantId,b.identityId,fanHash]);
async function active(q:Pool|PoolClient,b:AuthorizedTelegramBot):Promise<boolean>{
 const r=await q.query<BotRow>(botQuery,[b.identityId]);
 return r.rows.length===1&&r.rows[0]!.tenant_id===b.tenantId&&
   r.rows[0]!.character_id===b.characterId;
}
const uuid=(p:string)=>p+randomUUID();
function checkHash(hash:string){
 if(!/^[0-9a-f]{64}$/u.test(hash))throw new TelegramIngressError(422,"telegram_fan_hash_invalid");
}
export function createPostgresTelegramInbox(pool:Pool):TelegramInboxStore{
 return {
  async authorizedBot(identityId){
   if(!/^social_[a-zA-Z0-9_-]{8,160}$/u.test(identityId))return null;
   const r=await pool.query<BotRow>(botQuery,[identityId]);
   if(r.rows.length!==1)return null; // ambiguous cross-tenant IDs fail closed
   const x=r.rows[0]!;
   return {tenantId:x.tenant_id,identityId:x.identity_id,
    characterId:x.character_id,consentVersion:"telegram-consent-v1"};
  },
  async isConsented(b,hash){
   checkHash(hash);
   if(!await active(pool,b))return false;
   const r=await consent(pool,b,hash);
   return r.rows[0]?.state==="opted_in"&&r.rows[0]?.consent_version===b.consentVersion;
  },
  async canDispatch(b,hash){
   checkHash(hash);
   if(!await active(pool,b))return false;
   const r=await consent(pool,b,hash);
   return r.rows[0]?.state==="opted_in"&&r.rows[0]?.consent_version===b.consentVersion;
  },
  async admit(b,u,hash,encryptedRef):Promise<TelegramIngestResult>{
   checkHash(hash);
   const eventId=telegramEventId(b.identityId,u.updateId);
   if(encryptedRef!==null&&(!/^private:[A-Za-z0-9/_:.-]{8,300}$/u.test(encryptedRef)))
    throw new TelegramIngressError(422,"telegram_private_ref_invalid");
   const q=await pool.connect();
   try{
    await q.query("BEGIN");
    // Recheck current owner, approval, authorization and consent inside the transaction.
    if(!await active(q,b)){await q.query("ROLLBACK");return "denied";}
    const row=await q.query(`INSERT INTO masana.social_events
     (tenant_id,provider,provider_event_id,identity_id,external_fan_hash,origin,consent_scope,status)
     VALUES($1,'telegram',$2,$3,$4,'official_bot_webhook',NULL,'held')
     ON CONFLICT(tenant_id,provider,provider_event_id) DO NOTHING
     RETURNING provider_event_id`,[b.tenantId,eventId,b.identityId,hash]);
    if(!row.rows.length){await q.query("COMMIT");return "duplicate";}
    if(u.command!==null){
     const state=u.command==="agree"?"opted_in":u.command==="stop"?"revoked":"pending";
     await q.query(`INSERT INTO masana.telegram_fan_consents
      (tenant_id,identity_id,external_fan_hash,state,consent_version,last_update_id)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(tenant_id,identity_id,external_fan_hash)
      DO UPDATE SET state=EXCLUDED.state,consent_version=EXCLUDED.consent_version,
       last_update_id=EXCLUDED.last_update_id,changed_at=now()
      WHERE masana.telegram_fan_consents.last_update_id < EXCLUDED.last_update_id`,
      [b.tenantId,b.identityId,hash,state,b.consentVersion,u.updateId]);
     await q.query("COMMIT");
     return u.command==="agree"?"consented":u.command==="stop"?"revoked":"consent_requested";
    }
    const c=await consent(q,b,hash);
    if(c.rows[0]?.state!=="opted_in"||c.rows[0]?.consent_version!==b.consentVersion){
      await q.query("COMMIT");return "denied";
    }
    if(!encryptedRef){
      await q.query("ROLLBACK");
      throw new TelegramIngressError(503,"telegram_private_storage_unavailable");
    }
    await q.query(`UPDATE masana.social_events SET status='eligible',consent_scope='reply_opt_in'
      WHERE tenant_id=$1 AND provider='telegram' AND provider_event_id=$2`,[b.tenantId,eventId]);
    await q.query(`INSERT INTO events.outbox
     (outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,
      aggregate_id,correlation_id,destination,payload)
     VALUES($1,$2,$3,'masana.social.telegram.inbound',1,'masana_social',$4,$5,
       'masana.social.telegram.inbound',jsonb_build_object(
         'identityId',$4,'characterId',$6,'fanHash',$7,
         'providerEventId',$8,'encryptedRef',$9))`,
      [uuid("outbox-event_"),b.tenantId,uuid("event_"),b.identityId,uuid("correlation_"),
       b.characterId,hash,eventId,encryptedRef]);
    await q.query("COMMIT");
    return "queued";
   }catch(e){try{await q.query("ROLLBACK");}catch{}throw e;}finally{q.release();}
  }
 };
}

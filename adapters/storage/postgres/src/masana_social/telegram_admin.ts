import {randomUUID} from "node:crypto";
import type {Pool} from "pg";
import type {TelegramAuthorizationStore} from "@masanawa/masana-social";
/** Staff-authorized, verified official bot eligibility; still runtime default-off.
 * Serializes revision/ownership and audit; secrets never enter SQL. */
export function createPgTelegramAuthorizationStore(pool:Pool):TelegramAuthorizationStore{
 return {async authorize(v){
  if(!/^vault:[a-zA-Z0-9/_-]{4,180}$/u.test(v.bot.authorizationRef)||
    !/^evidence:[a-zA-Z0-9/_-]{4,180}$/u.test(v.bot.evidenceRef))throw new Error("TELEGRAM_AUTH_PROOF_INVALID");
  const checked=Date.parse(v.bot.checkedAt),expiry=Date.parse(v.bot.expiresAt);
  if(!Number.isFinite(checked)||!Number.isFinite(expiry)||expiry<=checked||
     expiry>checked+24*3600000||Math.abs(Date.now()-checked)>300000)
   throw new Error("TELEGRAM_AUTH_PROOF_EXPIRED");
  const q=await pool.connect();
  try{
   await q.query("BEGIN");
   const found=await q.query<{revision:string|number;provider_account_id:string;
     handle:string;paused:boolean}>(`SELECT i.revision,i.provider_account_id,i.handle,c.paused
     FROM masana.social_identities i
     JOIN masana.social_connections c ON c.tenant_id=i.tenant_id AND c.identity_id=i.identity_id
     JOIN identity.character_ownership o ON o.tenant_id=i.tenant_id
      AND o.character_id=i.character_id
     WHERE i.tenant_id=$1 AND i.character_id=$2 AND i.identity_id=$3
      AND i.provider='telegram' AND i.verified_at IS NOT NULL
      AND i.publish_state='published' AND o.kind='platform'
     FOR UPDATE OF i,c`,[v.tenantId,v.characterId,v.identityId]);
   if(!found.rows.length){await q.query("ROLLBACK");throw Object.assign(new Error("not found"),{code:"SOCIAL_NOT_FOUND"});}
   const row=found.rows[0]!;
   if(Number(row.revision)!==v.revision)throw Object.assign(new Error("stale"),{code:"SOCIAL_REVISION_CONFLICT"});
   if(row.paused)throw Object.assign(new Error("paused"),{code:"SOCIAL_NOT_FOUND"});
   const asserted=row.provider_account_id.replace(/^@/u,"").toLowerCase();
   const username=v.bot.username.toLowerCase();
   if(asserted!==v.bot.botId&&asserted!==username||
      row.handle.replace(/^@/u,"").toLowerCase()!==username)
    throw Object.assign(new Error("provider mismatch"),{code:"TELEGRAM_BOT_ID_MISMATCH"});
   await q.query(`UPDATE masana.social_connections
    SET connection_mode='verified_automation_eligible',
      authorization_ref=$3,authorization_checked_at=$4::timestamptz,
      permission_expiry=$5::timestamptz,health='healthy',
      capability_json='{"actions":["receive","reply"]}'::jsonb,paused=false,revision=revision+1
    WHERE tenant_id=$1 AND identity_id=$2`,
    [v.tenantId,v.identityId,v.bot.authorizationRef,v.bot.checkedAt,v.bot.expiresAt]);
   const changed=await q.query<{revision:string}>(`UPDATE masana.social_identities
    SET revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND identity_id=$2
    RETURNING revision`,[v.tenantId,v.identityId]);
   await q.query(`INSERT INTO masana.social_connection_audit
    (tenant_id,audit_id,identity_id,actor_id,action,prior_revision,new_revision,evidence_ref)
    VALUES($1,$2,$3,$4,'telegram_official_authorize',$5,$6,$7)`,
    [v.tenantId,"audit_"+randomUUID(),v.identityId,v.actorId,
      v.revision,changed.rows[0]!.revision,v.bot.evidenceRef]);
   await q.query("COMMIT");
   return {identityId:v.identityId,revision:Number(changed.rows[0]!.revision),
    mode:"verified_automation_eligible" as const,expiresAt:v.bot.expiresAt};
  }catch(e){
   try{await q.query("ROLLBACK");}catch{}throw e;
  }finally{q.release();}
 }};
}

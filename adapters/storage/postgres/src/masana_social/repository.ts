import type {Pool, PoolClient} from "pg";
import {randomUUID} from "node:crypto";
import {approvedPublicUrl,type SocialIdentity,type SocialProvider} from "@masanawa/masana-social";
import type {SocialStore} from "../../../../../services/gateway/src/modules/masana_social/service.js";
interface SocialRow {
 tenant_id:string;identity_id:string;character_id:string;provider:SocialProvider;
 provider_account_id:string;handle:string;public_url:string;verified_at:Date|null;
 publish_state:"draft"|"published"|"revoked";connection_mode:SocialIdentity["mode"];
 paused:boolean;revision:string|number;
}
function decode(x:SocialRow):SocialIdentity{
 const revision=Number(x.revision);
 if(!Number.isSafeInteger(revision))throw new Error("social revision out of range");
 return {tenantId:x.tenant_id,identityId:x.identity_id,characterId:x.character_id,
  provider:x.provider,providerAccountId:x.provider_account_id,handle:x.handle,publicUrl:x.public_url,
  verifiedAt:x.verified_at?.toISOString()??null,publishState:x.publish_state,mode:x.connection_mode,
  paused:x.paused,revision};
}
const columns=`i.tenant_id,i.identity_id,i.character_id,i.provider,i.provider_account_id,
 i.handle,i.public_url,i.verified_at,i.publish_state,i.revision,
 c.connection_mode,c.paused`;
function issue(code:"SOCIAL_NOT_FOUND"|"SOCIAL_REVISION_CONFLICT"|"SOCIAL_NOT_VERIFIED"|"SOCIAL_REVOKED"){
 return Object.assign(new Error(code),{code});
}
async function get(client:Pool|PoolClient,tenant:string,character:string,identity:string,lock=false){
 const q=await client.query<SocialRow>(`SELECT ${columns}
  FROM masana.social_identities i JOIN masana.social_connections c
   ON c.tenant_id=i.tenant_id AND c.identity_id=i.identity_id
  WHERE i.tenant_id=$1 AND i.character_id=$2 AND i.identity_id=$3 ${lock?"FOR UPDATE OF i,c":""}`,
  [tenant,character,identity]);
 return q.rows[0]??null;
}
/** Transaction-bound, tenant-scoped social identity repository. No provider transport or API secrets. */
export function createPostgresMasanaSocialStore(pool:Pool):SocialStore{
 const list=async(tenant:string,character:string,publicOnly:boolean)=>{
   const r=await pool.query<SocialRow>(`SELECT ${columns}
    FROM masana.social_identities i
    JOIN masana.social_connections c ON c.tenant_id=i.tenant_id AND c.identity_id=i.identity_id
    JOIN identity.character_ownership o ON o.tenant_id=i.tenant_id AND o.character_id=i.character_id
    WHERE i.tenant_id=$1 AND i.character_id=$2 AND o.kind='platform'
    ${publicOnly?"AND i.publish_state='published' AND i.verified_at IS NOT NULL AND NOT c.paused AND c.connection_mode <> 'disabled'":""}
    ORDER BY i.provider,i.identity_id`,[tenant,character]);
   return r.rows.map(decode);
 };
 return {
  publicForCharacter:(tenant,character)=>list(tenant,character,true),
  adminForCharacter:(tenant,character)=>list(tenant,character,false),
  async create(input){
   const client=await pool.connect();
   try{
    await client.query("BEGIN");
    const ins=await client.query<{identity_id:string}>(`
      INSERT INTO masana.social_identities
       (tenant_id,identity_id,character_id,provider,provider_account_id,handle,public_url)
      SELECT $1,$2,$3,$4,$5,$6,$7
      FROM identity.character_ownership o JOIN identity.characters ch
       ON ch.tenant_id=o.tenant_id AND ch.character_id=o.character_id
      WHERE o.tenant_id=$1 AND o.character_id=$3 AND o.kind='platform' AND ch.state='active'
      RETURNING identity_id`,[input.tenantId,input.identityId,input.characterId,
      input.provider,input.providerAccountId,input.handle,input.publicUrl]);
    if(!ins.rows.length)throw issue("SOCIAL_NOT_FOUND");
    await client.query(`INSERT INTO masana.social_connections(tenant_id,identity_id)
      VALUES($1,$2)`,[input.tenantId,input.identityId]);
    await client.query(`INSERT INTO masana.social_connection_audit
      (tenant_id,audit_id,identity_id,actor_id,action,new_revision)
      VALUES($1,$2,$3,$4,'create',1)`,
      [input.tenantId,"audit_"+randomUUID(),input.identityId,input.actorId]);
    const row=await get(client,input.tenantId,input.characterId,input.identityId);
    await client.query("COMMIT");
    if(!row)throw issue("SOCIAL_NOT_FOUND");
    return decode(row);
   }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
  },
  async transition(input){
   const client=await pool.connect();
   try{
    await client.query("BEGIN");
    const current=await get(client,input.tenantId,input.characterId,input.identityId,true);
    if(!current)throw issue("SOCIAL_NOT_FOUND");
    if(Number(current.revision)!==input.revision)throw issue("SOCIAL_REVISION_CONFLICT");
    if(current.publish_state==="revoked" && input.action!=="edit")throw issue("SOCIAL_REVOKED");
    let dataSql="", dataParams:unknown[]=[];
    switch(input.action){
      case "verify":
        if(!input.evidenceRef)throw issue("SOCIAL_NOT_VERIFIED");
        dataSql="verified_at=now(),publish_state='draft'";
        break;
      case "publish":
        if(!current.verified_at)throw issue("SOCIAL_NOT_VERIFIED");
        dataSql="publish_state='published'";
        break;
      case "pause":
      case "revoke":
        dataSql=input.action==="revoke"?"publish_state='revoked'":"publish_state=publish_state";
        await client.query(`UPDATE masana.social_connections SET paused=true,
          connection_mode='disabled',auth_ref=NULL,authorization_ref=NULL,
          capability_json='{}'::jsonb,rate_budget=0,revision=revision+1
          WHERE tenant_id=$1 AND identity_id=$2`,[input.tenantId,input.identityId]);
        break;
      case "resume":
        dataSql="publish_state=publish_state";
        await client.query(`UPDATE masana.social_connections SET paused=false,
          connection_mode='profile_link_only',revision=revision+1
          WHERE tenant_id=$1 AND identity_id=$2`,[input.tenantId,input.identityId]);
        break;
      case "edit": {
        if(!input.providerAccountId || !input.publicUrl || !input.handle)
          throw issue("SOCIAL_NOT_VERIFIED");
        const url=approvedPublicUrl(current.provider,input.providerAccountId,input.publicUrl);
        dataSql="provider_account_id=$5,handle=$6,public_url=$7,verified_at=NULL,publish_state='draft'";
        dataParams=[input.providerAccountId,input.handle,url];
        await client.query(`UPDATE masana.social_connections SET paused=true,
          connection_mode='disabled',auth_ref=NULL,authorization_ref=NULL,
          capability_json='{}'::jsonb,rate_budget=0,revision=revision+1
          WHERE tenant_id=$1 AND identity_id=$2`,[input.tenantId,input.identityId]);
        break;
      }
    }
    await client.query(`UPDATE masana.social_identities i SET ${dataSql},
      revision=revision+1,updated_at=now()
      WHERE tenant_id=$1 AND identity_id=$2 AND character_id=$3 AND revision=$4`,
      [input.tenantId,input.identityId,input.characterId,input.revision,...dataParams]);
    await client.query(`INSERT INTO masana.social_connection_audit
      (tenant_id,audit_id,identity_id,actor_id,action,prior_revision,new_revision,evidence_ref)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.tenantId,"audit_"+randomUUID(),input.identityId,input.actorId,
        input.action,input.revision,input.revision+1,input.evidenceRef??null]);
    const updated=await get(client,input.tenantId,input.characterId,input.identityId);
    await client.query("COMMIT");
    if(!updated)throw issue("SOCIAL_NOT_FOUND");
    return decode(updated);
   }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
  },
 };
}

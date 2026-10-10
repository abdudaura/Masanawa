import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type Sql = Pick<Pool,"query">;
function profileRows(rows: readonly Record<string,unknown>[]) {
  return rows.map(r=>({
    characterId:r.character_id,
    revision:Number(r.revision),
    profile:r.profile,
    followerCount:Number(r.follower_count),
    following:r.following===true,
  }));
}
const projection=String.raw`SELECT r.character_id,r.revision,r.profile,
 COALESCE(fc.follower_count,(SELECT count(*) FROM masana.follows f WHERE f.tenant_id=r.tenant_id AND f.character_id=r.character_id)) AS follower_count,
 EXISTS(SELECT 1 FROM masana.follows f WHERE f.tenant_id=r.tenant_id AND f.character_id=r.character_id AND f.fan_user_id=$2) AS following
 FROM masana.character_revisions r
 JOIN identity.characters c USING(tenant_id,character_id)
 JOIN identity.character_ownership o USING(tenant_id,character_id)
 LEFT JOIN masana.follow_counts fc USING(tenant_id,character_id)
 WHERE r.tenant_id=$1 AND r.state='approved' AND c.state='active' AND o.kind='platform'`;
function dbConflict(code:string):Error{return Object.assign(new Error(code),{code});}
async function audit(client:PoolClient,tenantId:string,staffId:string,characterId:string,action:string,revision:number) {
  const uuid=randomUUID();
  await client.query(`INSERT INTO events.audit_events
    (audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload)
    VALUES($1,$2,$3,1,'masana', $4,now(),$5::jsonb,$6,'internal',$7::jsonb)`,[
      "audit-event_"+uuid,tenantId,action,characterId,
      JSON.stringify({staffId}),"correlation_"+uuid,JSON.stringify({revision})
    ]);
}
async function inTx<T>(pool:Pool,fn:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect();try{
    await client.query("BEGIN");
    const result=await fn(client);await client.query("COMMIT");return result;
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
/** Uses existing identity and event tables; never creates a second agent or ledger. */
export function createMasanaPostgresStore(pool:Pool) {
  return {
    async list({tenantId,userId,q,profession,language,limit,cursor}:{tenantId:string;userId:string|null;q:string;profession:string;language:string;limit:number;cursor:string|null}) {
      const rows=await pool.query(projection+String.raw`
       AND ($3='' OR r.profile->>'displayName' ILIKE '%'||$3||'%' OR r.profile->>'profession' ILIKE '%'||$3||'%'
              OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(r.profile->'talents','[]'::jsonb)) talent
                 WHERE talent ILIKE '%'||$3||'%'))
       AND ($6='' OR r.profile->>'profession' ILIKE '%'||$6||'%')
       AND ($7='' OR r.profile->'languages' @> to_jsonb(ARRAY[$7]::text[]))
       AND ($4::text IS NULL OR r.character_id > $4)
       ORDER BY r.character_id ASC LIMIT $5`,[tenantId,userId,q,cursor,limit+1,profession,language]);
      const more=rows.rows.length>limit;
      const items=profileRows(rows.rows.slice(0,limit));
      return {items,nextCursor:more?String(items[items.length-1]?.characterId):null};
    },
    async read({tenantId,userId,characterId}:{tenantId:string;userId:string|null;characterId:string}) {
      const rows=await pool.query(projection+" AND r.character_id=$3 LIMIT 1",[tenantId,userId,characterId]);
      return profileRows(rows.rows)[0]??null;
    },
    async follow({tenantId,userId,characterId,active}:{tenantId:string;userId:string;characterId:string;active:boolean}) {
      return inTx(pool,async client=>{
        const visible=await client.query(projection+" AND r.character_id=$3 LIMIT 1",[tenantId,userId,characterId]);
        if(visible.rowCount===0) throw dbConflict("masana_not_found");
        if(active){
          await client.query("INSERT INTO masana.follows(tenant_id,fan_user_id,character_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[tenantId,userId,characterId]);
        }else{
          await client.query("DELETE FROM masana.follows WHERE tenant_id=$1 AND fan_user_id=$2 AND character_id=$3",[tenantId,userId,characterId]);
        }
        const uuid=randomUUID();
        await client.query(`INSERT INTO events.outbox
         (outbox_event_id,tenant_id,event_id,event_type,schema_version,aggregate_type,aggregate_id,correlation_id,destination,payload)
         VALUES($1,$2,$3,'masana.follow_changed',1,'masana',$4,$5,'masana.follow_counts',$6::jsonb)`,[
          "outbox-event_"+uuid,tenantId,"event_"+uuid,characterId,"correlation_"+uuid,JSON.stringify({characterId})
        ]);
        return active;
      });
    },
    async listDrafts({tenantId}:{tenantId:string}) {
      const result=await pool.query(`SELECT r.character_id,r.revision,r.state,r.profile
       FROM masana.character_revisions r JOIN identity.character_ownership o USING(tenant_id,character_id)
       WHERE r.tenant_id=$1 AND o.kind='platform' ORDER BY r.character_id,r.revision DESC LIMIT 200`,[tenantId]);
      return {items:result.rows.map(x=>({characterId:x.character_id,revision:x.revision,state:x.state,profile:x.profile}))};
    },
    async draft({tenantId,characterId,profile,staffId}:{tenantId:string;characterId:string;profile:unknown;staffId:string}) {
      // Validated by injected service boundary before composition; do not trust arbitrary JSON callers.
      return inTx(pool,async client=>{
        const lock=await client.query(`SELECT c.character_id FROM identity.characters c JOIN identity.character_ownership o USING(tenant_id,character_id)
        WHERE c.tenant_id=$1 AND c.character_id=$2 AND o.kind='platform' FOR UPDATE OF c`,[tenantId,characterId]);
        if(lock.rowCount===0) throw dbConflict("not_platform_masana");
        const v=await client.query<{next_revision:string}>(`SELECT (coalesce(max(revision),0)+1)::text AS next_revision FROM masana.character_revisions WHERE tenant_id=$1 AND character_id=$2`,[tenantId,characterId]);
        const revision=Number(v.rows[0]?.next_revision);
        await client.query("INSERT INTO masana.character_revisions(tenant_id,character_id,revision,profile) VALUES($1,$2,$3,$4::jsonb)",[tenantId,characterId,revision,JSON.stringify(profile)]);
        await audit(client,tenantId,staffId,characterId,"masana.revision_drafted",revision);
        return {characterId,revision,state:"draft" as const};
      });
    },
    async registerMedia({tenantId,characterId,mediaId,kind,objectKey,rightsNote,staffId}:{tenantId:string;characterId:string;mediaId:string;kind:"portrait"|"banner";objectKey:string;rightsNote:string;staffId:string}) {
      return inTx(pool,async client=>{
        const identity=await client.query(`SELECT c.character_id FROM identity.characters c
          JOIN identity.character_ownership o USING(tenant_id,character_id)
          WHERE c.tenant_id=$1 AND c.character_id=$2 AND c.state='active' AND o.kind='platform'
          FOR UPDATE OF c`,[tenantId,characterId]);
        if(identity.rowCount===0)throw dbConflict("not_platform_masana");
        const result=await client.query(`INSERT INTO masana.character_media
          (tenant_id,media_id,character_id,kind,object_key,rights_note,approved_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING media_id`,
          [tenantId,mediaId,characterId,kind,objectKey,rightsNote,staffId]);
        if(result.rowCount===0)throw dbConflict("media_reference_conflict");
        await audit(client,tenantId,staffId,characterId,"masana.media_registered",0);
        return {mediaId,characterId,kind,state:"verified"};
      });
    },
    async approve({tenantId,characterId,revision,staffId}:{tenantId:string;characterId:string;revision:number;staffId:string}) {
      return inTx(pool,async client=>{
        const lock=await client.query("SELECT character_id FROM identity.characters WHERE tenant_id=$1 AND character_id=$2 FOR UPDATE",[tenantId,characterId]);
        if(lock.rowCount===0) throw dbConflict("masana_not_found");
        const draft=await client.query("SELECT state,profile FROM masana.character_revisions WHERE tenant_id=$1 AND character_id=$2 AND revision=$3 FOR UPDATE",[tenantId,characterId,revision]);
        if(draft.rows[0]?.state!=="draft") throw dbConflict("revision_conflict");
        // Do not publish drafts with imaginary seed images or unreviewed media.
        // Verify both approved files belong to this character and are rights-cleared.
        const profile=draft.rows[0]?.profile as {portraitMediaId?:unknown;bannerMediaId?:unknown}|undefined;
        if(typeof profile?.portraitMediaId!=="string" || typeof profile?.bannerMediaId!=="string"
           || profile.portraitMediaId===profile.bannerMediaId) throw dbConflict("masana_media_unverified");
        const media=await client.query<{media_id:string;kind:string}>(
          `SELECT media_id,kind FROM masana.character_media
             WHERE tenant_id=$1 AND character_id=$2 AND media_id IN ($3,$4)
               AND length(btrim(rights_note))>4 AND length(btrim(approved_by))>0
             FOR SHARE`,
          [tenantId,characterId,profile.portraitMediaId,profile.bannerMediaId]
        );
        if(!media.rows.some(m=>m.kind==="portrait"&&m.media_id===profile.portraitMediaId)
            || !media.rows.some(m=>m.kind==="banner"&&m.media_id===profile.bannerMediaId))
          throw dbConflict("masana_media_unverified");
        await client.query("UPDATE masana.character_revisions SET state='retired',updated_at=now() WHERE tenant_id=$1 AND character_id=$2 AND state='approved'",[tenantId,characterId]);
        await client.query("UPDATE masana.character_revisions SET state='approved',approved_at=now(),approved_by=$4,updated_at=now() WHERE tenant_id=$1 AND character_id=$2 AND revision=$3",[tenantId,characterId,revision,staffId]);
        await audit(client,tenantId,staffId,characterId,"masana.revision_approved",revision);
        return {characterId,revision,state:"approved" as const};
      });
    },
  };
}

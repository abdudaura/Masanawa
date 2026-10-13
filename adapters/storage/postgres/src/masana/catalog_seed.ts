import type {Pool} from "pg";
import type {TenantId,CharacterId} from "@masanawa/contracts";

/** A server-owned immutable catalog projection. Neither customers nor
 * request bodies can change the roster, its media or paid entitlements. */
export interface CatalogProfileSeed{
 readonly key:string;readonly displayName:string;readonly roleLabel:string;
 readonly roomName:string;readonly expertise:readonly string[];
 readonly languages:readonly string[];readonly roomId:string;
 readonly handle:string;readonly illustrationIndex:number;
}
export interface ApprovedCatalogIdentity{
 readonly seed:CatalogProfileSeed;readonly characterId:CharacterId;
}
function validateSource(input:ApprovedCatalogIdentity){
 const p=input.seed;
 if(!/^[a-z0-9_-]{3,48}$/.test(p.key)||!/^room_masana_[a-z0-9_]+$/.test(p.roomId)
   ||p.roomId.length>100 ||!/^masana\.[a-z0-9_-]{3,35}$/.test(p.handle)
   ||!Number.isInteger(p.illustrationIndex)||p.illustrationIndex<0||p.illustrationIndex>=26
   ||!input.characterId.startsWith("character_"))
   throw Error("catalog_seed_invalid");
}
export async function ensureMasanaCatalogProfilesAndRooms(input:{
 readonly pool:Pool;readonly tenantId:TenantId;
 readonly catalog:readonly ApprovedCatalogIdentity[];
}):Promise<{approved:number;rooms:number}>{
 if(input.catalog.length===0)return {approved:0,rooms:0};
 const c=await input.pool.connect();
 let approved=0,rooms=0;
 try{
   await c.query("BEGIN");
   for(const item of input.catalog){
     validateSource(item);
     const {seed,characterId}=item;
     const allowed=await c.query(`SELECT 1 FROM identity.characters ident
      JOIN identity.character_ownership o USING(tenant_id,character_id)
      WHERE ident.tenant_id=$1 AND ident.character_id=$2
        AND ident.state='active' AND o.kind='platform'`,[input.tenantId,characterId]);
     if(!allowed.rows.length)throw Error("catalog_seed_owner_invalid");
     const number=String(seed.illustrationIndex).padStart(2,"0");
     const portraitId="masana_portrait_"+seed.key, bannerId="masana_banner_"+seed.key;
     const root="https://raw.githubusercontent.com/weavewellindustrieslimited/masanawa/main/apps/mobile/assets/masana/";
     const rights="Original Masanawa AI-generated illustrated character art, published as platform-owned static assets. Fictional likeness.";
     const rows=[
       [portraitId,"portrait",root+"avatars/portrait_"+number+".svg"],
       [bannerId,"banner",root+"banners/banner_"+number+".svg"],
     ] as const;
     for(const [mediaId,kind,url]of rows){
       await c.query(`INSERT INTO masana.character_media
         (tenant_id,media_id,character_id,kind,object_key,rights_note,approved_by)
         VALUES ($1,$2,$3,$4,$5,$6,'masanawa-platform-catalog-v1')
         ON CONFLICT (tenant_id,media_id) DO NOTHING`,
         [input.tenantId,mediaId,characterId,kind,url,rights]);
       const check=await c.query(`SELECT character_id,kind,object_key FROM masana.character_media
         WHERE tenant_id=$1 AND media_id=$2`,[input.tenantId,mediaId]);
       if(check.rows[0]?.character_id!==characterId||check.rows[0]?.kind!==kind||
          check.rows[0]?.object_key!==url)throw Error("catalog_seed_media_conflict");
     }
     const profile={
       handle:seed.handle,displayName:seed.displayName,profession:seed.roleLabel,
       biography:"Fictional Masanawa AI educator for "+seed.roleLabel+
         ". Ask questions and receive lessons. This is not a licensed human practitioner.",
       lifeStory:"An original fictional Masanawa AI learning character. "+
         "Explains relevant university topics and language skills with care. "+
         "Professional styling is a role, not a claim of a real person's degree or registration.",
       languages:[...seed.languages],talents:[...seed.expertise],
       goals:["Help students learn "+seed.roleLabel,"Provide clear explanations and practice"],
       roomId:seed.roomId,portraitMediaId:portraitId,bannerMediaId:bannerId,
     };
     // Never alter an existing approved or curated staff-owned Character bible.
     const prev=await c.query(`SELECT state FROM masana.character_revisions
       WHERE tenant_id=$1 AND character_id=$2 AND state='approved' LIMIT 1`,
       [input.tenantId,characterId]);
     if(!prev.rows.length){
       const latest=await c.query(`SELECT COALESCE(MAX(revision),0)::int AS revision
         FROM masana.character_revisions WHERE tenant_id=$1 AND character_id=$2`,
         [input.tenantId,characterId]);
       const revision=Number(latest.rows[0].revision)+1;
       const created=await c.query(`INSERT INTO masana.character_revisions
         (tenant_id,character_id,revision,state,profile,approved_by,approved_at)
         VALUES($1,$2,$3,'approved',$4::jsonb,'masanawa-platform-catalog-v1',now())
         RETURNING revision`,
         [input.tenantId,characterId,revision,JSON.stringify(profile)]);
       if(created.rowCount===1)approved++;
     }
     const owner=await c.query(`SELECT character_id,state FROM rooms.rooms
       WHERE tenant_id=$1 AND room_id=$2`,[input.tenantId,seed.roomId]);
     if(owner.rows.length){
       
       const room=await c.query(`SELECT teacher_character_id FROM rooms.rooms
         WHERE tenant_id=$1 AND room_id=$2`,[input.tenantId,seed.roomId]);
       if(room.rows[0]?.teacher_character_id!==characterId)
         throw Error("catalog_seed_room_conflict");
       // Do not override deliberately paused/retired Rooms.
       if(owner.rows[0].state==="draft"){
         await c.query(`UPDATE rooms.rooms SET state='published',updated_at=now()
           WHERE tenant_id=$1 AND room_id=$2 AND state='draft'`,
           [input.tenantId,seed.roomId]);
       }
     }else{
       const slug="masana-"+number+"-"+seed.key;
       const created=await c.query(`INSERT INTO rooms.rooms
         (tenant_id,room_id,slug,profession_title,teacher_character_id,
          language,state,plan_mode)
         VALUES($1,$2,$3,$4,$5,$6,'published','free') RETURNING room_id`,
         [input.tenantId,seed.roomId,slug,seed.roleLabel+" — "+seed.displayName,
          characterId,seed.languages[0]??"en"]);
       if(created.rowCount===1)rooms++;
     }
   }
   await c.query("COMMIT");
   return {approved,rooms};
 }catch(error){await c.query("ROLLBACK");throw error;}
 finally{c.release();}
}
/** Prevent multiple Gateway replicas from concurrently creating different
 * random character IDs for the same catalog persona. Session advisory lock. */
export async function withCatalogProvisionLock<T>(pool:Pool,tenantId:TenantId,run:()=>Promise<T>):Promise<T>{
 const client=await pool.connect();
 let locked=false;
 try{
   await client.query("SELECT pg_advisory_lock(hashtext('masanawa-catalog-v1'),hashtext($1::text))",[tenantId]);
   locked=true;
   return await run();
 }finally{
   if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('masanawa-catalog-v1'),hashtext($1::text))",[tenantId]).catch(()=>undefined);
   client.release();
 }
}

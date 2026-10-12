import type {Pool} from "pg";

/** Read the existing canonical identity/media approvals. This is a selector,
 * not another author, media catalogue, role store or publication authority. */
export class PgStatusEligibility {
 constructor(private readonly pool:Pick<Pool,"query">){}
 async author(tenant:string,character:string):Promise<boolean>{
  const r=await this.pool.query(`SELECT EXISTS (
   SELECT 1 FROM masana.character_revisions r
   JOIN identity.characters c USING(tenant_id,character_id)
   JOIN identity.character_ownership o USING(tenant_id,character_id)
   WHERE r.tenant_id=$1 AND r.character_id=$2 AND r.state='approved'
    AND c.state='active' AND o.kind='platform') AS approved`,[tenant,character]);
  return r.rows[0]?.approved===true;
 }
 async media(tenant:string,character:string,media:string,kind:string="image"):Promise<boolean>{
  // The canonical catalogue currently stores images only. Never relabel them as audio.
  if(kind!=="image")return false;
  const r=await this.pool.query(`SELECT EXISTS (
   SELECT 1 FROM masana.character_media m
   JOIN identity.characters c USING(tenant_id,character_id)
   JOIN identity.character_ownership o USING(tenant_id,character_id)
   JOIN masana.character_revisions r USING(tenant_id,character_id)
   WHERE m.tenant_id=$1 AND m.character_id=$2 AND m.media_id=$3
    AND r.state='approved' AND c.state='active' AND o.kind='platform'
    AND length(btrim(m.rights_note))>4 AND length(btrim(m.approved_by))>0
    AND length(btrim(m.object_key))>0) AS approved`,[tenant,character,media]);
  return r.rows[0]?.approved===true;
 }
}

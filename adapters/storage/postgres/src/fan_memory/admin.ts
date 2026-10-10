import type {Pool} from "pg";
export function createPostgresFanMemoryAdminPort(pool:Pool){
 return {
 async aggregate(tenantId:string){
  const x=await pool.query<{character_id:string;enabled_fans:string}>(`
   SELECT r.character_id,COUNT(*)::text AS enabled_fans
   FROM identity.relationships r JOIN memory.fan_controls c
   ON c.tenant_id=r.tenant_id AND c.relationship_id=r.relationship_id
   WHERE r.tenant_id=$1 AND r.state='active' AND c.enabled=true
   GROUP BY r.character_id ORDER BY r.character_id LIMIT 100`,[tenantId]);
  return x.rows.map(r=>({characterId:r.character_id,enabledFans:Number(r.enabled_fans)}));
 }
 };
}

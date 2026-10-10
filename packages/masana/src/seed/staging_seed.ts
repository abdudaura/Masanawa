import { validateMasanaProfile } from "../index.js";
interface SqlClient {
 query(sql:string,params?:readonly unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
 release():void;
}
export interface SeedConnection {connect():Promise<SqlClient>}
export interface MasanaSeedFixture {
 readonly characters:readonly {
  characterId:string;handle:string;displayName:string;kind:string;
  profile:{publicBio:string;lifeStory:string;languages:readonly string[];
   talents:readonly string[];goalArcs:readonly string[]};
  defaultRoom:{roomId:string;profession:string};
 }[];
}
/** Staging-only and idempotent: identity records and unpublished profile drafts.
 * Does not invent media or activate Rooms/posts/real providers. Never runs on boot.
 */
export async function seedMasanaDrafts(input:{
 readonly db:SeedConnection;readonly fixture:MasanaSeedFixture;
 readonly tenantId:string;readonly environment:string;readonly seedAllowed:string;
}):Promise<{created:number;total:number}>{
 if(input.environment!=="staging"||input.seedAllowed!=="staging")throw new Error("seed_disabled");
 if(input.fixture.characters.length!==12)throw new Error("seed_fixture_incomplete");
 if(!/^tenant_[a-zA-Z0-9_-]{1,128}$/.test(input.tenantId))throw new Error("invalid_tenant");
 const seen=new Set<string>();
 const people=input.fixture.characters.map(person=>{
  if(person.kind!=="platform_masana" || !/^[a-z0-9_-]{3,128}$/.test(person.characterId)
   || seen.has(person.characterId))throw new Error("invalid_seed_character");
  seen.add(person.characterId);
  const profile=validateMasanaProfile({
   handle:person.handle,displayName:person.displayName,
   profession:person.defaultRoom.profession,
   biography:person.profile.publicBio,lifeStory:person.profile.lifeStory,
   languages:person.profile.languages,talents:person.profile.talents,
   goals:person.profile.goalArcs,roomId:person.defaultRoom.roomId,
   portraitMediaId:null,bannerMediaId:null,
  });
  return {id:person.characterId,profile};
 });
 const client=await input.db.connect();let created=0;
 try{
  await client.query("BEGIN");
  for(const person of people){
   await client.query("INSERT INTO identity.characters(tenant_id,character_id,state,created_at,updated_at) VALUES($1,$2,'active',now(),now()) ON CONFLICT DO NOTHING",[input.tenantId,person.id]);
   await client.query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,owner_user_id,created_at) VALUES($1,$2,'platform',NULL,now()) ON CONFLICT DO NOTHING",[input.tenantId,person.id]);
   const owner=await client.query("SELECT kind FROM identity.character_ownership WHERE tenant_id=$1 AND character_id=$2",[input.tenantId,person.id]);
   if(owner.rows[0]?.kind!=="platform")throw new Error("seed_ownership_conflict");
   const result=await client.query("INSERT INTO masana.character_revisions(tenant_id,character_id,revision,state,profile) VALUES($1,$2,1,'draft',$3::jsonb) ON CONFLICT DO NOTHING RETURNING revision",[input.tenantId,person.id,JSON.stringify(person.profile)]);
   if(result.rows.length)created++;
  }
  await client.query("COMMIT");
  return {created,total:people.length};
 }catch(error){await client.query("ROLLBACK");throw error;}
 finally{client.release();}
}

import {randomUUID} from "node:crypto";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {Pool} from "pg";
import {createCanonicalId} from "@masanawa/contracts";
import {runMigrations} from "../migrations.js";
import {platformProductMigrationRoots} from "../readiness.js";
import {createPgRoomsRepository} from "../rooms/repository.js";
import {ensureMasanaCatalogProfilesAndRooms} from "./catalog_seed.js";
import {initialRoomLessons,MASANA_INTRO_LESSONS} from "./catalog_lessons.js";

const url=process.env.MASANAWA_TEST_DATABASE_URL;
describe.skipIf(!url)("professional Masana catalog and Rooms on real PostgreSQL18",()=>{
 const dbName="masana_catalog_"+randomUUID().replaceAll("-","").slice(0,12);
 const tenant=createCanonicalId("tenant"),other=createCanonicalId("tenant");
 let admin:Pool,pool:Pool;
 let roster:Array<{seed:{
 key:string;displayName:string;roleLabel:string;roomName:string;
 expertise:string[];languages:string[];roomId:string;handle:string;illustrationIndex:number;
 };characterId:ReturnType<typeof createCanonicalId<"character">>}>;
 beforeAll(async()=>{
  const source=new URL(url!);
  if(!["127.0.0.1","localhost"].includes(source.hostname))
   throw Error("catalog_tests_require_disposable_local_postgresql");
  admin=new Pool({connectionString:url!});
  await admin.query('CREATE DATABASE "'+dbName+'"');
  source.pathname="/"+dbName;
  pool=new Pool({connectionString:source.toString(),max:8});
  await runMigrations(pool,platformProductMigrationRoots());
  roster=[];
  await pool.query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now()),($2,now(),now())",[tenant,other]);
  await pool.query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,'fan_one',now(),now())",[tenant]);
  const data=[
   ["gwani","Mallam Gwani Bodi","Masanawa General Support","en"],
   ["gwana","Malamah Gwana Sulafat","Masanawa General Support","ha"],
   ["amina","Dr. Amina Yusuf","Medicine & Surgery","en"],
   ["sadiq","Prof. Sadiq Musa","Computer Science","en"],
   ["layla","Ustazah Layla Hassan","Arabic Language","ar"],
   ["grace","Prof. Grace Okonkwo","English Language","en"],
   ["asha","Madam Asha Verma","Hindi Language","hi"],
   ["mei","Prof. Mei Lin","Mandarin Chinese","zh"],
  ];
  for(let i=0;i<data.length;i++){
   const [key,name,role,language]=data[i]!,id=createCanonicalId("character");
   await pool.query("INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,$2,now(),now())",[tenant,id]);
   await pool.query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,created_at) VALUES($1,$2,'platform',now())",[tenant,id]);
   roster.push({characterId:id,seed:{key:key!,displayName:name!,roleLabel:role!,
    roomName:name!+"'s Room",expertise:["Teaching","Practice"],
    languages:[language!],roomId:"room_masana_"+String(i).padStart(2,"0")+"_"+key,
    handle:"masana."+key,illustrationIndex:i}});
  }
 },90_000);
 afterAll(async()=>{
   if(pool)await pool.end();
   if(admin){await admin.query('DROP DATABASE IF EXISTS "'+dbName+'"');await admin.end();}
 },30_000);
 it("publishes approved AI personas with own static media and joinable free Room",async()=>{
   const first=await ensureMasanaCatalogProfilesAndRooms({pool,tenantId:tenant,catalog:roster});
   expect(first).toEqual({approved:roster.length,rooms:roster.length});
   const items=await pool.query("SELECT character_id,profile FROM masana.character_revisions WHERE tenant_id=$1 AND state='approved'",[tenant]);
   expect(items.rows).toHaveLength(roster.length);
   const rooms=await pool.query("SELECT room_id,teacher_character_id,state,plan_mode FROM rooms.rooms WHERE tenant_id=$1",[tenant]);
   expect(rooms.rows).toHaveLength(roster.length);
   for(const {seed,characterId}of roster){
     const profile=items.rows.find((x)=>x.character_id===characterId)?.profile;
     expect(profile).toMatchObject({displayName:seed.displayName,roomId:seed.roomId});
     const room=rooms.rows.find(x=>x.room_id===seed.roomId);
     expect(room).toMatchObject({teacher_character_id:characterId,state:"published",plan_mode:"free"});
     const media=await pool.query("SELECT kind,object_key FROM masana.character_media WHERE tenant_id=$1 AND character_id=$2",[tenant,characterId]);
     expect(media.rows.map(x=>x.kind).sort()).toEqual(["banner","portrait"]);
     expect(media.rows.every(x=>x.object_key.includes("/apps/mobile/assets/masana/"))).toBe(true);
   }
   const repo=createPgRoomsRepository(pool);
   const fan={tenantId:tenant,userId:"fan_one",roles:[] as string[]};
   const list=await repo.list(fan,{});
   expect(list).toHaveLength(roster.length);
   await repo.join(fan,roster[4]!.seed.roomId);
   const lessons=await repo.lessons(fan,roster[4]!.seed.roomId);
   expect(lessons).toHaveLength(2);
   expect(lessons.every(l=>l.kind==="lesson"&&l.body.length>100)).toBe(true);
   const question=await repo.ask(fan,roster[4]!.seed.roomId,"كيف حالك؟","student_ask_idempotency_123456");
   expect(question.state).toBe("queued");
   expect(question.roomId).toBe(roster[4]!.seed.roomId);
   expect((await pool.query("SELECT count(*)::int AS n FROM events.outbox WHERE tenant_id=$1 AND aggregate_id=$2 AND destination='rooms.teacher'",[tenant,question.questionId])).rows[0].n).toBe(1);
   await expect(repo.questions({...fan,tenantId:other},roster[4]!.seed.roomId)).rejects.toMatchObject({status:404});
 });
 it("all 26 professional teachers ship distinct, substantive first lessons",()=>{
   expect(Object.keys(MASANA_INTRO_LESSONS)).toHaveLength(26);
   for(const [key] of Object.entries(MASANA_INTRO_LESSONS)){
     const lessons=initialRoomLessons(key);
     expect(lessons).toHaveLength(2);
     expect(lessons[0]?.body.length).toBeGreaterThan(160);
     expect(lessons[1]?.body.length).toBeGreaterThan(160);
     expect(new Set(lessons.map(l=>l.id)).size).toBe(2);
   }
 });
 it("rerun is non-destructive; staff pause and existing approved revision survive",async()=>{
   await pool.query("UPDATE rooms.rooms SET state='paused' WHERE tenant_id=$1 AND room_id=$2",[tenant,roster[0]!.seed.roomId]);
   expect(await ensureMasanaCatalogProfilesAndRooms({pool,tenantId:tenant,catalog:roster})).toEqual({approved:0,rooms:0});
   expect((await pool.query("SELECT state FROM rooms.rooms WHERE tenant_id=$1 AND room_id=$2",[tenant,roster[0]!.seed.roomId])).rows[0].state).toBe("paused");
   expect((await pool.query("SELECT count(*)::int AS n FROM masana.character_revisions WHERE tenant_id=$1 AND state='approved'",[tenant])).rows[0].n).toBe(roster.length);
 });
});

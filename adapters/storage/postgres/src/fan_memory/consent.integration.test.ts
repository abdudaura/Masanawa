import {fileURLToPath} from "node:url";
import {createCanonicalId,toInstant} from "@masanawa/contracts";
import {beforeAll,afterAll,describe,expect,it} from "vitest";
import type {Pool} from "pg";
import {createIsolatedPostgresTestDatabase} from "../commerce/isolated-test-database.js";
import {runMigrations} from "../migrations.js";
import {createTenant,createUser,createCharacter,getOrCreateRelationship} from "../identity/repository.js";
import {withTransaction} from "../transaction.js";
import {createPostgresFanMemoryStore} from "./repository.js";
import {createPostgresFanExtractionPort} from "./extraction.js";

const url=process.env.MASANAWA_TEST_DATABASE_URL;
const pg=url?describe:describe.skip;
const root=(part:string)=>fileURLToPath(new URL(part,import.meta.url));
pg("J11 fan memory PG18 source acceptance",()=>{
 let isolated:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let pool:Pool;
 beforeAll(async()=>{
  isolated=await createIsolatedPostgresTestDatabase(url!);pool=isolated.pool;
  await runMigrations(pool,[
   {owner:"events",directory:root("../../../../../packages/events/migrations")},
   {owner:"identity",directory:root("../../../../../packages/identity/migrations")},
   {owner:"memory",directory:root("../../../../../packages/memory/migrations")},
   {owner:"fan-memory",directory:root("../../../../../packages/fan-memory/migrations")},
  ]);
 });
 afterAll(async()=>{await isolated?.close();});
 async function fixture(){
  const tenantId=createCanonicalId("tenant"),characterId=createCanonicalId("character");
  const userId=createCanonicalId("user"),otherUserId=createCanonicalId("user");
  const relationshipId=createCanonicalId("relationship"),otherRelationshipId=createCanonicalId("relationship");
  await withTransaction(pool,async c=>{
   const now=toInstant(new Date().toISOString());
   await createTenant(c,{tenantId,createdAt:now});
   await createUser(c,{tenantId,userId,createdAt:now});
   await createUser(c,{tenantId,userId:otherUserId,createdAt:now});
   await createCharacter(c,{tenantId,characterId,createdAt:now});
   await getOrCreateRelationship(c,{tenantId,userId,characterId,relationshipId,createdAt:now});
   await getOrCreateRelationship(c,{tenantId,userId:otherUserId,characterId,
     relationshipId:otherRelationshipId,createdAt:now});
  });
  return {tenantId,characterId,userId,otherUserId,relationshipId,otherRelationshipId};
 }
 it("starts off and isolates two fans through opt-in, extraction and readback",async()=>{
  const x=await fixture(),store=createPostgresFanMemoryStore(pool);
  const owner={tenantId:x.tenantId,userId:x.userId};
  const other={tenantId:x.tenantId,userId:x.otherUserId};
  expect(await store.read(owner,x.characterId)).toMatchObject({enabled:false,revision:0,items:[]});
  expect(await store.read(other,x.characterId)).toMatchObject({enabled:false,items:[]});
  const enabled=await store.setEnabled(owner,x.characterId,true,0);
  expect(enabled).toMatchObject({enabled:true,revision:1});
  const source="a".repeat(64);
  const extractor=createPostgresFanExtractionPort(pool,async(_client,t,r,messageId,hash)=>
    t===x.tenantId&&r===x.relationshipId&&messageId==="message:verified"&&hash===source);
  expect(await extractor.enabled(x.tenantId,x.relationshipId)).toBe(true);
  expect(await extractor.enabled(x.tenantId,x.otherRelationshipId)).toBe(false);
  const fact={content:"I prefer short chapters",category:"preference",messageId:"message:verified",sourceHash:source,confidence:0.95};
  expect(await extractor.commit(x.tenantId,x.relationshipId,[fact],180)).toBe(1);
  expect(await extractor.commit(x.tenantId,x.relationshipId,[fact],180)).toBe(0);
  const read=await store.read(owner,x.characterId);
  expect(read?.items).toHaveLength(1);
  expect(read?.items[0]?.content).toBe("I prefer short chapters");
  expect((await store.read(other,x.characterId))?.items).toEqual([]);
  expect(await store.setEnabled(owner,x.characterId,false,1)).toMatchObject({enabled:false,revision:2});
  expect((await store.read(owner,x.characterId))?.items).toEqual([]);
  expect(await extractor.commit(x.tenantId,x.relationshipId,[fact],180)).toBe(0);
  expect(await store.setEnabled(owner,x.characterId,true,1)).toBeNull();
 });
 it("queues exactly one outbox event on whole-memory deletion retries",async()=>{
  const x=await fixture(),store=createPostgresFanMemoryStore(pool);
  const actor={tenantId:x.tenantId,userId:x.userId};
  await store.setEnabled(actor,x.characterId,true,0);
  const first=await store.enqueueErase(actor,x.characterId,null,"erase-all-stable-key-01");
  const again=await store.enqueueErase(actor,x.characterId,null,"erase-all-stable-key-01");
  expect(first).toEqual(again);
  expect(first?.state).toBe("queued");
  const events=await pool.query<{n:string}>(`SELECT count(*)::text n FROM events.outbox
   WHERE tenant_id=$1 AND destination='fan-memory-erase'`,[x.tenantId]);
  expect(Number(events.rows[0]?.n)).toBe(1);
  const audit=await pool.query<{n:string}>(`SELECT count(*)::text n FROM memory.fan_control_audit
    WHERE tenant_id=$1 AND relationship_id=$2`,[x.tenantId,x.relationshipId]);
  expect(Number(audit.rows[0]?.n)).toBe(2);
  expect(await store.read(actor,x.characterId)).toMatchObject({enabled:false,revision:2,items:[]});
 });
 it("never allows foreign fan to queue another fan's single-record erasure",async()=>{
  const x=await fixture(),store=createPostgresFanMemoryStore(pool);
  await store.setEnabled({tenantId:x.tenantId,userId:x.userId},x.characterId,true,0);
  expect(await store.enqueueErase({tenantId:x.tenantId,userId:x.otherUserId},
    x.characterId,createCanonicalId("memory-record"),"foreign-erase-key")).toBeNull();
 });
});

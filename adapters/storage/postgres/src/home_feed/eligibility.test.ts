import {createIsolatedPostgresTestDatabase} from "../commerce/isolated-test-database.js";
import {describe,it,expect,vi,beforeAll,afterAll} from "vitest";
import {PgStatusEligibility} from "./eligibility.js";
describe("Status existing canonical eligibility selectors",()=>{
 it("requires strict canonical approval and never trusts malformed truthy rows",async()=>{
  for(const approved of [false,undefined,null,"true",1]){
   const query=vi.fn(async()=>({rows:[{approved}]}));
   const r=new PgStatusEligibility({query} as never);
   expect(await r.author("tenant","masana")).toBe(false);
   expect(await r.media("tenant","masana","media_abcdefgh")).toBe(false);
  }
 });
 it("binds exact tenant/author/media and checks current identity plus cleared rights",async()=>{
  const query=vi.fn(async(_sql:string,_args:unknown[])=>({rows:[{approved:true}]}));
  const r=new PgStatusEligibility({query} as never);
  expect(await r.author("tenant","masana")).toBe(true);
  expect(await r.media("tenant","masana","media_abcdefgh")).toBe(true);
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant","masana"]);
  expect(query.mock.calls[1]?.[1]).toEqual(["tenant","masana","media_abcdefgh","image"]);
  for(const [sql] of query.mock.calls){
   expect(sql).toContain("c.state='active'");
   expect(sql).toContain("o.kind='platform'");
   expect(sql).toContain("r.state='approved'");
  }
  expect(query.mock.calls[1]?.[0]).toContain("m.rights_note");
  expect(query.mock.calls[1]?.[0]).toContain("m.approved_by");
 });
 it("denies image references relabelled as audio before querying",async()=>{
  const query=vi.fn();const r=new PgStatusEligibility({query} as never);
  expect(await r.media("tenant","masana","media_abcdefgh","audio")).toBe(false);
  // No locally declared approval: unverified query does not confer rights.
  expect(query).toHaveBeenCalledTimes(1);
 });
 it("cleared object resolution binds tenant author media and denies malformed rows",async()=>{
  const query=vi.fn(async(_sql:string,_args:unknown[])=>({rows:[{object_key:"tenant/approved.png"}]}));
  const r=new PgStatusEligibility({query} as never);
  expect(await r.object("tenant","masana","media_abcdefgh")).toEqual({objectKey:"tenant/approved.png"});
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant","masana","media_abcdefgh","image"]);
  const sql=query.mock.calls[0]?.[0];
  for(const guard of ["m.kind IN","m.rights_note","m.approved_by","c.state='active'","o.kind='platform'","r.state='approved'"])
   expect(sql).toContain(guard);
  for(const object_key of [null,undefined,1,""]){
   query.mockResolvedValueOnce({rows:[{object_key}]} as never);
   expect(await r.object("tenant","masana","media_abcdefgh")).toBeNull();
  }
 });
 it("propagates storage failure so the authenticated HTTP scope fails closed",async()=>{
  const r=new PgStatusEligibility({query:async()=>{throw Error("unavailable");}} as never);
  await expect(r.author("tenant","masana")).rejects.toThrow("unavailable");
 });
});

const connection=process.env.MASANAWA_TEST_DATABASE_URL;
(connection?describe:describe.skip)("Status cleared object selectors on disposable PostgreSQL18",()=>{
 let db:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let eligibility:PgStatusEligibility;
 beforeAll(async()=>{
  db=await createIsolatedPostgresTestDatabase(connection!);
  await db.pool.query(`CREATE SCHEMA identity; CREATE SCHEMA masana;
   CREATE TABLE identity.characters(tenant_id text,character_id text,state text);
   CREATE TABLE identity.character_ownership(tenant_id text,character_id text,kind text);
   CREATE TABLE masana.character_revisions(tenant_id text,character_id text,state text);
   CREATE TABLE masana.character_media(tenant_id text,character_id text,media_id text,kind text,rights_note text,approved_by text,object_key text);
   INSERT INTO identity.characters VALUES('tenant_real','masana','active');
   INSERT INTO identity.character_ownership VALUES('tenant_real','masana','platform');
   INSERT INTO masana.character_revisions VALUES('tenant_real','masana','approved');
   INSERT INTO masana.character_media VALUES('tenant_real','masana','media_abcdefgh','portrait','cleared license','reviewer','canonical/image.png');`);
  eligibility=new PgStatusEligibility(db.pool);
 });
 afterAll(async()=>{await db?.close();});
 it("resolves only the exact tenant/author/media rights-cleared object",async()=>{
  expect(await eligibility.object('tenant_real','masana','media_abcdefgh')).toEqual({objectKey:'canonical/image.png'});
  for(const args of [['foreign','masana','media_abcdefgh'],['tenant_real','foreign','media_abcdefgh'],['tenant_real','masana','media_foreign'],["tenant_real' OR true --",'masana','media_abcdefgh']])
   expect(await eligibility.object(args[0]!,args[1]!,args[2]!)).toBeNull();
 });
 it("does not relabel portrait as audio and admits only explicitly cleared audio media",async()=>{
  expect(await eligibility.object('tenant_real','masana','media_abcdefgh','audio')).toBeNull();
  await db.pool.query("INSERT INTO masana.character_media VALUES('tenant_real','masana','media_audio0001','audio','cleared recording license','reviewer','canonical/speech.m4a')");
  expect(await eligibility.object('tenant_real','masana','media_audio0001','audio')).toEqual({objectKey:'canonical/speech.m4a'});
  expect(await eligibility.object('tenant_real','masana','media_audio0001','image')).toBeNull();
 });
 it("revocation, private ownership, suspension or withdrawn rights deny the next read",async()=>{
  for(const [table,column,blocked,restored] of [
   ['identity.characters','state','suspended','active'],
   ['identity.character_ownership','kind','creator','platform'],
   ['masana.character_revisions','state','draft','approved'],
   ['masana.character_media','rights_note','','cleared license'],
   ['masana.character_media','approved_by','','reviewer']]){
   // Table and column names are fixed test fixtures, values remain bound.
   await db.pool.query(`UPDATE ${table} SET ${column}=$1`,[blocked]);
   expect(await eligibility.object('tenant_real','masana','media_abcdefgh')).toBeNull();
   await db.pool.query(`UPDATE ${table} SET ${column}=$1`,[restored]);
  }
 });
});

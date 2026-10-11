import {describe,expect,it} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {createFanSetupStore,FanSetupStoreError} from "./fan_setup.js";
import type {FanSetupUpdate} from "@masanawa/identity";
const update:FanSetupUpdate={
 expectedRevision:1,displayName:"Fan Account",preferredLanguage:"ha",
 interests:["learning"],ageAttested18Plus:true,
 disclosureAccepted:true,disclosureVersion:"masana-ai-v1"
};
const row=(revision=1,completed=false)=>({
 user_id:"fan_a",display_name:completed?"Fan Account":null,
 avatar_media_id:null,preferred_language:completed?"ha":"en",
 interests:completed?["learning"]:[],
 age_attested_18plus_at:completed?new Date():null,
 masana_disclosure_version:completed?"masana-ai-v1":null,
 masana_disclosure_accepted_at:completed?new Date():null,
 fan_setup_completed_at:completed?new Date():null,revision
});
function mock(revision=1,completed=false){
 const statements:{sql:string;values?:unknown[]}[]=[];
 const query=async(sql:string,values?:unknown[])=>{
  statements.push({sql,values});
  if(sql.startsWith("SELECT"))return {rows:[row(revision,completed)]};
  if(sql.startsWith("UPDATE"))return {rows:[row(revision+1,true)]};
  return {rows:[]};
 };
 const client={query,release:()=>{}};
 const pool={query,connect:async()=>client} as unknown as Pool;
 return {statements,store:createFanSetupStore(pool)};
}
describe("J01 PostgreSQL adapter",()=>{
 it("uses tenant and fan in every user read/update and transactional CAS",async()=>{
  const s=mock();
  const result=await s.store.update({tenantId:"tenant_real",userId:"fan_a",update});
  expect(result.completed).toBe(true);
  expect(s.statements.map(x=>x.sql)).toContain("BEGIN");
  expect(s.statements.map(x=>x.sql)).toContain("COMMIT");
  const reads=s.statements.filter(x=>x.sql.startsWith("SELECT"));
  expect(reads[0].values).toEqual(["tenant_real","fan_a"]);
  const writes=s.statements.filter(x=>x.sql.startsWith("UPDATE"));
  expect(writes).toHaveLength(1);
  expect(writes[0].sql).toContain("revision=$8");
  expect(writes[0].values?.slice(0,2)).toEqual(["tenant_real","fan_a"]);
 });
 it("returns same completed record without a second update on retry",async()=>{
  const s=mock(2,true);
  const result=await s.store.update({tenantId:"tenant_real",userId:"fan_a",update});
  expect(result.revision).toBe(2);
  expect(s.statements.some(x=>x.sql.startsWith("UPDATE"))).toBe(false);
 });
 it("rejects conflicting revision and rolls back",async()=>{
  const s=mock(5);
  await expect(s.store.update({tenantId:"tenant_real",userId:"fan_a",update}))
   .rejects.toBeInstanceOf(FanSetupStoreError);
  expect(s.statements.map(x=>x.sql)).toContain("ROLLBACK");
 });
});

/** Executes real DDL only in a local, disposable PG18 _test database.
 * No cloud, production, financial, or persistent migration operation.
 * Transaction rollback ensures existing data is untouched.
 */
function disposableUrl(input:string|undefined):input is string {
 if(!input)return false;
 try {
  const url=new URL(input);
  return ["postgres:","postgresql:"].includes(url.protocol) &&
    ["localhost","127.0.0.1"].includes(url.hostname) &&
    /(?:^|_)test$/.test(url.pathname.slice(1));
 }catch{return false;}
}
const dbUrl=process.env.MASANAWA_TEST_DATABASE_URL;
const realTest=disposableUrl(dbUrl)?it:it.skip;
realTest("J01 PG18 schema: fresh/upgrade, age/disclosure constraints and actor CAS",async()=>{
 const pool=new Pool({connectionString:dbUrl});
 const client=await pool.connect();
 const root=fileURLToPath(new URL("../../../../../",import.meta.url));
 try{
  await client.query("BEGIN");
  const version=await client.query<{server_version_num:string}>("SHOW server_version_num");
  expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180000);
  expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190000);
  const exists=await client.query<{table_name:string|null}>("SELECT to_regclass('identity.users')::text AS table_name");
  if(!exists.rows[0]?.table_name){
   await client.query(await readFile(root+"packages/identity/migrations/0001_identity_foundation.sql","utf8"));
  }
  const column=await client.query<{column_name:string}>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='identity' AND table_name='users' AND column_name='age_attested_18plus_at'");
  if(column.rowCount===0){
   await client.query(await readFile(root+"packages/identity/migrations/0007_fan_setup.sql","utf8"));
  }
  const tenant="tenant_fan_test_"+randomUUID().replace(/-/g,"");
  await client.query("INSERT INTO identity.tenants (tenant_id,created_at,updated_at) VALUES($1,now(),now())",[tenant]);
  await client.query("INSERT INTO identity.users (tenant_id,user_id,created_at,updated_at) VALUES($1,'fan_a',now(),now()),($1,'fan_b',now(),now())",[tenant]);
  // A fan cannot be considered complete without explicit age and disclosure.
  await client.query("SAVEPOINT denied");
  await expect(client.query("UPDATE identity.users SET display_name='Fan A',fan_setup_completed_at=now() WHERE tenant_id=$1 AND user_id='fan_a'",[tenant]))
    .rejects.toMatchObject({code:"23514"});
  await client.query("ROLLBACK TO SAVEPOINT denied");
  await client.query("RELEASE SAVEPOINT denied");
  const ok=await client.query("UPDATE identity.users SET display_name='Fan A',preferred_language='ha',interests=ARRAY['learning']::text[],age_attested_18plus_at=now(),masana_disclosure_version='masana-ai-v1',masana_disclosure_accepted_at=now(),fan_setup_completed_at=now(),revision=revision+1 WHERE tenant_id=$1 AND user_id='fan_a' AND revision=1 RETURNING revision",[tenant]);
  expect(Number(ok.rows[0]?.revision)).toBe(2);
  const stale=await client.query("UPDATE identity.users SET display_name='Stale' WHERE tenant_id=$1 AND user_id='fan_a' AND revision=1 RETURNING revision",[tenant]);
  expect(stale.rowCount).toBe(0);
  const other=await client.query("SELECT display_name,fan_setup_completed_at FROM identity.users WHERE tenant_id=$1 AND user_id='fan_b'",[tenant]);
  expect(other.rows[0]?.display_name).toBeNull();
  expect(other.rows[0]?.fan_setup_completed_at).toBeNull();
 }finally{try{await client.query("ROLLBACK");}finally{client.release();await pool.end();}}
},30000);

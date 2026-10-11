import {describe,expect,it} from "vitest";
import type {Pool} from "pg";
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

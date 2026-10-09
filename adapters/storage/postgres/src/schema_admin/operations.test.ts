import type {Pool} from "pg";
import {describe,it,expect} from "vitest";
import type {SchemaManifest} from "./manifest.js";
import { schemaApply,schemaStatus,schemaBootstrapTest } from "./operations.js";
const sql="SELECT 1;";
const manifest:SchemaManifest={digest:"a".repeat(64),migrations:[
  {owner:"identity",name:"0001_users.sql",sql,sha256:"1".repeat(64)},
  {owner:"talks",name:"0001_talks.sql",sql,sha256:"2".repeat(64)},
]};
function fake(input:{
  ledger?:boolean;applied?:Array<{owner:string;name:string;sha256:string}>;
  version?:string;dbName?:string;
  otherSchemas?:boolean;publicRoutines?:boolean;publicTypes?:boolean;
  publicComposite?:boolean;largeObjects?:boolean;publicDefinitions?:boolean;
}={}){
  const seen:string[]=[];
  const rows=input.applied??[];
  let ledger=input.ledger??true;
  const version=input.version??"180000";
  const database=input.dbName??"masanawa_test_schemaunit";
  const query=async (s:string,_v?:unknown[])=>{
    seen.push(s);
    if(s.includes("AS db_name"))return{rows:[{
      db_name:database,db_user:"schema_operator",server_version:version,
      ledger_table:ledger?"masanawa_schema_migrations":null,
    }],rowCount:1};
    if(s.includes("ORDER BY applied_at"))return{rows,rowCount:rows.length};
    if(s.includes("CREATE TABLE public.masanawa_schema_migrations"))ledger=true;
    if(s.includes("FROM pg_class c"))return{rows:input.publicComposite?[{object_name:"private_composite"}]:[],rowCount:input.publicComposite?1:0};
    if(s.includes("FROM pg_largeobject_metadata"))return{rows:input.largeObjects?[{object_id:"123"}]:[],rowCount:input.largeObjects?1:0};
    if(s.includes("FROM pg_namespace n"))return{rows:input.otherSchemas?[{schema_name:"private_data"}]:[],rowCount:input.otherSchemas?1:0};
    if(s.includes("FROM pg_proc p"))return{rows:input.publicRoutines?[{routine_name:"danger"}]:[],rowCount:input.publicRoutines?1:0};
    if(s.includes("FROM pg_type t"))return{rows:input.publicTypes?[{type_name:"state"}]:[],rowCount:input.publicTypes?1:0};
    if(s.includes("SELECT object_kind FROM ("))return{rows:input.publicDefinitions?[{object_kind:"collation"}]:[],rowCount:input.publicDefinitions?1:0};
    if(s.includes("INFORMATION_SCHEMA.SCHEMATA")||s.includes("information_schema.schemata"))
      return{rows:[],rowCount:0};
    if(s.includes("masanawa_schema_rollback_probe")&&s.includes("SELECT"))
      return{rows:[{exists:false}],rowCount:1};
    return{rows:[],rowCount:0};
  };
  const pool={connect:async()=>({query,release:()=>{seen.push("RELEASE");}})} as unknown as Pool;
  return{pool,seen};
}
const approval={targetDatabase:"masanawa_test_schemaunit",expectedManifestSha256:manifest.digest,
  deploymentCommitSha:"1".repeat(40),backupEvidenceId:"backup/test-20261008",
  backupVerifiedAt:"2026-10-08T09:00:00.000Z",approvedByOperator:true};
const now=new Date("2026-10-08T10:00:00.000Z");
describe("R16 schema inspection and guarded application",()=>{
  it("status is read only on missing ledger and returns every migration as pending",async()=>{
    const h=fake({ledger:false});
    const result=await schemaStatus(h.pool,manifest);
    expect(result.ready).toBe(false);
    expect(result.pending).toEqual(["identity/0001_users.sql","talks/0001_talks.sql"]);
    expect(result.applied).toBe(0);
    expect(h.seen).toContain("SET TRANSACTION READ ONLY");
    expect(h.seen.some(s=>s.includes("CREATE TABLE"))).toBe(false);
  });
  it("detects modified migration hash, unknown ledger row, and gaps",async()=>{
    const h=fake({applied:[
      {owner:"identity",name:"0001_users.sql",sha256:"f".repeat(64)},
      {owner:"unknown",name:"0099_extra.sql",sha256:"e".repeat(64)},
      {owner:"talks",name:"0001_talks.sql",sha256:"2".repeat(64)},
    ]});
    const status=await schemaStatus(h.pool,manifest);
    expect(status.changed).toEqual(["identity/0001_users.sql"]);
    expect(status.unexpected).toEqual(["unknown/0099_extra.sql"]);
    expect(status.ready).toBe(false);
  });
  it("rejects mismatched manifest pin before running SQL",async()=>{
    const h=fake({ledger:false});
    await expect(schemaApply(h.pool,manifest,{
      ...approval,expectedManifestSha256:"e".repeat(64)},now))
      .rejects.toMatchObject({code:"schema.manifest_pin_mismatch"});
    expect(h.seen.some(s=>s.includes("CREATE TABLE"))).toBe(false);
    expect(h.seen).toContain("ROLLBACK");
  });
  it("rejects wrong database and stale backup attestation",async()=>{
    const h=fake({ledger:false});
    await expect(schemaApply(h.pool,manifest,{...approval,targetDatabase:"production"},now))
      .rejects.toMatchObject({code:"schema.target_database_mismatch"});
    await expect(schemaApply(h.pool,manifest,{...approval,backupVerifiedAt:"2026-09-01T00:00:00Z"},now))
      .rejects.toMatchObject({code:"schema.backup_attestation_stale"});
    expect(h.seen.some(s=>s.includes("CREATE TABLE"))).toBe(false);
  });
  it("refuses historical drift or unexpected rows rather than overwriting them",async()=>{
    const h=fake({ledger:true,applied:[{owner:"identity",name:"0001_users.sql",sha256:"0".repeat(64)}]});
    await expect(schemaApply(h.pool,manifest,approval,now))
      .rejects.toMatchObject({code:"schema.manifest_drift_or_unknown"});
    expect(h.seen.some(s=>s.includes("CREATE TABLE"))).toBe(false);
  });
  it.each([
    ["custom schema", {otherSchemas:true}, "schema.bootstrap_other_schemas_present"],
    ["standalone public routine", {publicRoutines:true}, "schema.bootstrap_public_routines_present"],
    ["standalone public type", {publicTypes:true}, "schema.bootstrap_public_types_present"],
    ["standalone composite type", {publicComposite:true}, "schema.bootstrap_public_not_empty"],
    ["binary large object", {largeObjects:true}, "schema.bootstrap_large_objects_present"],
    ["public collation or advanced definition", {publicDefinitions:true}, "schema.bootstrap_public_definitions_present"],
  ])("disposable bootstrap refuses pre-existing %s without touching user data",async(_label,input,code)=>{
    const h=fake({ledger:false,...input});
    await expect(schemaBootstrapTest(h.pool,manifest,{
      expectedDatabase:"masanawa_test_schemaunit",disposableConfirmed:true,
    })).rejects.toMatchObject({code});
    expect(h.seen.some(s=>s.includes("CREATE TABLE")||s.includes("SAVEPOINT"))).toBe(false);
    expect(h.seen).toContain("ROLLBACK");
  });
  it("bootstrap refuses a non-disposable name without any writes",async()=>{
    const h=fake({ledger:false,dbName:"production"});
    await expect(schemaBootstrapTest(h.pool,manifest,
      {expectedDatabase:"production",disposableConfirmed:true}))
      .rejects.toMatchObject({code:"schema.disposable_database_confirmation_required"});
    expect(h.seen).toEqual([]);
  });
});

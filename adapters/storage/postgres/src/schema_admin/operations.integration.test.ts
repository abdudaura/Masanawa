import { randomUUID } from "node:crypto";
import {Pool} from "pg";
import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {createPostgresPool} from "../pool.js";
import {platformProductMigrationRoots} from "../readiness.js";
import {loadSchemaManifest,type SchemaManifest} from "./manifest.js";
import {schemaApply,schemaBootstrapTest,schemaStatus} from "./operations.js";

/**
 * DANGEROUSLY NOT a fixture against production. Run only when explicitly
 * configured with an isolated newly provisioned masanawa_test_* PostgreSQL 18 DB.
 * All DDL runs under transaction; no schema drops or real account data import.
 */
const connection=process.env.MASANAWA_TEST_DATABASE_URL;
const integration=connection?describe:describe.skip;
integration("R16 schema lifecycle on disposable real PG18",()=>{
  let pool:Pool;
  let databaseName:string;
  let manifest:SchemaManifest;
  beforeAll(async()=>{
    pool=createPostgresPool({connectionString:connection!,applicationName:"masanawa-schema-test",max:3});
    const metadata=await pool.query<{db:string}>("SELECT current_database() AS db");
    databaseName=metadata.rows[0]!.db;
    if(!/^masanawa_test_[a-z0-9_]{5,60}$/u.test(databaseName)){
      throw new Error("Refusing non-disposable PostgreSQL database");
    }
    manifest=await loadSchemaManifest(platformProductMigrationRoots());
  },30000);
  afterAll(async()=>{if(pool)await pool.end();});
  it("status of empty DB does not create a ledger or change schemas",async()=>{
    const before=await schemaStatus(pool,manifest);
    expect(before.ledgerExists).toBe(false);
    expect(before.pending.length).toBe(manifest.migrations.length);
    expect(before.ready).toBe(false);
    const ledger=await pool.query<{name:string|null}>(
      "SELECT to_regclass('public.masanawa_schema_migrations')::text AS name");
    expect(ledger.rows[0]?.name).toBeNull();
  });
  it("requires disposable proof and rejects ordinary production name",async()=>{
    await expect(schemaBootstrapTest(pool,manifest,{
      expectedDatabase:"production",disposableConfirmed:true,
    })).rejects.toMatchObject({code:"schema.disposable_database_confirmation_required"});
    expect((await schemaStatus(pool,manifest)).ledgerExists).toBe(false);
  });
  it("applies a clean production manifest on disposable PG then verifies idempotent second check",async()=>{
    const result=await schemaBootstrapTest(pool,manifest,{
      expectedDatabase:databaseName,disposableConfirmed:true,
    });
    expect(result.idempotent).toBe(true);
    expect(result.rollbackVerified).toBe(true);
    expect(result.applied).toHaveLength(manifest.migrations.length);
    const status=await schemaStatus(pool,manifest);
    expect(status.ready).toBe(true);
    expect(status.changed).toEqual([]);
    expect(status.unexpected).toEqual([]);
    expect(status.pending).toEqual([]);
  },120000);
  it("rejects unexpected ledger entries without modifying them",async()=>{
    const fakeHash="f".repeat(64);
    const key="zzzz/9999_"+randomUUID().replaceAll("-","")+".sql";
    const [owner,name]=key.split("/");
    await pool.query("INSERT INTO public.masanawa_schema_migrations(owner,name,sha256) VALUES($1,$2,$3)",
      [owner,name,fakeHash]);
    const before=await schemaStatus(pool,manifest);
    expect(before.unexpected).toContain(key);
    const now=new Date();
    await expect(schemaApply(pool,manifest,{
      targetDatabase:databaseName,expectedManifestSha256:manifest.digest,
      deploymentCommitSha:"a".repeat(40),backupEvidenceId:"backup/test-verified-20261008",
      backupVerifiedAt:now.toISOString(),approvedByOperator:true,
    },now)).rejects.toMatchObject({code:"schema.manifest_drift_or_unknown"});
    await pool.query("DELETE FROM public.masanawa_schema_migrations WHERE owner=$1 AND name=$2",
      [owner,name]);
    expect((await schemaStatus(pool,manifest)).ready).toBe(true);
  },30000);
  it("aborts a new invalid migration atomically and leaves no extra ledger row/table",async()=>{
    const invalidName="9999_rollback_"+randomUUID().replaceAll("-")+".sql";
    // Pick a canonical owner at the END of lexical ordering to avoid earlier-missing ordering blockers.
    const temp:SchemaManifest={digest:"b".repeat(64),migrations:[
      ...manifest.migrations,{owner:"zzzz",name:invalidName,sha256:"c".repeat(64),
        sql:"CREATE TABLE public.masanawa_r16_rollback_check(i integer); SELECT 1/0;"},
    ]};
    const now=new Date();
    await expect(schemaApply(pool,temp,{
      targetDatabase:databaseName,expectedManifestSha256:temp.digest,
      deploymentCommitSha:"a".repeat(40),backupEvidenceId:"backup/test-verified-20261008",
      backupVerifiedAt:now.toISOString(),approvedByOperator:true,
    },now)).rejects.toThrow();
    const table=await pool.query<{name:string|null}>(
      "SELECT to_regclass('public.masanawa_r16_rollback_check')::text AS name");
    expect(table.rows[0]?.name).toBeNull();
    expect((await schemaStatus(pool,manifest)).ready).toBe(true);
  },30000);
});

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
  it("refuses a named disposable DB carrying unrelated user schemas, routines, or types",async()=>{
    const extra="masanawa_r16_extra_"+randomUUID().replaceAll("-","");
    const attempt=()=>schemaBootstrapTest(pool,manifest,{
      expectedDatabase:databaseName,disposableConfirmed:true,
    });
    await pool.query(`CREATE SCHEMA "${extra}"`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_other_schemas_present",
      });
      const stillThere=await pool.query<{name:string|null}>(
        "SELECT to_regnamespace($1)::text AS name",[extra]);
      expect(stillThere.rows[0]?.name).toBe(extra);
    } finally {
      await pool.query(`DROP SCHEMA "${extra}"`);
    }

    const routine="masanawa_r16_freshness_probe";
    await pool.query(`CREATE FUNCTION public.${routine}() RETURNS integer
      LANGUAGE sql AS 'SELECT 1'`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_public_routines_present",
      });
      const stillThere=await pool.query<{name:string|null}>(
        "SELECT to_regprocedure($1)::text AS name",[`public.${routine}()`]);
      expect(stillThere.rows[0]?.name).toContain(routine);
    } finally {
      await pool.query(`DROP FUNCTION public.${routine}()`);
    }

    const type="masanawa_r16_freshness_type";
    await pool.query(`CREATE TYPE public.${type} AS ENUM ('ready')`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_public_types_present",
      });
      const stillThere=await pool.query<{name:string|null}>(
        "SELECT to_regtype($1)::text AS name",[`public.${type}`]);
      expect(stillThere.rows[0]?.name).toContain(type);
    } finally {
      await pool.query(`DROP TYPE public.${type}`);
    }
    const composite="masanawa_r16_freshness_composite";
    await pool.query(`CREATE TYPE public.${composite} AS (value integer)`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_public_not_empty",
      });
      const stillThere=await pool.query<{name:string|null}>(
        "SELECT to_regtype($1)::text AS name",[`public.${composite}`]);
      expect(stillThere.rows[0]?.name).toContain(composite);
    } finally {
      await pool.query(`DROP TYPE public.${composite}`);
    }

    const oid=(await pool.query<{oid:number}>("SELECT lo_create(0) AS oid")).rows[0]?.oid;
    expect(oid).toBeDefined();
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_large_objects_present",
      });
      const stillThere=await pool.query<{oid:number}>(
        "SELECT oid FROM pg_largeobject_metadata WHERE oid=$1",[oid]);
      expect(stillThere.rows[0]?.oid).toBe(oid);
    } finally {
      await pool.query("SELECT lo_unlink($1)",[oid]);
    }
    // A non-extension collation has no table, user type or routine; it must
    // still block rehearsal, preserving the definition without executing DDL.
    const collation="masanawa_r16_freshness_collation";
    await pool.query(`CREATE COLLATION public.${collation} (provider = libc, locale = 'C')`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_public_definitions_present",
      });
      const persisted=await pool.query<{name:string}>(
        "SELECT c.collname AS name FROM pg_collation c JOIN pg_namespace n "+
        "ON n.oid=c.collnamespace WHERE n.nspname='public' AND c.collname=$1",
        [collation]);
      expect(persisted.rows[0]?.name).toBe(collation);
    } finally {
      await pool.query(`DROP COLLATION public.${collation}`);
    }

    const textSearch="masanawa_r16_freshness_textsearch";
    await pool.query(`CREATE TEXT SEARCH CONFIGURATION public.${textSearch}
      (COPY = pg_catalog.english)`);
    try {
      await expect(attempt()).rejects.toMatchObject({
        code:"schema.bootstrap_public_definitions_present",
      });
      const persisted=await pool.query<{name:string}>(
        "SELECT c.cfgname AS name FROM pg_ts_config c JOIN pg_namespace n "+
        "ON n.oid=c.cfgnamespace WHERE n.nspname='public' AND c.cfgname=$1",
        [textSearch]);
      expect(persisted.rows[0]?.name).toBe(textSearch);
    } finally {
      await pool.query(`DROP TEXT SEARCH CONFIGURATION public.${textSearch}`);
    }
    expect((await schemaStatus(pool,manifest)).ledgerExists).toBe(false);
  },30000);
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
    const now=new Date();
    const reapplied=await schemaApply(pool,manifest,{
      targetDatabase:databaseName,expectedManifestSha256:manifest.digest,
      deploymentCommitSha:"a".repeat(40),backupEvidenceId:"backup/test-verified-20261008",
      backupVerifiedAt:now.toISOString(),approvedByOperator:true,
    },now);
    expect(reapplied.applied).toEqual([]);
    expect(reapplied.after.ready).toBe(true);
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
  it("detects a modified applied checksum without overwriting history",async()=>{
    const m=manifest.migrations[0]!;
    await pool.query("UPDATE public.masanawa_schema_migrations SET sha256=$3 WHERE owner=$1 AND name=$2",
      [m.owner,m.name,"e".repeat(64)]);
    const status=await schemaStatus(pool,manifest);
    expect(status.changed).toContain(m.owner+"/"+m.name);
    expect(status.ready).toBe(false);
    await pool.query("UPDATE public.masanawa_schema_migrations SET sha256=$3 WHERE owner=$1 AND name=$2",
      [m.owner,m.name,m.sha256]);
    expect((await schemaStatus(pool,manifest)).ready).toBe(true);
  });
  it("aborts a new invalid migration atomically and leaves no extra ledger row/table",async()=>{
    const invalidName="9999_rollback_"+randomUUID().replaceAll("-", "")+".sql";
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

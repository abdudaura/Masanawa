import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestDatabase } from "../commerce/isolated-test-database.js";
import { createPostgresOperationsRepository, createPostgresProductJobFlags } from "./repository.js";

const uri=process.env.MASANAWA_TEST_DATABASE_URL;
const suite=uri?describe:describe.skip;
suite("J19 PostgreSQL18 flags, idempotency and tenant-scoped audit",()=>{
 let pool:Pool;
 let isolated:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>> | undefined;
 beforeAll(async()=>{
  isolated=await createIsolatedPostgresTestDatabase(uri!);pool=isolated.pool;
  const version=await pool.query<{server_version_num:string}>("SHOW server_version_num");
  expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180000);
  // Feature SQL source is isolated and does not modify the shared numbered migration registry.
  const sql=readFileSync(fileURLToPath(new URL("./schema.sql",import.meta.url)),"utf8");
  await pool.query(sql);
 });
 afterAll(async()=>{await isolated?.close();});
 const input={tenantId:"tenant_A",actorId:"ops_A",name:"imports" as const,enabled:false,
  expectedRevision:0,idempotencyKey:"j19-request-a",reason:"Suspend unapproved imports on incident"};
 it("starts disabled, persists audited CAS update and consistent idempotency",async()=>{
  const repo=createPostgresOperationsRepository(pool);
  expect((await repo.listFlags(input.tenantId)).find(x=>x.name===input.name)?.enabled).toBe(false);
  const first=await repo.setFlag(input);
  expect(first.revision).toBe(1);expect(first.enabled).toBe(false);
  const repeat=await repo.setFlag(input);expect(repeat.revision).toBe(1);
  const audit=await repo.audit(input.tenantId,20);
  expect(audit).toHaveLength(1);
  expect(audit[0]?.actorId).toBe(input.actorId);
  expect((await createPostgresProductJobFlags(pool).read({tenantId:input.tenantId,family:"imports"}))).toBe(false);
 });
 it("denies cross-tenant readback and rejects idempotency-key changes",async()=>{
  const repo=createPostgresOperationsRepository(pool);
  expect(await repo.audit("tenant_B",20)).toEqual([]);
  await expect(repo.setFlag({...input,reason:"Different request reason",expectedRevision:0})).rejects.toThrow("admin_ops.conflict");
 });
 it("conflicting parallel revisions leave only one committed outcome",async()=>{
  const repo=createPostgresOperationsRepository(pool);
  const common={tenantId:"tenant_parallel",actorId:"operator",name:"posting" as const,enabled:false,
    expectedRevision:0,reason:"Emergency publishing suspension"};
  const attempts=await Promise.allSettled([
    repo.setFlag({...common,idempotencyKey:"parallel-request-a"}),
    repo.setFlag({...common,idempotencyKey:"parallel-request-b"})
  ]);
  expect(attempts.filter(x=>x.status==="fulfilled")).toHaveLength(1);
  expect(attempts.filter(x=>x.status==="rejected")).toHaveLength(1);
  expect(await repo.audit("tenant_parallel",20)).toHaveLength(1);
 });
});

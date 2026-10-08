import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { beforeAll,afterAll,describe,expect,it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "../security/platform-session.js";
import { createPostgresAccountDeletionRepository } from "./account-deletion.js";
import { createPostgresDeletionFinancialPreflight } from "./account-deletion-financial.js";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const describeDb=connectionString?describe:describe.skip;

describeDb("R12 financial preflight with real ledgers",()=>{
  let pool:Pool;
  const tenantId=createCanonicalId("tenant");
  let userId=createCanonicalId("user");
  let requestId=randomUUID();
  const at=new Date().toISOString();

  beforeAll(async()=>{
    pool=new Pool({connectionString});
    const dir=(name:string)=>fileURLToPath(
      new URL(`../../../../../packages/${name}/migrations`,import.meta.url));
    await runMigrations(pool,[
      {owner:"events",directory:dir("events")},
      {owner:"security",directory:dir("security")},
      {owner:"identity",directory:dir("identity")},
      {owner:"commerce",directory:dir("commerce")},
    ]);
    const profile=await createPostgresPlatformSessionRepository(pool).createProfile({
      tenantId,channel:"email",identifier:`financial-screen-${randomUUID()}@example.com`,
      name:"Financial Screening",locale:"en",createdAt:at,
    });
    userId=profile.userId;
    const opened=await createPostgresAccountDeletionRepository(pool).open({
      tenantId,userId,requestId,now:at,
    });
    requestId=opened.requestId;
  });
  afterAll(async()=>{await pool?.end();});

  it("does not clear an account without a qualified admission fence",async()=>{
    const check=createPostgresDeletionFinancialPreflight(pool);
    const result=await check.scan({tenantId,userId,requestId,now:at});
    expect(result.findingCodes).toEqual([]);
    expect(result.admissionFenced).toBe(false);
    expect(result.clear).toBe(false);
    const scans=await pool.query<{cleared:boolean}>(
      `SELECT cleared FROM identity.account_deletion_financial_scans
        WHERE scan_id=$1::uuid`,[result.scanId],
    );
    expect(scans.rows[0]?.cleared).toBe(false);
  });

  it("detects stored NGN money and fails even with a test-only fence",async()=>{
    await pool.query(
      `INSERT INTO commerce.ngn_wallet_entries(
         tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,created_at
       ) VALUES ($1,$2,$3,'credit',100,'funding',$4,$5)`,
      [tenantId,userId,`entry-${randomUUID()}`,`r12-${randomUUID()}`,at],
    );
    const check=createPostgresDeletionFinancialPreflight(pool,{
      async assertLocked(){return true;},
    });
    const result=await check.scan({tenantId,userId,requestId,now:at});
    expect(result.findingCodes).toContain("ngn-wallet");
    expect(result.clear).toBe(false);
    expect(result.admissionFenced).toBe(false);
    await expect(pool.query(
      `DELETE FROM identity.account_deletion_financial_scans WHERE scan_id=$1::uuid`,
      [result.scanId],
    )).rejects.toThrow(/append-only/);
  });

  it("does not invent a successful read when required tables are unavailable",async()=>{
    // An invalid scope never qualifies, and the repository must reject it
    // transactionally rather than returning an empty financial footprint.
    const check=createPostgresDeletionFinancialPreflight(pool);
    await expect(check.scan({
      tenantId,userId,requestId:randomUUID(),now:at,
    })).rejects.toThrow("account_deletion.not_found");
  });
});

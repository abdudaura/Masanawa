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

  it("detects earnings attached to a personal Twin instead of the owner ID",async()=>{
    const profile=await createPostgresPlatformSessionRepository(pool).createProfile({
      tenantId,channel:"email",
      identifier:`twin-ledger-${randomUUID()}@example.com`,
      name:"Twin Earnings",locale:"en",createdAt:at,
    });
    const account=profile.userId;
    const personalCharacter=createCanonicalId("character");
    await pool.query(
      `INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at)
       VALUES($1,$2,$3,$3)`,[tenantId,personalCharacter,at],
    );
    await pool.query(
      `INSERT INTO identity.character_ownership
         (tenant_id,character_id,kind,owner_user_id,created_at)
       VALUES($1,$2,'personal-clone',$3,$4)`,
      [tenantId,personalCharacter,account,at],
    );
    const ledgerEntryId=`ledger-entry_${randomUUID()}`;
    await pool.query(
      `INSERT INTO commerce.ledger_entries(
         tenant_id,ledger_entry_id,debit_kind,debit_user_id,debit_character_id,
         credit_kind,credit_user_id,credit_character_id,amount_credits,
         reason,quote_id,fulfillment_id,created_at,definition
       ) VALUES ($1,$2,'platform-supply',NULL,NULL,'agent-float',NULL,$3,25,
                 'test-credit',NULL,NULL,$4,$5::jsonb)`,
      [tenantId,ledgerEntryId,personalCharacter,at,JSON.stringify({
        tenantId,ledgerEntryId,
      })],
    );
    const request=await createPostgresAccountDeletionRepository(pool).open({
      tenantId,userId:account,requestId:randomUUID(),now:at,
    });
    const scan=await createPostgresDeletionFinancialPreflight(pool).scan({
      tenantId,userId:account,requestId:request.requestId,now:at,
    });
    expect(scan.findingCodes).toContain("owned-twin-ledger");
    expect(scan.clear).toBe(false);
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

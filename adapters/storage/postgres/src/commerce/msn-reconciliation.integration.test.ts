import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import {
  admitMsnSettlement, type MsnConversionQuote, type MsnProviderSettlement,
} from "../../../../../services/gateway/src/msn_wallet/admission.js";
import { createMsnLedgerStore } from "../../../../../services/gateway/src/msn_wallet/store.js";
import { createMsnFundingJournal } from "../../../../../services/gateway/src/msn_wallet/quote_journal.js";
import { createMsnFiatIntakeReader } from "../../../../../services/gateway/src/msn_wallet/fiat_intake_pg.js";
import { createMsnReconciler } from "../../../../../services/gateway/src/msn_wallet/reconciliation.js";
import { runMsnStagedReconciliation } from "../../../../../services/worker/src/jobs/msn/reconcile.js";

const url = process.env.MASANAWA_TEST_DATABASE_URL;
const db = url ? describe : describe.skip;
db("AF01 staged MSN PostgreSQL18 reconciliation through worker", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(new URL("../../../../../packages/commerce/migrations", import.meta.url)),
    }]);
    const ddl = await readFile(fileURLToPath(new URL(
      "../../../../../packages/commerce/migration_proposals/0112_msn_wallet.sql", import.meta.url,
    )), "utf8");
    await pool.query(ddl); // Disposable test DB only; not the production registry.
  });
  afterAll(async () => { await pool?.end(); });

  async function seed() {
    const tenantId = randomUUID(), userId = randomUUID();
    const quoteId = randomUUID(), fundingReference = randomUUID();
    const txRef = randomUUID();
    const transactionId = String(randomInt(1_000_000_000, 2_000_000_000));
    const now = Date.now();
    const quote: MsnConversionQuote = {
      tenantId, userId, quoteId, fundingReference, fundingRail: "NGN_FLUTTERWAVE",
      ngnFundingKobo: 15025n, backingAsset: "USDTTRC20", backingNetwork: "tron",
      pricePerMsnUsdMicro: 500000n, minimumSettledBackingUsdMicro: 1000000n,
      providerQuoteReference: randomUUID(), issuedAtMs: now - 5000,
      expiresAtMs: now + 60000,
    };
    const journal = createMsnFundingJournal(pool);
    await journal.saveQuote(quote, "a".repeat(64));
    return { quote, journal, txRef, transactionId, now };
  }
  async function fund(s: Awaited<ReturnType<typeof seed>>) {
    const {quote,txRef,transactionId} = s;
    await pool.query(
      `INSERT INTO commerce.ngn_funding_intents
      (tenant_id,user_id,funding_reference,tx_ref,amount_kobo,quote_id,
       state,account_number,bank_name,provider_transaction_id,provider_reference,
       expires_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,15025,$5,'credited','0000000000','TEST BANK',
             $6,'FLW-Q',now()+interval '1 hour',now(),now())`,
      [quote.tenantId,quote.userId,quote.fundingReference,txRef,quote.quoteId,transactionId],
    );
    await pool.query(
      `INSERT INTO commerce.ngn_wallet_entries
      (tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,
       provider_transaction_id,created_at)
      VALUES($1,$2,$3,'credit',15025,'funding',$4,$5,now())`,
      [quote.tenantId,quote.userId,"fund:"+txRef,quote.fundingReference,transactionId],
    );
    const provider = { async verifyByReference(ref: string) {
      expect(ref).toBe(txRef);
      return { txRef, transactionId, providerReference: "FLW-Q",
        status: "successful", amount: "150.25", currency: "NGN" };
    } };
    await s.journal.verifyFiat({
      tenantId:quote.tenantId,userId:quote.userId,quoteId:quote.quoteId,
      reader:createMsnFiatIntakeReader(pool),provider,observedAtMs:s.now,
    });
  }
  it("scans only signed tenant, distinguishes pending, independently verified fiat, no custody", async () => {
    const s = await seed();
    const scanner = createMsnReconciler(pool);
    expect((await scanner.scan(s.quote.tenantId)).results[0]).toMatchObject({
      quoteId:s.quote.quoteId,state:"funding_pending",custodyQualified:false,
    });
    await fund(s);
    const result = await scanner.scan(s.quote.tenantId);
    expect(result.results[0]).toMatchObject({
      state:"backing_pending",custodyQualified:false,reasons:[],
    });
    expect(await scanner.scan(randomUUID())).toMatchObject({scanned:0,results:[]});
    const worker = await runMsnStagedReconciliation(scanner, {tenantId:s.quote.tenantId});
    expect(worker).toMatchObject({scanned:1,awaitingBacking:1,anomalous:0,
      custodyQualified:false});
    expect((await pool.query(
      "SELECT count(*)::int AS n FROM commerce.msn_issuances WHERE tenant_id=$1",
      [s.quote.tenantId],
    )).rows[0]?.n).toBe(0);
  });

  it("reconciles double-entry issuance as accounting consistency, not provider qualification", async () => {
    const s = await seed();
    await fund(s);
    const q=s.quote;
    // Simulated custody evidence intentionally exists only inside this disposable
    // database test. This is NOT a real NOWPayments transaction or permission to mint.
    const settlement:MsnProviderSettlement = {
      tenantId:q.tenantId,userId:q.userId,quoteId:q.quoteId,
      fundingReference:q.fundingReference,providerQuoteReference:q.providerQuoteReference,
      providerSettlementId:randomUUID(),backingAsset:q.backingAsset,
      backingNetwork:q.backingNetwork,settledBackingUsdMicro:1000000n,
      verifiedNgnFundingKobo:15025n,settledAtMs:s.now,
    };
    const admission=admitMsnSettlement({
      quote:q,settlement,nowMs:s.now+1,qualifiedProvider:true,
      custodyBackingVerified:true,conversionLicensedAndAvailable:true,
      accountPolicyApproved:true,
    });
    const issued=await createMsnLedgerStore(pool).issue({
      quote:q,admission,verifiedEvidenceSha256:"b".repeat(64),
    });
    expect(issued.replay).toBe(false);
    const scan=await createMsnReconciler(pool).scan(q.tenantId);
    expect(scan.results[0]).toEqual({
      quoteId:q.quoteId,state:"issued_accounting_consistent",
      reasons:[],custodyQualified:false,
    });
    await expect(pool.query(
      "UPDATE commerce.msn_ledger_entries SET delta_micro=1 WHERE tenant_id=$1",
      [q.tenantId],
    )).rejects.toThrow("MSN ledger/issuance is append-only");
  });
});

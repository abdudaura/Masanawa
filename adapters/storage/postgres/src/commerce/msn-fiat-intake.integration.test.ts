import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MsnConversionQuote } from "../../../../../services/gateway/src/msn_wallet/admission.js";
import { createMsnFiatIntakeReader } from "../../../../../services/gateway/src/msn_wallet/fiat_intake_pg.js";
import { verifyMsnFiatIntake } from "../../../../../services/gateway/src/msn_wallet/fiat_intake.js";
import { runMigrations } from "../migrations.js";

const url = process.env.MASANAWA_TEST_DATABASE_URL;
const db = url ? describe : describe.skip;

db("AF01 real PostgreSQL18 NGN intake/provider reconciliation", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    // Only the CANONICAL commerce funding schema. Never install staged MSN
    // migration or create a substitute funding wallet for these checks.
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(new URL("../../../../../packages/commerce/migrations", import.meta.url)),
    }]);
  });
  afterAll(async () => { await pool?.end(); });

  async function funded() {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const quoteId = randomUUID();
    const fundingReference = randomUUID();
    const txRef = randomUUID();
    const providerTransactionId = String(randomInt(1_000_000_000, 2_000_000_000));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO commerce.ngn_funding_intents
          (tenant_id,user_id,funding_reference,tx_ref,amount_kobo,quote_id,
           state,account_number,bank_name,provider_transaction_id,provider_reference,
           expires_at,created_at,updated_at)
         VALUES ($1,$2,$3,$4,15025,$5,'credited','0000000000','TEST BANK',
                 $6,'FLW-test',now()+interval '1 hour',now(),now())`,
        [tenantId,userId,fundingReference,txRef,quoteId,providerTransactionId],
      );
      await client.query(
        `INSERT INTO commerce.ngn_wallet_entries
          (tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,
           provider_transaction_id,created_at)
         VALUES ($1,$2,$3,'credit',15025,'funding',$4,$5,now())`,
        [tenantId,userId,"fund:"+txRef,fundingReference,providerTransactionId],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally { client.release(); }
    const quote: MsnConversionQuote = {
      quoteId, tenantId, userId, fundingReference, ngnFundingKobo: 15_025n,
      fundingRail: "NGN_FLUTTERWAVE", backingAsset: "USDTTRC20",
      backingNetwork: "tron", minimumSettledBackingUsdMicro: 1_000_000n,
      pricePerMsnUsdMicro: 500_000n, providerQuoteReference: "custody-quote",
      issuedAtMs: 1000, expiresAtMs: 60000,
    };
    const provider = { async verifyByReference(asked: string) {
      expect(asked).toBe(txRef);
      return { txRef, transactionId: providerTransactionId,
        providerReference: "FLW-test", status: "successful",
        amount: "150.25", currency: "NGN" };
    }};
    return { quote, provider };
  }

  it("reads a real credited source row and re-verifies provider receipt without issuing MSN", async () => {
    const { quote, provider } = await funded();
    const reader = createMsnFiatIntakeReader(pool);
    const output = await verifyMsnFiatIntake({ quote, reader, provider, observedAtMs: 60_000 });
    expect(output.state).toBe("fiat_verified_backing_pending");
    expect(output.fundingKobo).toBe("15025");
    const noIssue = await pool.query(
      "SELECT count(*)::int AS count FROM commerce.ngn_wallet_entries WHERE tenant_id=$1 AND reason='adjustment'",
      [quote.tenantId],
    );
    expect(noIssue.rows[0]?.count).toBe(0);
  });

  it("cannot read funding in another tenant or account", async () => {
    const { quote } = await funded();
    const reader = createMsnFiatIntakeReader(pool);
    expect(await reader.read({ tenantId: randomUUID(), userId: quote.userId,
      fundingReference: quote.fundingReference })).toBeNull();
    expect(await reader.read({ tenantId: quote.tenantId, userId: randomUUID(),
      fundingReference: quote.fundingReference })).toBeNull();
  });

  it("rejects a provider amount mismatch without debiting NGN or minting", async () => {
    const { quote, provider } = await funded();
    const reader = createMsnFiatIntakeReader(pool);
    await expect(verifyMsnFiatIntake({
      quote, reader, provider: { async verifyByReference(ref) {
        const value = await provider.verifyByReference(ref);
        return { ...value, amount: "150.24" };
      } }, observedAtMs: 60_000,
    })).rejects.toThrow("msn.fiat_intake.provider_mismatch");
    const count = await pool.query(
      "SELECT count(*)::int AS n FROM commerce.ngn_wallet_entries WHERE tenant_id=$1",
      [quote.tenantId],
    );
    expect(count.rows[0]?.n).toBe(1); // the original funding credit, no consumption
  });
});

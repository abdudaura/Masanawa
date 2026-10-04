import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createBillingQuote, formatNgnKobo } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresBillingQuoteRepository } from "./billing-funding.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("billing NGN funding PostgreSQL acceptance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(
        new URL("../../../../../packages/commerce/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  function fixture() {
    const repository = createPostgresBillingQuoteRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const createdAt = new Date().toISOString();
    const quote = createBillingQuote({
      tenantId,
      userId,
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10_000,
      feeAmountKobo: 100,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 15 * 60_000).toISOString(),
    });
    return { repository, tenantId, userId, quote };
  }

  async function funded() {
    const f = fixture();
    await f.repository.createQuote(f.quote);
    await f.repository.confirmQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      confirmedAt: new Date().toISOString(),
    });
    await f.repository.bindCheckout({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      txRef: `bill-${f.quote.quoteId}-r1`,
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      boundAt: new Date().toISOString(),
    });
    await f.repository.recordVerifiedPayment({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      txRef: `bill-${f.quote.quoteId}-r1`,
      providerTransactionId: String(Date.now()) + f.quote.quoteId.slice(-8),
      providerReference: `FLW-${f.quote.quoteId}`,
      amountKobo: f.quote.totalAmountKobo,
      currency: "NGN",
      verifiedAt: new Date().toISOString(),
    });
    return f;
  }

  it("binds verified exact payment before allowing one fulfillment reserve", async () => {
    const f = await funded();
    const fulfillmentReference = `bill-${f.quote.quoteId}`;

    await expect(f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference,
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: "99",
      currency: "NGN",
    })).rejects.toThrow("quote_terms_mismatch");

    await Promise.all([
      f.repository.reserveConfirmedBill({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: f.quote.revision,
        fulfillmentReference,
        billerCode: f.quote.billerCode,
        itemCode: f.quote.itemCode,
        customerId: f.quote.customerId,
        amount: formatNgnKobo(f.quote.serviceAmountKobo),
        currency: "NGN",
      }),
      f.repository.reserveConfirmedBill({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: f.quote.revision,
        fulfillmentReference,
        billerCode: f.quote.billerCode,
        itemCode: f.quote.itemCode,
        customerId: f.quote.customerId,
        amount: formatNgnKobo(f.quote.serviceAmountKobo),
        currency: "NGN",
      }),
    ]);

    await expect(f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference: `${fulfillmentReference}-changed`,
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: formatNgnKobo(f.quote.serviceAmountKobo),
      currency: "NGN",
    })).rejects.toThrow("reserve_replay_conflict");

    await expect(f.repository.readQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
    })).resolves.toMatchObject({
      state: "reserved",
      fulfillmentReference,
    });
  });

  it("keeps funding and bill provider references separate through settlement", async () => {
    const f = await funded();
    const fulfillmentReference = `bill-${f.quote.quoteId}`;
    await f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference,
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: formatNgnKobo(f.quote.serviceAmountKobo),
      currency: "NGN",
    });
    const before = await f.repository.readQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
    });
    await f.repository.settleBill({
      tenantId: f.tenantId,
      userId: f.userId,
      fulfillmentReference,
      state: "succeeded",
      providerReference: "BILL-PROVIDER-1",
    });
    await expect(f.repository.readQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
    })).resolves.toMatchObject({
      state: "succeeded",
      providerReference: before!.providerReference,
      billProviderReference: "BILL-PROVIDER-1",
      settlementState: "succeeded",
    });
  });

  it("persists refund dispatch before external send and advances monotonically", async () => {
    const f = await funded();
    const fulfillmentReference = `bill-${f.quote.quoteId}`;
    await f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference,
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: formatNgnKobo(f.quote.serviceAmountKobo),
      currency: "NGN",
    });
    await f.repository.settleBill({
      tenantId: f.tenantId,
      userId: f.userId,
      fulfillmentReference,
      state: "failed",
      providerReference: "BILL-FAILED-1",
    });
    const pending = await f.repository.readQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
    });
    expect(pending?.state).toBe("refund-pending");

    const [claimedA, claimedB] = await Promise.all([
      f.repository.claimRefundDispatch({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        providerTransactionId: pending!.providerTransactionId!,
        claimedAt: new Date().toISOString(),
      }),
      f.repository.claimRefundDispatch({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        providerTransactionId: pending!.providerTransactionId!,
        claimedAt: new Date().toISOString(),
      }),
    ]);
    expect(claimedA.state).toBe("refund-dispatching");
    expect(claimedB.state).toBe("refund-dispatching");

    const submitted = await f.repository.recordRefundInitiated({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      providerTransactionId: pending!.providerTransactionId!,
      refundReference: "REFUND-1",
      initiatedAt: new Date().toISOString(),
    });
    expect(submitted.state).toBe("refund-submitted");

    const refunded = await f.repository.markRefunded({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      providerTransactionId: pending!.providerTransactionId!,
      refundReference: "REFUND-1",
      refundedAt: new Date().toISOString(),
    });
    expect(refunded).toMatchObject({
      state: "refunded",
      refundReference: "REFUND-1",
    });
  });

  it("rejects reuse of one verified provider payment across different quotes", async () => {
    const first = fixture();
    const second = fixture();
    const providerTransactionId = `tx-${Date.now()}-${first.quote.quoteId.slice(-6)}`;

    for (const f of [first, second]) {
      await f.repository.createQuote(f.quote);
      await f.repository.confirmQuote({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: 1,
        confirmedAt: new Date().toISOString(),
      });
      await f.repository.bindCheckout({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: 1,
        txRef: `bill-${f.quote.quoteId}-r1`,
        checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
        boundAt: new Date().toISOString(),
      });
    }

    await first.repository.recordVerifiedPayment({
      tenantId: first.tenantId,
      userId: first.userId,
      quoteId: first.quote.quoteId,
      quoteRevision: 1,
      txRef: `bill-${first.quote.quoteId}-r1`,
      providerTransactionId,
      providerReference: "FLW-UNIQUE",
      amountKobo: first.quote.totalAmountKobo,
      currency: "NGN",
      verifiedAt: new Date().toISOString(),
    });

    await expect(second.repository.recordVerifiedPayment({
      tenantId: second.tenantId,
      userId: second.userId,
      quoteId: second.quote.quoteId,
      quoteRevision: 1,
      txRef: `bill-${second.quote.quoteId}-r1`,
      providerTransactionId,
      providerReference: "FLW-UNIQUE",
      amountKobo: second.quote.totalAmountKobo,
      currency: "NGN",
      verifiedAt: new Date().toISOString(),
    })).rejects.toThrow("payment_evidence_already_used");
  });

  it("enforces immutable billing economics in PostgreSQL", async () => {
    const f = fixture();
    await f.repository.createQuote(f.quote);
    await expect(pool.query(
      `UPDATE commerce.billing_quotes
          SET total_amount_kobo=1
        WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
      [f.tenantId,f.userId,f.quote.quoteId],
    )).rejects.toMatchObject({ code: "23514" });
  });
});

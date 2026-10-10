import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestDatabase } from "./isolated-test-database.js";
import { createCanonicalId } from "@masanawa/contracts";
import { createBillingQuote, formatNgnKobo } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresBillingQuoteRepository } from "./billing-funding.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("billing NGN funding PostgreSQL acceptance", () => {
  let pool: Pool;
  let isolated: Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>> | undefined;

  beforeAll(async () => {
    isolated = await createIsolatedPostgresTestDatabase(connectionString!);
    pool = isolated.pool;
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(
        new URL("../../../../../packages/commerce/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await isolated?.close();
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
    const txRef = `bill-${f.quote.quoteId}-r1`;
    const checkoutClaim = await f.repository.claimCheckoutDispatch({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      txRef,
      claimedAt: new Date().toISOString(),
    });
    expect(checkoutClaim.claimed).toBe(true);
    await f.repository.bindCheckout({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      txRef,
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

  it("grants exactly one hosted-checkout dispatch claim under concurrency", async () => {
    const f = fixture();
    await f.repository.createQuote(f.quote);
    await f.repository.confirmQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      confirmedAt: new Date().toISOString(),
    });
    const txRef = `bill-${f.quote.quoteId}-r1`;
    const [left,right] = await Promise.all([
      f.repository.claimCheckoutDispatch({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: f.quote.revision,
        txRef,
        claimedAt: new Date().toISOString(),
      }),
      f.repository.claimCheckoutDispatch({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: f.quote.revision,
        txRef,
        claimedAt: new Date().toISOString(),
      }),
    ]);

    expect([left.claimed,right.claimed].sort()).toEqual([false,true]);
    expect(left.quote.checkoutTxRef).toBe(txRef);
    expect(right.quote.checkoutTxRef).toBe(txRef);
    await expect(f.repository.readQuote({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
    })).resolves.toMatchObject({
      state: "checkout-dispatching",
      checkoutTxRef: txRef,
      checkoutUrl: null,
    });
  });

  it("binds verified exact payment before allowing one fulfillment reserve", async () => {
    const f = await funded();
    const fulfillmentReference = `bill-${f.quote.quoteId}`;

    await expect(f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference,
      categoryCode: f.quote.categoryCode,
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: "99",
      currency: "NGN",
    })).rejects.toThrow("quote_terms_mismatch");

    await expect(f.repository.reserveConfirmedBill({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      fulfillmentReference,
      categoryCode: "MOBILEDATA",
      billerCode: f.quote.billerCode,
      itemCode: f.quote.itemCode,
      customerId: f.quote.customerId,
      amount: formatNgnKobo(f.quote.serviceAmountKobo),
      currency: "NGN",
    })).rejects.toThrow("quote_terms_mismatch");

    await Promise.all([
      f.repository.reserveConfirmedBill({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: f.quote.revision,
        fulfillmentReference,
        categoryCode: f.quote.categoryCode,
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
        categoryCode: f.quote.categoryCode,
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
      categoryCode: f.quote.categoryCode,
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

  it("allows an already-paid hosted checkout to reserve after the short quote TTL", async () => {
    const repository = createPostgresBillingQuoteRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const quote = createBillingQuote({
      tenantId,
      userId,
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10_000,
      feeAmountKobo: 0,
      createdAt: "2026-10-04T20:00:00.000Z",
      expiresAt: "2026-10-04T20:01:00.000Z",
    });
    await repository.createQuote(quote);
    await repository.confirmQuote({
      tenantId,
      userId,
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      confirmedAt: "2026-10-04T20:00:20.000Z",
    });
    const txRef = `bill-${quote.quoteId}-r1`;
    await repository.claimCheckoutDispatch({
      tenantId,
      userId,
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      txRef,
      claimedAt: "2026-10-04T20:00:25.000Z",
    });
    await repository.bindCheckout({
      tenantId,
      userId,
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      txRef,
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      boundAt: "2026-10-04T20:02:00.000Z",
    });

    // Both the provider's checkout response and later payment evidence may
    // arrive after the short quote TTL because external dispatch was atomically
    // admitted while terms were still live.
    await repository.recordVerifiedPayment({
      tenantId,
      userId,
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      txRef: `bill-${quote.quoteId}-r1`,
      providerTransactionId: `99${quote.quoteId.replace(/\D/gu, "").slice(-8) || "12345678"}`,
      providerReference: `FLW-LATE-${quote.quoteId}`,
      amountKobo: quote.totalAmountKobo,
      currency: "NGN",
      verifiedAt: "2026-10-04T20:02:30.000Z",
    });

    const fulfillmentReference = `bill-${quote.quoteId}`;
    await expect(repository.reserveConfirmedBill({
      tenantId,
      userId,
      quoteId: quote.quoteId,
      quoteRevision: quote.revision,
      fulfillmentReference,
      categoryCode: quote.categoryCode,
      billerCode: quote.billerCode,
      itemCode: quote.itemCode,
      customerId: quote.customerId,
      amount: formatNgnKobo(quote.serviceAmountKobo),
      currency: "NGN",
    })).resolves.toBeUndefined();

    await expect(repository.readQuote({
      tenantId,
      userId,
      quoteId: quote.quoteId,
    })).resolves.toMatchObject({
      state: "reserved",
      fulfillmentReference,
      paymentVerifiedAt: "2026-10-04T20:02:30.000Z",
    });
  });

  it("moves verified unreserved funds into refund custody idempotently", async () => {
    const f = await funded();
    const first = await f.repository.requestFundedRefund({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      requestedAt: new Date().toISOString(),
    });
    const replay = await f.repository.requestFundedRefund({
      tenantId: f.tenantId,
      userId: f.userId,
      quoteId: f.quote.quoteId,
      quoteRevision: f.quote.revision,
      requestedAt: new Date().toISOString(),
    });
    expect(first).toMatchObject({
      state: "refund-pending",
      settlementState: "failed",
      fulfillmentReference: null,
    });
    expect(replay.state).toBe("refund-pending");

    await expect(f.repository.readByFulfillmentReference({
      fulfillmentReference: `bill-${f.quote.quoteId}`,
    })).resolves.toBeNull();
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
      categoryCode: f.quote.categoryCode,
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
      categoryCode: f.quote.categoryCode,
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
    expect(claimedA.quote.state).toBe("refund-dispatching");
    expect(claimedB.quote.state).toBe("refund-dispatching");
    expect([claimedA.claimed,claimedB.claimed].sort()).toEqual([false,true]);

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
      const txRef = `bill-${f.quote.quoteId}-r1`;
      await f.repository.claimCheckoutDispatch({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: 1,
        txRef,
        claimedAt: new Date().toISOString(),
      });
      await f.repository.bindCheckout({
        tenantId: f.tenantId,
        userId: f.userId,
        quoteId: f.quote.quoteId,
        quoteRevision: 1,
        txRef,
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

  it("rejects a new wallet reserve after confirmed quote expiry", async () => {
    const repo = createPostgresBillingQuoteRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const createdAt = new Date(Date.now() - 120_000).toISOString();
    const confirmedAt = new Date(Date.now() - 90_000).toISOString();
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const expiredQuote = createBillingQuote({
      tenantId, userId, categoryCode: "AIRTIME",
      billerCode: "BIL102", itemCode: "AT102", itemName: "MTN Airtime",
      customerId: "+2348012345678", serviceAmountKobo: 10_000,
      feeAmountKobo: 100, createdAt, expiresAt: expiredAt,
    });
    await repo.createQuote(expiredQuote);
    await repo.confirmQuote({
      tenantId, userId, quoteId: expiredQuote.quoteId,
      quoteRevision: expiredQuote.revision, confirmedAt,
    });
    const fulfillmentReference = `bill-${expiredQuote.quoteId}-r1`;
    await expect(repo.reserveConfirmedBill({
      tenantId, userId, quoteId: expiredQuote.quoteId,
      quoteRevision: expiredQuote.revision, fulfillmentReference,
      categoryCode: expiredQuote.categoryCode,
      billerCode: expiredQuote.billerCode, itemCode: expiredQuote.itemCode,
      customerId: expiredQuote.customerId,
      amount: formatNgnKobo(expiredQuote.serviceAmountKobo),
      currency: "NGN",
    })).rejects.toThrow("financial.billing.quote_expired");
    const current = await repo.readQuote({
      tenantId, userId, quoteId: expiredQuote.quoteId,
    });
    expect(current?.state).toBe("confirmed");
    expect(current?.fulfillmentReference).toBeNull();
    const reservations = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM commerce.ngn_bill_reservations
        WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
      [tenantId,userId,expiredQuote.quoteId],
    );
    expect(reservations.rows[0]?.count).toBe("0");
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

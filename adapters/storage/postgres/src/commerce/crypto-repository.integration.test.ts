import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoIntent } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresCryptoRepository } from "./crypto-repository.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("crypto conversion and payout fee PostgreSQL acceptance", () => {
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

  function instant(offset = 0) {
    return toInstant(new Date(Date.parse("2026-10-05T00:00:00.000Z") + offset));
  }

  async function fundedFixture(balance = "100") {
    const repository = createPostgresCryptoRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const fundingRequestId = createCanonicalId("request");
    const createdAt = instant();

    const deposit: CryptoIntent = {
      schemaVersion: 1,
      tenantId,
      userId,
      requestId: fundingRequestId,
      operation: "deposit",
      asset: "USDTTRC20",
      network: "tron",
      amount: balance,
      targetAsset: null,
      destinationAddress: null,
      provider: "nowpayments",
      providerPaymentId: null,
      providerPayoutId: null,
      payAddress: null,
      providerPayAmount: null,
      providerDispatchStartedAt: createdAt,
      status: "processing",
      createdAt,
      updatedAt: createdAt,
    };
    await repository.createIntent(deposit);
    const fundingPaymentId = `fund-${fundingRequestId}`;
    await repository.bindProviderPayment({
      tenantId,
      userId,
      requestId: fundingRequestId,
      providerPaymentId: fundingPaymentId,
      payAddress: "fixture-deposit-address",
      providerPayAmount: balance,
      updatedAt: instant(1),
    });
    await repository.applyProviderPaymentEvent({
      tenantId,
      userId,
      event: {
        paymentId: fundingPaymentId,
        parentPaymentId: null,
        orderId: fundingRequestId,
        status: "finished",
        priceAmount: balance,
        priceCurrency: "USDTTRC20",
        payAmount: balance,
        payCurrency: "USDTTRC20",
        actuallyPaid: balance,
        payloadHash: createHash("sha256")
          .update(`${tenantId}:${fundingRequestId}:${balance}`)
          .digest("hex"),
        observedAt: instant(2),
      },
    });
    expect(await repository.readBalance({
      tenantId, userId, asset: "USDTTRC20", network: "tron",
    })).toBe(balance);
    return { repository, tenantId, userId, fundingRequestId, fundingPaymentId };
  }

  function conversionIntent(
    tenantId: Awaited<ReturnType<typeof fundedFixture>>["tenantId"],
    userId: Awaited<ReturnType<typeof fundedFixture>>["userId"],
    amount = "40",
  ): CryptoIntent {
    const createdAt = instant(10);
    return {
      schemaVersion: 1,
      tenantId,
      userId,
      requestId: createCanonicalId("request"),
      operation: "convert",
      asset: "USDTTRC20",
      network: "tron",
      amount,
      targetAsset: "BTC",
      targetNetwork: null,
      destinationAddress: null,
      provider: "nowpayments",
      providerPaymentId: null,
      providerPayoutId: null,
      providerConversionId: null,
      providerTargetAmount: null,
      payAddress: null,
      providerPayAmount: null,
      providerDispatchStartedAt: null,
      status: "processing",
      createdAt,
      updatedAt: createdAt,
    };
  }

  function buyIntent(
    tenantId: Awaited<ReturnType<typeof fundedFixture>>["tenantId"],
    userId: Awaited<ReturnType<typeof fundedFixture>>["userId"],
  ): CryptoIntent {
    const createdAt = instant(18);
    return {
      schemaVersion: 1,
      tenantId,
      userId,
      requestId: createCanonicalId("request"),
      operation: "buy",
      asset: "NGN",
      network: null,
      amount: "1500",
      targetAsset: "USDTTRC20",
      targetNetwork: "tron",
      destinationAddress: null,
      provider: "nowpayments",
      providerPaymentId: null,
      providerPayoutId: null,
      providerInvoiceId: null,
      checkoutUrl: null,
      providerConversionId: null,
      providerTargetAmount: null,
      payAddress: null,
      providerPayAmount: null,
      providerDispatchStartedAt: null,
      status: "quoted",
      createdAt,
      updatedAt: createdAt,
    };
  }

  function withdrawalIntent(
    tenantId: Awaited<ReturnType<typeof fundedFixture>>["tenantId"],
    userId: Awaited<ReturnType<typeof fundedFixture>>["userId"],
    amount = "10",
  ): CryptoIntent {
    const createdAt = instant(20);
    return {
      schemaVersion: 1,
      tenantId,
      userId,
      requestId: createCanonicalId("request"),
      operation: "withdraw",
      asset: "USDTTRC20",
      network: "tron",
      amount,
      targetAsset: null,
      destinationAddress: "fixture-wallet",
      provider: "nowpayments",
      providerPaymentId: null,
      providerPayoutId: null,
      payAddress: null,
      providerPayAmount: null,
      providerDispatchStartedAt: null,
      status: "processing",
      createdAt,
      updatedAt: createdAt,
    };
  }

  it("does not authorize a child payment from parent identity alone", async () => {
    const f = await fundedFixture("30");
    await expect(f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        paymentId: "child-payment",
        parentPaymentId: f.fundingPaymentId,
        orderId: f.fundingRequestId,
        status: "finished",
        priceAmount: "30",
        priceCurrency: "USDTTRC20",
        payAmount: "30",
        payCurrency: "USDTTRC20",
        actuallyPaid: "30",
        payloadHash: createHash("sha256").update("child-payment").digest("hex"),
        observedAt: instant(4),
      },
    })).rejects.toThrow("crypto.provider_payment.intent_mismatch");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("30");
  });

  it("reverses a provider deposit refund exactly once and never resurrects refunded state", async () => {
    const f = await fundedFixture("30");
    const refundEvent = {
      paymentId: f.fundingPaymentId,
      parentPaymentId: null,
      orderId: f.fundingRequestId,
      status: "refunded" as const,
      priceAmount: "30",
      priceCurrency: "USDTTRC20",
      payAmount: "30",
      payCurrency: "USDTTRC20",
      actuallyPaid: "30",
      payloadHash: createHash("sha256").update("refund-one").digest("hex"),
      observedAt: instant(5),
    };
    const refunded = await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: refundEvent,
    });
    expect(refunded.status).toBe("refunded");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("0");

    await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...refundEvent,
        payloadHash: createHash("sha256").update("refund-two").digest("hex"),
        observedAt: instant(6),
      },
    });
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("0");

    const afterLateFinished = await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...refundEvent,
        status: "finished",
        payloadHash: createHash("sha256").update("late-finished").digest("hex"),
        observedAt: instant(7),
      },
    });
    expect(afterLateFinished.status).toBe("refunded");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("0");

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM commerce.crypto_ledger_entries
        WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
          AND reason='provider-refund'`,
      [f.tenantId, f.userId, f.fundingRequestId],
    );
    expect(count.rows[0]?.count).toBe("1");
  });

  it("debits source once and credits the exact evidenced target once", async () => {
    const f = await fundedFixture();
    const intent = conversionIntent(f.tenantId, f.userId);

    const [first, replay] = await Promise.all([
      f.repository.reserveConversion(intent),
      f.repository.reserveConversion(intent),
    ]);
    expect(first).toEqual(replay);
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("60");

    const bound = await f.repository.bindProviderConversion({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: intent.requestId,
      providerConversionId: "conversion-1",
      updatedAt: instant(11),
    });
    expect(bound.providerConversionId).toBe("conversion-1");

    const settled = await f.repository.settleConversion({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: intent.requestId,
      succeeded: true,
      targetAmount: "0.00064",
      providerReference: "conversion-1",
      updatedAt: instant(12),
    });
    expect(settled.status).toBe("succeeded");
    expect(settled.providerTargetAmount).toBe("0.00064");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "BTC", network: null,
    })).toBe("0.00064");

    const replayed = await f.repository.settleConversion({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: intent.requestId,
      succeeded: true,
      targetAmount: "0.00064",
      providerReference: "conversion-1",
      updatedAt: instant(13),
    });
    expect(replayed).toEqual(settled);
    await expect(f.repository.settleConversion({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: intent.requestId,
      succeeded: true,
      targetAmount: "0.00065",
      providerReference: "conversion-1",
      updatedAt: instant(14),
    })).rejects.toThrow("crypto.convert.terminal_conflict");

    const counts = await pool.query<{ reason: string; count: string }>(
      `SELECT reason, count(*)::text AS count
         FROM commerce.crypto_ledger_entries
        WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
        GROUP BY reason ORDER BY reason`,
      [f.tenantId, f.userId, intent.requestId],
    );
    expect(counts.rows).toEqual([
      { reason: "conversion-credit", count: "1" },
      { reason: "conversion-debit", count: "1" },
    ]);
  });

  it("will not credit a successful conversion before provider identity is bound", async () => {
    const f = await fundedFixture();
    const intent = conversionIntent(f.tenantId, f.userId, "10");
    await f.repository.reserveConversion(intent);
    await expect(f.repository.settleConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: true, targetAmount: "0.00016",
      providerReference: null, updatedAt: instant(15),
    })).rejects.toThrow("crypto.provider_conversion.unbound");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "BTC", network: null,
    })).toBe("0");
  });

  it("releases source principal exactly once when conversion fails", async () => {
    const f = await fundedFixture();
    const intent = conversionIntent(f.tenantId, f.userId, "25");
    await f.repository.reserveConversion(intent);
    await f.repository.bindProviderConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      providerConversionId: "conversion-failed", updatedAt: instant(21),
    });
    await f.repository.settleConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: false, targetAmount: null,
      providerReference: "conversion-failed", updatedAt: instant(22),
    });
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("100");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "BTC", network: null,
    })).toBe("0");
  });

  it("rejects changed conversion replay and contradictory terminal settlement", async () => {
    const f = await fundedFixture();
    const intent = conversionIntent(f.tenantId, f.userId);
    await f.repository.reserveConversion(intent);
    await expect(f.repository.reserveConversion({
      ...intent, targetAsset: "ETH", targetNetwork: null,
    })).rejects.toThrow("crypto.convert.replay_conflict");

    await f.repository.bindProviderConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      providerConversionId: "conversion-2", updatedAt: instant(31),
    });
    await f.repository.settleConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: true, targetAmount: "0.0006",
      providerReference: "conversion-2", updatedAt: instant(32),
    });
    await expect(f.repository.settleConversion({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: false, targetAmount: null,
      providerReference: "conversion-2", updatedAt: instant(33),
    })).rejects.toThrow("crypto.convert.terminal_conflict");
  });

  it("prevents concurrent conversions from overdrawing the same source balance", async () => {
    const f = await fundedFixture("50");
    const first = conversionIntent(f.tenantId, f.userId, "40");
    const second = { ...conversionIntent(f.tenantId, f.userId, "40"), requestId: createCanonicalId("request") };
    const results = await Promise.allSettled([
      f.repository.reserveConversion(first),
      f.repository.reserveConversion(second),
    ]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("10");
  });

  it("credits and refunds the exact fiat-purchase crypto outcome once", async () => {
    const f = await fundedFixture("20");
    const purchase = buyIntent(f.tenantId, f.userId);
    await f.repository.createIntent(purchase);
    const boundInvoice = await f.repository.bindProviderInvoice({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: purchase.requestId,
      providerInvoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
      updatedAt: instant(19),
    });
    expect(boundInvoice.status).toBe("awaiting_payment");

    const finished = {
      paymentId: "fiat-payment-1",
      invoiceId: "invoice-1",
      parentPaymentId: null,
      orderId: purchase.requestId,
      status: "finished" as const,
      priceAmount: "1500",
      priceCurrency: "NGN",
      payAmount: "1500",
      payCurrency: "NGN",
      actuallyPaid: "1500",
      outcomeAmount: "1.234567",
      outcomeCurrency: "USDTTRC20",
      payloadHash: createHash("sha256").update("fiat-finished-1").digest("hex"),
      observedAt: instant(20),
    };
    const settled = await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: finished,
    });
    expect(settled.status).toBe("succeeded");
    expect(settled.providerPaymentId).toBe("fiat-payment-1");
    expect(settled.providerTargetAmount).toBe("1.234567");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId,
      userId: f.userId,
      asset: "USDTTRC20",
      network: "tron",
    })).toBe("21.234567");

    await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...finished,
        payloadHash: createHash("sha256").update("fiat-finished-2").digest("hex"),
        observedAt: instant(21),
      },
    });
    expect(await f.repository.readBalance({
      tenantId: f.tenantId,
      userId: f.userId,
      asset: "USDTTRC20",
      network: "tron",
    })).toBe("21.234567");

    await expect(f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...finished,
        outcomeAmount: "1.234568",
        payloadHash: createHash("sha256").update("fiat-finished-conflict").digest("hex"),
        observedAt: instant(21),
      },
    })).rejects.toThrow("crypto.buy.terminal_conflict");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId,
      userId: f.userId,
      asset: "USDTTRC20",
      network: "tron",
    })).toBe("21.234567");

    const refunded = await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...finished,
        status: "refunded" as const,
        outcomeAmount: null,
        outcomeCurrency: null,
        payloadHash: createHash("sha256").update("fiat-refunded-1").digest("hex"),
        observedAt: instant(22),
      },
    });
    expect(refunded.status).toBe("refunded");
    expect(refunded.providerTargetAmount).toBeNull();
    expect(await f.repository.readBalance({
      tenantId: f.tenantId,
      userId: f.userId,
      asset: "USDTTRC20",
      network: "tron",
    })).toBe("20");

    await f.repository.applyProviderPaymentEvent({
      tenantId: f.tenantId,
      userId: f.userId,
      event: {
        ...finished,
        status: "refunded" as const,
        outcomeAmount: null,
        outcomeCurrency: null,
        payloadHash: createHash("sha256").update("fiat-refunded-2").digest("hex"),
        observedAt: instant(23),
      },
    });
    const counts = await pool.query<{ reason: string; count: string }>(
      `SELECT reason, count(*)::text AS count
         FROM commerce.crypto_ledger_entries
        WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
          AND reason IN ('fiat-purchase-credit','fiat-purchase-refund')
        GROUP BY reason ORDER BY reason`,
      [f.tenantId, f.userId, purchase.requestId],
    );
    expect(counts.rows).toEqual([
      { reason: "fiat-purchase-credit", count: "1" },
      { reason: "fiat-purchase-refund", count: "1" },
    ]);
  });

  it("resolves a payout callback by globally unique provider batch id", async () => {
    const f = await fundedFixture();
    const intent = withdrawalIntent(f.tenantId, f.userId, "10");
    await f.repository.reserveWithdrawal(intent);
    const bound = await f.repository.bindProviderPayout({
      tenantId: f.tenantId,
      userId: f.userId,
      requestId: intent.requestId,
      providerPayoutId: "batch-global-1",
      updatedAt: instant(39),
    });
    await expect(f.repository.readIntentByProviderPayoutId({
      providerPayoutId: "batch-global-1",
    })).resolves.toEqual(bound);
    await expect(f.repository.readIntentByProviderPayoutId({
      providerPayoutId: "missing-batch",
    })).resolves.toBeNull();

    const other = await fundedFixture();
    const otherIntent = withdrawalIntent(other.tenantId, other.userId, "10");
    await other.repository.reserveWithdrawal(otherIntent);
    await expect(other.repository.bindProviderPayout({
      tenantId: other.tenantId,
      userId: other.userId,
      requestId: otherIntent.requestId,
      providerPayoutId: "batch-global-1",
      updatedAt: instant(40),
    })).rejects.toMatchObject({ code: "23505" });
  });

  it("reserves and releases a user-paid payout network fee atomically", async () => {
    const f = await fundedFixture();
    const intent = withdrawalIntent(f.tenantId, f.userId);
    const admitted = await f.repository.reserveWithdrawalWithFee({
      intent,
      networkFee: "0.5",
      feePayer: "user",
    });
    expect(admitted.providerNetworkFee).toBe("0.5");
    expect(admitted.withdrawalFeePayer).toBe("user");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("89.5");

    await f.repository.settleWithdrawal({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: false, providerReference: "withdrawal-1", updatedAt: instant(41),
    });
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("100");

    const counts = await pool.query<{ reason: string; count: string }>(
      `SELECT reason, count(*)::text AS count
         FROM commerce.crypto_ledger_entries
        WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
        GROUP BY reason ORDER BY reason`,
      [f.tenantId, f.userId, intent.requestId],
    );
    expect(counts.rows).toEqual([
      { reason: "withdrawal-fee-release", count: "1" },
      { reason: "withdrawal-fee-reserve", count: "1" },
      { reason: "withdrawal-release", count: "1" },
      { reason: "withdrawal-reserve", count: "1" },
    ]);
  });

  it("rejects a contradictory terminal withdrawal replay", async () => {
    const f = await fundedFixture();
    const intent = withdrawalIntent(f.tenantId, f.userId);
    await f.repository.reserveWithdrawal(intent);
    await f.repository.settleWithdrawal({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: true, providerReference: "withdrawal-ok", updatedAt: instant(45),
    });
    await expect(f.repository.settleWithdrawal({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: false, providerReference: "withdrawal-failed", updatedAt: instant(46),
    })).rejects.toThrow("crypto.withdraw.terminal_conflict");
  });

  it("does not charge the user when the platform is the declared network-fee payer", async () => {
    const f = await fundedFixture();
    const intent = withdrawalIntent(f.tenantId, f.userId);
    const admitted = await f.repository.reserveWithdrawalWithFee({
      intent,
      networkFee: "0.5",
      feePayer: "platform",
    });
    expect(admitted.providerNetworkFee).toBe("0.5");
    expect(admitted.withdrawalFeePayer).toBe("platform");
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("90");

    await f.repository.settleWithdrawal({
      tenantId: f.tenantId, userId: f.userId, requestId: intent.requestId,
      succeeded: true, providerReference: "withdrawal-2", updatedAt: instant(51),
    });
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId, asset: "USDTTRC20", network: "tron",
    })).toBe("90");
  });

  it("keeps crypto ledger and authenticated provider evidence append-only", async () => {
    const f = await fundedFixture("20");
    await expect(pool.query(
      "UPDATE commerce.crypto_ledger_entries SET amount=1 WHERE tenant_id=$1",
      [f.tenantId],
    )).rejects.toThrow("crypto financial evidence is immutable");
    await expect(pool.query(
      "DELETE FROM commerce.crypto_ledger_entries WHERE tenant_id=$1",
      [f.tenantId],
    )).rejects.toThrow("crypto financial evidence is immutable");
    await expect(pool.query(
      "UPDATE commerce.crypto_provider_events SET status='failed' WHERE tenant_id=$1",
      [f.tenantId],
    )).rejects.toThrow("crypto financial evidence is immutable");
    await expect(pool.query(
      "DELETE FROM commerce.crypto_provider_events WHERE tenant_id=$1",
      [f.tenantId],
    )).rejects.toThrow("crypto financial evidence is immutable");
  });

  it("does not let one user's negative balance offset another user's custody liability", async () => {
    const f = await fundedFixture("30");
    const negativeUserId = createCanonicalId("user");
    const negativeRequestId = createCanonicalId("request");
    const createdAt = instant(60);
    await f.repository.createIntent({
      schemaVersion: 1,
      tenantId: f.tenantId,
      userId: negativeUserId,
      requestId: negativeRequestId,
      operation: "deposit",
      asset: "USDTTRC20",
      network: "tron",
      amount: "100",
      targetAsset: null,
      destinationAddress: null,
      provider: "nowpayments",
      providerPaymentId: null,
      providerPayoutId: null,
      payAddress: null,
      providerPayAmount: null,
      providerDispatchStartedAt: null,
      status: "processing",
      createdAt,
      updatedAt: createdAt,
    });
    await pool.query(
      `INSERT INTO commerce.crypto_ledger_entries(
         tenant_id,ledger_entry_id,user_id,asset,network,amount,direction,reason,
         request_id,provider_reference,definition,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6::numeric,'debit','adjustment',$7,NULL,$8::jsonb,$9)`,
      [
        f.tenantId,
        createCanonicalId("ledger-entry"),
        negativeUserId,
        "USDTTRC20",
        "tron",
        "100",
        negativeRequestId,
        JSON.stringify({ fixture: "negative-balance" }),
        createdAt,
      ],
    );
    expect(await f.repository.readBalance({
      tenantId: f.tenantId, userId: negativeUserId, asset: "USDTTRC20", network: "tron",
    })).toBe("-100");
    expect(await f.repository.readAggregateLiability({
      tenantId: f.tenantId, asset: "USDTTRC20", network: "tron",
    })).toBe("30");
  });

  it("aggregates shared custody liability across separate tenants", async () => {
    const repository = createPostgresCryptoRepository(pool);
    const before = Number(await repository.readPlatformAggregateLiability({
      asset: "USDTTRC20",
      network: "tron",
    }));
    const first = await fundedFixture("11");
    await fundedFixture("13");
    const afterFunding = Number(await repository.readPlatformAggregateLiability({
      asset: "USDTTRC20",
      network: "tron",
    }));
    expect(afterFunding - before).toBe(24);

    await first.repository.reserveWithdrawal(
      withdrawalIntent(first.tenantId, first.userId, "5"),
    );
    const afterReserve = Number(await repository.readPlatformAggregateLiability({
      asset: "USDTTRC20",
      network: "tron",
    }));
    expect(afterFunding - afterReserve).toBe(5);
  });

  it("reports aggregate liability for pooled-custody reconciliation", async () => {
    const f = await fundedFixture("75");
    expect(await f.repository.readAggregateLiability({
      tenantId: f.tenantId, asset: "USDTTRC20", network: "tron",
    })).toBe("75");
    const withdrawal = withdrawalIntent(f.tenantId, f.userId, "5");
    await f.repository.reserveWithdrawal(withdrawal);
    expect(await f.repository.readAggregateLiability({
      tenantId: f.tenantId, asset: "USDTTRC20", network: "tron",
    })).toBe("70");
  });

  it("returns compact exact decimal custody balances and liabilities", async () => {
    const f = await fundedFixture("30.125");
    const balance = () => f.repository.readBalance({
      tenantId: f.tenantId, userId: f.userId,
      asset: "USDTTRC20", network: "tron",
    });
    const liability = () => f.repository.readAggregateLiability({
      tenantId: f.tenantId, asset: "USDTTRC20", network: "tron",
    });

    // Decimal strings remain lossless. PostgreSQL NUMERIC storage scale
    // must not leak into the public amount contract as trailing zeroes.
    expect(await balance()).toBe("30.125");
    expect(await liability()).toBe("30.125");

    await f.repository.reserveWithdrawal(
      withdrawalIntent(f.tenantId, f.userId, "0.125"),
    );
    expect(await balance()).toBe("30");
    expect(await liability()).toBe("30");
  });
});

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
    await repository.bindProviderPayment({
      tenantId,
      userId,
      requestId: fundingRequestId,
      providerPaymentId: `fund-${fundingRequestId}`,
      payAddress: "fixture-deposit-address",
      providerPayAmount: balance,
      updatedAt: instant(1),
    });
    await repository.applyProviderPaymentEvent({
      tenantId,
      userId,
      event: {
        paymentId: `fund-${fundingRequestId}`,
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
    return { repository, tenantId, userId };
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
});

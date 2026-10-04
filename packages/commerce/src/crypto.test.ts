import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { normalizeCryptoIntent, type CryptoIntent } from "./crypto.js";

const at = toInstant("2026-10-05T00:00:00.000Z");
const base: CryptoIntent = {
  schemaVersion: 1,
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  requestId: createCanonicalId("request"),
  operation: "convert",
  asset: "USDTTRC20",
  network: "tron",
  amount: "10.000000000000000001",
  targetAsset: "BTC",
  targetNetwork: null,
  destinationAddress: null,
  provider: "nowpayments",
  providerPaymentId: null,
  providerPayoutId: null,
  providerConversionId: "conversion-1",
  providerTargetAmount: null,
  payAddress: null,
  providerPayAmount: null,
  providerDispatchStartedAt: at,
  status: "processing",
  createdAt: at,
  updatedAt: at,
};

describe("crypto intent normalization", () => {
  it("preserves exact conversion source and settled target amounts", () => {
    const normalized = normalizeCryptoIntent({
      ...base,
      providerTargetAmount: "0.000160000000000001",
      status: "succeeded",
    });
    expect(normalized.amount).toBe("10.000000000000000001");
    expect(normalized.providerTargetAmount).toBe("0.000160000000000001");
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it("does not allow a target amount before successful provider settlement", () => {
    expect(() => normalizeCryptoIntent({
      ...base,
      providerTargetAmount: "0.00016",
      status: "processing",
    })).toThrow("crypto.provider_target_amount.unexpected");
  });

  it("rejects conversion metadata on deposits or withdrawals", () => {
    expect(() => normalizeCryptoIntent({
      ...base,
      operation: "deposit",
      targetAsset: null,
      targetNetwork: null,
      providerConversionId: "conversion-1",
      providerTargetAmount: null,
    })).toThrow("crypto.provider_conversion.unexpected");
    expect(() => normalizeCryptoIntent({
      ...base,
      operation: "withdraw",
      targetAsset: null,
      targetNetwork: null,
      destinationAddress: "wallet",
      providerConversionId: null,
      providerTargetAmount: "1",
      status: "succeeded",
    })).toThrow("crypto.provider_conversion.unexpected");
  });

  it("requires payout fee amount and payer to be complete and withdrawal-scoped", () => {
    const withdrawal: CryptoIntent = {
      ...base,
      operation: "withdraw",
      targetAsset: null,
      targetNetwork: null,
      destinationAddress: "wallet",
      providerConversionId: null,
      providerTargetAmount: null,
      providerNetworkFee: "0.1",
      withdrawalFeePayer: "user",
      status: "processing",
    };
    expect(normalizeCryptoIntent(withdrawal)).toMatchObject({
      providerNetworkFee: "0.1",
      withdrawalFeePayer: "user",
    });
    expect(() => normalizeCryptoIntent({
      ...withdrawal,
      withdrawalFeePayer: null,
    })).toThrow("crypto.withdrawal_fee.incomplete");
    expect(() => normalizeCryptoIntent({
      ...base,
      providerNetworkFee: "0.1",
      withdrawalFeePayer: "platform",
    })).toThrow("crypto.withdrawal_fee.unexpected");
  });
});

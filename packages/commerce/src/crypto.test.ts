import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  normalizeCryptoIntent,
  normalizeCryptoLedgerEntry,
  type CryptoIntent,
  type CryptoLedgerEntry,
} from "./crypto.js";

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
    })).toThrow("crypto.provider_target_amount.unexpected");
  });

  it("normalizes a hosted fiat Buy only with paired invoice evidence and exact settlement", () => {
    const purchase: CryptoIntent = {
      ...base,
      operation: "buy",
      asset: "NGN",
      network: null,
      amount: "1500.00",
      targetAsset: "USDTTRC20",
      targetNetwork: "tron",
      providerPaymentId: "fiat-payment-1",
      providerPayoutId: null,
      providerInvoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
      providerConversionId: null,
      providerTargetAmount: "1.234567000000000001",
      payAddress: null,
      providerPayAmount: null,
      status: "succeeded",
    };
    expect(normalizeCryptoIntent(purchase)).toMatchObject({
      operation: "buy",
      asset: "NGN",
      network: null,
      amount: "1500",
      targetAsset: "USDTTRC20",
      targetNetwork: "tron",
      providerInvoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
      providerTargetAmount: "1.234567000000000001",
    });
    expect(() => normalizeCryptoIntent({
      ...purchase,
      providerInvoiceId: null,
    })).toThrow("crypto.provider_invoice.incomplete");
    expect(() => normalizeCryptoIntent({
      ...purchase,
      checkoutUrl: "http://example.com/checkout",
    })).toThrow("crypto.checkout_url.insecure");
    expect(() => normalizeCryptoIntent({
      ...purchase,
      targetAsset: null,
    })).toThrow("crypto.buy.target.required");
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

describe("crypto ledger posting admission", () => {
  const ledgerBase: CryptoLedgerEntry = {
    schemaVersion: 1,
    tenantId: base.tenantId,
    ledgerEntryId: createCanonicalId("ledger-entry"),
    userId: base.userId,
    requestId: base.requestId,
    asset: "USDTTRC20",
    network: "tron",
    amount: "0.000000000000000001",
    direction: "credit",
    reason: "provider-deposit",
    providerReference: "payment-1",
    createdAt: at,
  };

  const cases: ReadonlyArray<readonly [CryptoLedgerEntry["reason"], "credit" | "debit"]> = [
    ["provider-deposit", "credit"],
    ["provider-refund", "debit"],
    ["withdrawal-reserve", "debit"],
    ["withdrawal-release", "credit"],
    ["withdrawal-fee-reserve", "debit"],
    ["withdrawal-fee-release", "credit"],
    ["conversion-debit", "debit"],
    ["conversion-credit", "credit"],
    ["conversion-release", "credit"],
    ["fiat-purchase-credit", "credit"],
    ["fiat-purchase-refund", "debit"],
    ["adjustment", "credit"],
    ["adjustment", "debit"],
  ];

  it("admits every canonical reason only in its valid direction without rounding", () => {
    for (const [reason, direction] of cases) {
      const admitted = normalizeCryptoLedgerEntry({
        ...ledgerBase, reason, direction,
      });
      expect(admitted.reason).toBe(reason);
      expect(admitted.direction).toBe(direction);
      expect(admitted.amount).toBe("0.000000000000000001");
      expect(Object.isFrozen(admitted)).toBe(true);
    }
  });

  it("fails closed on forged or malformed reasons before persistence", () => {
    for (const reason of ["unknown", "provider-deposit ", "__proto__", "", null, undefined, 0]) {
      expect(() => normalizeCryptoLedgerEntry({
        ...ledgerBase, reason,
      } as CryptoLedgerEntry)).toThrow("crypto.ledger.reason.invalid");
    }
  });

  it("rejects a reason with its opposite money direction", () => {
    for (const [reason, direction] of cases.filter(([reason]) => reason !== "adjustment")) {
      expect(() => normalizeCryptoLedgerEntry({
        ...ledgerBase, reason, direction: direction === "credit" ? "debit" : "credit",
      })).toThrow("crypto.ledger.reason_direction.invalid");
    }
  });

  it("still rejects malformed direction, schema and non-positive amounts", () => {
    for (const direction of ["both", null, undefined]) {
      expect(() => normalizeCryptoLedgerEntry({
        ...ledgerBase, direction,
      } as CryptoLedgerEntry)).toThrow("crypto.ledger.direction.invalid");
    }
    expect(() => normalizeCryptoLedgerEntry({
      ...ledgerBase, schemaVersion: 2,
    } as unknown as CryptoLedgerEntry)).toThrow("crypto.ledger.schema.invalid");
    expect(() => normalizeCryptoLedgerEntry({
      ...ledgerBase, amount: "0",
    })).toThrow("crypto.amount.invalid");
  });
});

import { describe, expect, it } from "vitest";
import {
  admitMsnSettlement,
  formatMicro,
  parseMicro,
  type MsnConversionQuote,
  type MsnProviderSettlement,
} from "./admission.js";

const quote: MsnConversionQuote = Object.freeze({
  quoteId: "q-1",
  tenantId: "tenant-1",
  userId: "user-1",
  fundingRail: "NGN_FLUTTERWAVE",
  fundingReference: "fund-1",
  ngnFundingKobo: 10000n,
  backingAsset: "USDTTRC20",
  backingNetwork: "tron",
  minimumSettledBackingUsdMicro: 1_000_000n,
  pricePerMsnUsdMicro: 500_000n,
  providerQuoteReference: "provider-quote-1",
  issuedAtMs: 1_000,
  expiresAtMs: 60_000,
});
const settled: MsnProviderSettlement = Object.freeze({
  tenantId: "tenant-1",
  userId: "user-1",
  quoteId: "q-1",
  fundingReference: "fund-1",
  providerSettlementId: "custody-tx-1",
  providerQuoteReference: "provider-quote-1",
  backingAsset: "USDTTRC20",
  backingNetwork: "tron",
  settledBackingUsdMicro: 1_000_000n,
  verifiedNgnFundingKobo: 10000n,
  settledAtMs: 59_000,
});
const base = Object.freeze({
  quote,
  settlement: settled,
  nowMs: 61_000, // delayed webhook after a timely settlement is acceptable
  qualifiedProvider: true,
  custodyBackingVerified: true,
  conversionLicensedAndAvailable: true,
  accountPolicyApproved: true,
});

describe("MSN exact value and backing", () => {
  it("accepts only exactly backed/provider-confirmed funds; no floating point", () => {
    const result = admitMsnSettlement(base);
    expect(result.msnCreditMicro).toBe(2_000_000n);
    expect(result.backingUsdMicro).toBe(1_000_000n);
    expect(result.fundingReference).toBe("fund-1");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("preserves provider quote and rounds down, never minting extra micro-MSN", () => {
    const result = admitMsnSettlement({
      ...base,
      quote: { ...quote, pricePerMsnUsdMicro: 300_000n },
      settlement: { ...settled, settledBackingUsdMicro: 1_000_001n },
    });
    expect(result.msnCreditMicro).toBe(3_333_336n);
    expect(result.conversionRemainderUsdMicroScaled).toBe(200_000n);
  });

  it.each([
    ["provider", { qualifiedProvider: false }],
    ["backing", { custodyBackingVerified: false }],
    ["conversion license", { conversionLicensedAndAvailable: false }],
    ["account approval", { accountPolicyApproved: false }],
  ])("fails closed without %s qualification", (_, change) => {
    expect(() => admitMsnSettlement({ ...base, ...change })).toThrow("msn.settlement.not_qualified");
  });

  it.each([
    ["cross-tenant", { tenantId: "tenant-2" }],
    ["cross-user", { userId: "user-2" }],
    ["different quote", { quoteId: "q-2" }],
    ["unrelated funding", { fundingReference: "fund-2" }],
    ["different price quote", { providerQuoteReference: "provider-quote-2" }],
    ["asset mismatch", { backingAsset: "BTC" }],
    ["network mismatch", { backingNetwork: "ethereum" }],
  ])("rejects %s evidence", (_, change) => {
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, ...change },
    })).toThrow("msn.settlement.binding_mismatch");
  });

  it("never converts NGN when fiat receipt amount differs or is missing", () => {
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, verifiedNgnFundingKobo: 9999n },
    })).toThrow("msn.ngn.receipt_amount_mismatch");
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, verifiedNgnFundingKobo: null },
    })).toThrow("msn.ngn.verified_receipt_required");
  });

  it("requires real backing settlement before token admission", () => {
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, settledBackingUsdMicro: 999_999n },
    })).toThrow("msn.settlement.underfunded");
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, settledBackingUsdMicro: 0n },
    })).toThrow("msn.settlement.amount_invalid");
  });

  it("rejects forged later settlement even if the webhook worker receives it later", () => {
    expect(() => admitMsnSettlement({
      ...base, settlement: { ...settled, settledAtMs: 61_000 },
      nowMs: 62_000,
    })).toThrow("msn.quote.expired_or_invalid");
  });

  it("accepts crypto-funded MSN without fabricating an NGN wallet", () => {
    const result = admitMsnSettlement({
      ...base,
      quote: { ...quote, fundingRail: "NOWPAYMENTS_CRYPTO", ngnFundingKobo: null },
      settlement: { ...settled, verifiedNgnFundingKobo: null },
    });
    expect(result.msnCreditMicro).toBe(2_000_000n);
    expect(() => admitMsnSettlement({
      ...base,
      quote: { ...quote, fundingRail: "NOWPAYMENTS_CRYPTO", ngnFundingKobo: null },
    })).toThrow("msn.crypto.fiat_receipt_unexpected");
  });

  it("requires independently supplied MSN price (no invented NGN/USD peg)", () => {
    expect(() => admitMsnSettlement({
      ...base, quote: { ...quote, pricePerMsnUsdMicro: 0n },
    })).toThrow("msn.quote.price_invalid");
  });

  it("parses exact decimal strings and rejects unsafe precision/notation", () => {
    expect(parseMicro("0.000001")).toBe(1n);
    expect(parseMicro("12.50")).toBe(12_500_000n);
    expect(formatMicro(12_500_000n)).toBe("12.500000");
    for (const invalid of ["1e4", "-2", " 1", "+2", "0.0000001", "1.", "01", "NaN", "0"]) {
      expect(() => parseMicro(invalid)).toThrow();
    }
    expect(parseMicro("0", true)).toBe(0n);
  });
});

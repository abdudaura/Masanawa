import { describe, expect, it } from "vitest";
import { admitFiatOnRampEvidence } from "./financial_onramp_evidence.js";

const expected = {
  invoiceId: "invoice-1",
  orderId: "tenant.request",
  fiatAmount: "1500",
  fiatCurrency: "NGN",
  settlementAsset: "USDTTRC20",
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: "payment-1",
    invoice_id: "invoice-1",
    order_id: "tenant.request",
    payment_status: "finished",
    price_amount: "1500.00",
    price_currency: "ngn",
    pay_amount: "1500",
    pay_currency: "ngn",
    actually_paid: "1500",
    outcome_amount: "1.234567",
    outcome_currency: "usdttrc20",
    ...overrides,
  };
}

describe("fiat on-ramp payment evidence", () => {
  it("preserves exact fiat principal and crypto settlement outcome", () => {
    expect(admitFiatOnRampEvidence(payload(), expected)).toMatchObject({
      paymentId: "payment-1",
      invoiceId: "invoice-1",
      orderId: "tenant.request",
      status: "finished",
      priceAmount: "1500",
      priceCurrency: "NGN",
      payAmount: "1500",
      payCurrency: "NGN",
      actuallyPaid: "1500",
      outcomeAmount: "1.234567",
      outcomeCurrency: "USDTTRC20",
    });
  });

  it.each([
    { invoice_id: "other" },
    { order_id: "tenant.other" },
    { price_amount: "1500.01" },
    { price_currency: "usd" },
    { pay_currency: "usd" },
    { outcome_currency: "btc" },
    { outcome_amount: null },
  ])("rejects changed finished purchase evidence %j", (change) => {
    expect(() => admitFiatOnRampEvidence(payload(change), expected))
      .toThrow("financial.crypto.onramp_evidence_mismatch");
  });

  it("allows pending evidence to omit the final crypto outcome", () => {
    expect(admitFiatOnRampEvidence(payload({
      payment_status: "confirming",
      actually_paid: "0",
      outcome_amount: null,
      outcome_currency: null,
    }), expected)).toMatchObject({
      status: "confirming",
      outcomeAmount: null,
      outcomeCurrency: null,
    });
  });

  it.each([
    { payment_id: "" },
    { payment_status: "invented" },
    { price_amount: "1.001" },
    { outcome_amount: "1.0000000000000000001" },
    { pay_amount: -1 },
  ])("rejects malformed provider evidence %j", (change) => {
    expect(() => admitFiatOnRampEvidence(payload(change), expected))
      .toThrow("financial.crypto.onramp_evidence_invalid");
  });
});

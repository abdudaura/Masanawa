import { describe, it, expect } from "vitest";
import { admitPaymentEvidence } from "./financial_payment_evidence.js";
const expected = { paymentId: "123", orderId: "tenant.request", asset: "USDTTRC20", amount: "10.000000000000000001" };
const payload = { payment_id: 123, order_id: "tenant.request", price_amount: expected.amount,
  price_currency: "usdttrc20", pay_currency: "usdttrc20", pay_amount: expected.amount,
  actually_paid: "0", payment_status: "waiting" };
describe("complete deposit recovery evidence", () => {
  it("admits exact principal and zero unpaid evidence", () => {
    expect(admitPaymentEvidence(payload, expected)).toMatchObject({ actuallyPaid: "0", priceAmount: expected.amount });
  });
  it.each([{ payment_id: "other" }, { order_id: "other" }, { price_currency: "BTC" },
    { pay_currency: "BTC" }, { price_amount: "10.000000000000000002" }])("rejects changed binding %j", change => {
    expect(() => admitPaymentEvidence({ ...payload, ...change }, expected)).toThrow("financial.crypto.evidence_mismatch");
  });
  it.each([{ payment_status: "invented" }, { actually_paid: "-1" }, { pay_amount: "1e-8" },
    { payment_id: Number.MAX_SAFE_INTEGER + 1 }, { pay_amount: undefined }])("rejects incomplete or unsafe evidence %j", change => {
    expect(() => admitPaymentEvidence({ ...payload, ...change }, expected)).toThrow("financial.crypto.evidence_invalid");
  });
  it("does not admit status-only responses", () => {
    expect(() => admitPaymentEvidence({ payment_status: "finished" }, expected)).toThrow();
  });
  it("fingerprints admitted evidence independently of irrelevant provider fields", () => {
    expect(admitPaymentEvidence({ ...payload, secret: "discarded" }, expected).payloadHash)
      .toBe(admitPaymentEvidence(payload, expected).payloadHash);
  });
});

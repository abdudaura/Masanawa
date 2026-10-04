import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalizeIpnPayload,
  parseVerifiedPaymentIpn,
  verifyIpnSignature,
} from "./ipn.js";

const payload = {
  payment_id: 5077125051,
  payment_status: "waiting",
  pay_address: "0xabc",
  price_amount: 170,
  price_currency: "usd",
  pay_amount: 155.38559757,
  actually_paid: 0,
  pay_currency: "mana",
  order_id: "2",
  purchase_id: "6084744717",
  fee: { serviceFee: 1.25, currency: "usd" },
};

describe("NOWPayments IPN verification", () => {
  it("deep-sorts keys into the NOWPayments signing representation", () => {
    expect(canonicalizeIpnPayload(payload)).toBe(
      '{"actually_paid":0,"fee":{"currency":"usd","serviceFee":1.25},"order_id":"2","pay_address":"0xabc","pay_amount":155.38559757,"pay_currency":"mana","payment_id":5077125051,"payment_status":"waiting","price_amount":170,"price_currency":"usd","purchase_id":"6084744717"}',
    );
  });

  it("matches a fixed HMAC-SHA-512 signature vector", () => {
    expect(
      verifyIpnSignature({
        payload,
        secret: "test-secret",
        signature:
          "482db85ac6eee72c854f547decb1a52f6fe91660071739b3bf5c207d4dd8b571516a98adafd2b25221eef9fc3735b36fae3c97abeb8c10efd023992190e7c0b6",
      }),
    ).toBe(true);
  });

  it("rejects malformed and changed signatures", () => {
    expect(verifyIpnSignature({ payload, secret: "test-secret", signature: "bad" })).toBe(false);
    expect(
      verifyIpnSignature({
        payload: { ...payload, payment_status: "finished" },
        secret: "test-secret",
        signature:
          "482db85ac6eee72c854f547decb1a52f6fe91660071739b3bf5c207d4dd8b571516a98adafd2b25221eef9fc3735b36fae3c97abeb8c10efd023992190e7c0b6",
      }),
    ).toBe(false);
  });

  it("returns stable evidence only after signature verification", () => {
    const canonical = canonicalizeIpnPayload(payload);
    const signature = createHmac("sha512", "secret").update(canonical).digest("hex");
    expect(parseVerifiedPaymentIpn({ payload, signature, secret: "secret" })).toMatchObject({
      paymentId: "5077125051",
      purchaseId: "6084744717",
      orderId: "2",
      status: "waiting",
    });
  });

  it("bounds nested webhook structures", () => {
    let nested: unknown = "end";
    for (let index = 0; index < 18; index += 1) nested = { nested };
    expect(() => canonicalizeIpnPayload(nested)).toThrow("nowpayments.ipn.payload_too_deep");
  });
});

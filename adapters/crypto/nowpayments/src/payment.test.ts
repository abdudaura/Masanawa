import { describe, expect, it } from "vitest";
import { normalizeCreatePaymentInput, parseCreatedPayment } from "./payment.js";

describe("NOWPayments payment creation evidence", () => {
  it("normalizes a server-side payment request", () => {
    expect(
      normalizeCreatePaymentInput({
        priceAmount: 100,
        priceCurrency: "USD",
        payCurrency: "USDTTRC20",
        ipnCallbackUrl: "https://merchant.example/webhooks/nowpayments",
        orderId: "order:123",
        orderDescription: "Premium plan",
      }),
    ).toEqual({
      price_amount: 100,
      price_currency: "usd",
      pay_currency: "usdttrc20",
      ipn_callback_url: "https://merchant.example/webhooks/nowpayments",
      order_id: "order:123",
      order_description: "Premium plan",
    });
  });

  it("rejects an insecure callback URL", () => {
    expect(() =>
      normalizeCreatePaymentInput({
        priceAmount: 10,
        priceCurrency: "USD",
        payCurrency: "BTC",
        ipnCallbackUrl: "http://merchant.example/webhook",
        orderId: "order-1",
      }),
    ).toThrow("nowpayments.ipn_callback.insecure");
  });

  it("parses bounded provider payment evidence", () => {
    expect(
      parseCreatedPayment({
        payment_id: 5745459419,
        purchase_id: "purchase_1",
        payment_status: "waiting",
        pay_address: "TExampleAddress",
        price_amount: 100,
        price_currency: "usd",
        pay_amount: "99.2",
        pay_currency: "usdttrc20",
        order_id: "order-1",
      }),
    ).toEqual({
      paymentId: "5745459419",
      purchaseId: "purchase_1",
      status: "waiting",
      payAddress: "TExampleAddress",
      priceAmount: 100,
      priceAmountExact: "100",
      priceCurrency: "USD",
      payAmount: 99.2,
      payAmountExact: "99.2",
      payCurrency: "USDTTRC20",
      orderId: "order-1",
    });
  });

  it("preserves exponent-form provider amounts as plain exact decimals", () => {
    expect(parseCreatedPayment({
      payment_id: "small-1",
      payment_status: "waiting",
      pay_address: "TExampleAddress",
      price_amount: 0.00000001,
      price_currency: "btc",
      pay_amount: 0.00000001,
      pay_currency: "btc",
      order_id: "order-small",
    })).toMatchObject({
      priceAmount: 0.00000001,
      priceAmountExact: "0.00000001",
      payAmount: 0.00000001,
      payAmountExact: "0.00000001",
    });
  });
});

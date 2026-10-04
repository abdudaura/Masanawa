import { describe, expect, it } from "vitest";
import {
  normalizeAvailableCurrencies,
  qualifyRoute,
  splitProviderCurrency,
  withRouteEvidence,
} from "./catalog.js";
import { NowPaymentsClient } from "./client.js";

describe("NOWPayments catalog", () => {
  it("keeps exact provider codes and separates known network suffixes", () => {
    expect(splitProviderCurrency("usdttrc20")).toEqual({ asset: "USDT", network: "tron" });
    expect(splitProviderCurrency("usdterc20")).toEqual({ asset: "USDT", network: "ethereum" });
    expect(splitProviderCurrency("btc")).toEqual({ asset: "BTC", network: null });
  });

  it("deduplicates and sorts provider currencies", () => {
    expect(normalizeAvailableCurrencies(["btc", "USDTTRC20", "btc"]).map((x) => x.providerCode))
      .toEqual(["BTC", "USDTTRC20"]);
  });

  it("excludes Ethereum-mainnet ERC-20 deposit routes", () => {
    const [route] = normalizeAvailableCurrencies(["USDTERC20"]);
    expect(route).toBeDefined();
    expect(qualifyRoute(route!, "deposit")).toMatchObject({
      eligible: false,
      reasons: ["network.excluded"],
    });
  });

  it("fails closed for operations not proven by the payment-currency endpoint", () => {
    const [route] = normalizeAvailableCurrencies(["USDTTRC20"]);
    expect(route).toBeDefined();
    expect(qualifyRoute(route!, "withdraw")).toMatchObject({
      eligible: false,
      reasons: ["operation.unverified"],
    });
  });

  it("fails closed on a low-fee policy until fee evidence is supplied", () => {
    const [route] = normalizeAvailableCurrencies(["USDTTRC20"]);
    expect(route).toBeDefined();
    expect(qualifyRoute(route!, "deposit", { maxEstimatedNetworkFeeUsd: 1 })).toMatchObject({
      eligible: false,
      reasons: ["fee.unverified"],
    });
    const evidenced = withRouteEvidence(route!, { estimatedNetworkFeeUsd: 0.25 });
    expect(qualifyRoute(evidenced, "deposit", { maxEstimatedNetworkFeeUsd: 1 }).eligible).toBe(true);
  });

  it("requires explicit evidence before enabling withdrawals", () => {
    const [route] = normalizeAvailableCurrencies(["USDTTRC20"]);
    expect(route).toBeDefined();
    const evidenced = withRouteEvidence(route!, {
      operation: "withdraw",
      operationAvailable: true,
    });
    expect(qualifyRoute(evidenced, "withdraw").eligible).toBe(true);
  });

  it("does not leak provider response bodies through HTTP errors", async () => {
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async () => new Response('{"error":"sensitive provider detail"}', { status: 403 }),
    });
    await expect(client.listPaymentCurrencies()).rejects.toThrow("nowpayments.credential.unavailable");
  });

  it("discovers deposit routes but filters excluded networks", async () => {
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async () =>
        new Response(JSON.stringify({ currencies: ["USDTERC20", "USDTTRC20", "BTC"] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    const routes = await client.listEligiblePaymentRoutes();
    expect(routes.map((x) => x.route.providerCode)).toEqual(["BTC", "USDTTRC20"]);
  });

  it("checks provider minimum before requesting an estimate", async () => {
    const requested: string[] = [];
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async (input) => {
        const url = String(input);
        requested.push(url);
        if (url.includes("/min-amount?")) {
          return new Response(
            JSON.stringify({
              currency_from: "USD",
              currency_to: "USDTTRC20",
              min_amount: 5,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            currency_from: "USD",
            currency_to: "USDTTRC20",
            amount_from: 10,
            estimated_amount: 9.8,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await expect(
      client.quotePayment({
        amount: 4,
        currencyFrom: "USD",
        currencyTo: "USDTTRC20",
      }),
    ).rejects.toThrow("nowpayments.amount.below_minimum");
    expect(requested).toHaveLength(1);

    const quote = await client.quotePayment({
      amount: 10,
      currencyFrom: "USD",
      currencyTo: "USDTTRC20",
    });
    expect(quote.estimate.estimatedAmount).toBe(9.8);
    expect(requested).toHaveLength(3);
  });

  it("polls payment status without treating confirmed as final success", async () => {
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async () =>
        new Response(JSON.stringify({ payment_status: "confirmed" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    await expect(client.getPaymentStatus({ paymentId: "pay_123" })).resolves.toBe(
      "confirmed",
    );
  });

  it("rejects malformed payment ids before network access", async () => {
    let called = false;
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });
    await expect(client.getPaymentStatus({ paymentId: "../bad" })).rejects.toThrow(
      "nowpayments.payment_id.invalid",
    );
    expect(called).toBe(false);
  });

  it("preflights and creates a payment with a bound order id", async () => {
    const requested: Array<{ url: string; method: string; body?: string }> = [];
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async (input, init) => {
        const url = String(input);
        requested.push({
          url,
          method: String(init?.method ?? "GET"),
          ...(typeof init?.body === "string" ? { body: init.body } : {}),
        });
        if (url.includes("/min-amount?")) {
          return new Response(JSON.stringify({ min_amount: 5 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/estimate?")) {
          return new Response(JSON.stringify({ estimated_amount: 9.8 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            payment_id: 5745459419,
            purchase_id: "purchase_1",
            payment_status: "waiting",
            pay_address: "TExampleAddress",
            price_amount: 10,
            price_currency: "usd",
            pay_amount: 9.8,
            pay_currency: "usdttrc20",
            order_id: "order-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const result = await client.createPayment({
      priceAmount: 10,
      priceCurrency: "USD",
      payCurrency: "USDTTRC20",
      ipnCallbackUrl: "https://merchant.example/webhooks/nowpayments",
      orderId: "order-1",
    });

    expect(result.payment.paymentId).toBe("5745459419");
    expect(requested.map((entry) => entry.method)).toEqual(["GET", "GET", "POST"]);
    expect(requested[2]?.body).toContain('"order_id":"order-1"');
  });

  it("fails closed when NOWPayments returns a different order id", async () => {
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async (input) => {
        const url = String(input);
        if (url.includes("/min-amount?")) {
          return new Response(JSON.stringify({ min_amount: 5 }), { status: 200 });
        }
        if (url.includes("/estimate?")) {
          return new Response(JSON.stringify({ estimated_amount: 9.8 }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            payment_id: "payment-1",
            payment_status: "waiting",
            pay_address: "TExampleAddress",
            price_amount: 10,
            price_currency: "usd",
            pay_amount: 9.8,
            pay_currency: "usdttrc20",
            order_id: "other-order",
          }),
          { status: 200 },
        );
      },
    });

    await expect(
      client.createPayment({
        priceAmount: 10,
        priceCurrency: "USD",
        payCurrency: "USDTTRC20",
        ipnCallbackUrl: "https://merchant.example/webhooks/nowpayments",
        orderId: "order-1",
      }),
    ).rejects.toThrow("nowpayments.payment.order_mismatch");
  });
});

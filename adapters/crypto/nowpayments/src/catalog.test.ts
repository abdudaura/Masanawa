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
});

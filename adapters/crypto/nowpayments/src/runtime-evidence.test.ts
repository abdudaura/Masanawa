import { describe, expect, it, vi } from "vitest";
import { NowPaymentsClient } from "./client.js";
import { NowPaymentsCustodyClient } from "./custody.js";
import { NowPaymentsPayoutClient } from "./payout.js";
import { collectNowPaymentsRuntimeEvidence } from "./runtime-evidence.js";

function clients(fetch: typeof globalThis.fetch) {
  return {
    payments: new NowPaymentsClient({ apiKey: "provider-key", fetch }),
    custody: new NowPaymentsCustodyClient({
      apiKey: "provider-key",
      email: "merchant@example.com",
      password: "secret",
      fetch,
    }),
    payout: new NowPaymentsPayoutClient({
      apiKey: "provider-key",
      email: "merchant@example.com",
      password: "secret",
      fetch,
    }),
  };
}

describe("NOWPayments runtime evidence", () => {
  it("builds fresh route evidence only from live catalog plus explicit allowlists", async () => {
    const fetch = vi.fn(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({
          currencies: ["usdttrc20", "btc", "trx"],
        }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100", pendingAmount: "0" },
          btc: { amount: "1", pendingAmount: "0" },
        }));
      }
      if (url.endsWith("/auth")) {
        return new Response(JSON.stringify({ token: "provider-jwt" }));
      }
      return new Response("missing", { status: 404 });
    });
    const result = await collectNowPaymentsRuntimeEvidence({
      ...clients(fetch),
      config: {
        conversionEnabled: true,
        payoutEnabled: true,
        ipWhitelistSatisfied: true,
        payoutDestinationWhitelistSatisfied: true,
        conversionProviderCodes: ["USDTTRC20", "BTC"],
        withdrawalProviderCodes: ["USDTTRC20"],
      },
      now: () => new Date("2026-10-05T00:00:00Z"),
    });

    expect(result.account).toEqual({
      custodyEnabled: true,
      customerManagementEnabled: null,
      conversionEnabled: true,
      payoutEnabled: true,
      ipWhitelistSatisfied: true,
      payoutDestinationWhitelistSatisfied: true,
      observedAt: "2026-10-05T00:00:00.000Z",
    });
    const usdt = result.routes.find((route) => route.providerCode === "USDTTRC20");
    const btc = result.routes.find((route) => route.providerCode === "BTC");
    const trx = result.routes.find((route) => route.providerCode === "TRX");
    expect(usdt?.operations).toEqual({
      deposit: true,
      convert: true,
      withdraw: true,
    });
    expect(btc?.operations).toEqual({
      deposit: true,
      convert: true,
      withdraw: false,
    });
    expect(trx?.operations).toEqual({
      deposit: true,
      convert: false,
      withdraw: false,
    });
    expect(fetch.mock.calls.filter((call) => String(call[0]).endsWith("/auth")))
      .toHaveLength(2);
  });

  it("fails closed when a configured operation route is absent from live catalog", async () => {
    const fetch = vi.fn(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({ currencies: ["trx", "btc"] }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({ trx: { amount: "1" } }));
      }
      if (url.endsWith("/auth")) {
        return new Response(JSON.stringify({ token: "provider-jwt" }));
      }
      return new Response("missing", { status: 404 });
    });
    await expect(collectNowPaymentsRuntimeEvidence({
      ...clients(fetch),
      config: {
        conversionEnabled: true,
        payoutEnabled: false,
        ipWhitelistSatisfied: true,
        payoutDestinationWhitelistSatisfied: false,
        conversionProviderCodes: ["TRX", "USDTTRC20"],
        withdrawalProviderCodes: [],
      },
    })).rejects.toThrow("nowpayments.runtime_evidence.conversion_route.unavailable");
  });

  it("requires at least two conversion currencies and one payout currency", async () => {
    const fetch = vi.fn();
    await expect(collectNowPaymentsRuntimeEvidence({
      ...clients(fetch),
      config: {
        conversionEnabled: true,
        payoutEnabled: false,
        ipWhitelistSatisfied: true,
        payoutDestinationWhitelistSatisfied: false,
        conversionProviderCodes: ["BTC"],
        withdrawalProviderCodes: [],
      },
    })).rejects.toThrow("nowpayments.runtime_evidence.conversion_routes.insufficient");
    expect(fetch).not.toHaveBeenCalled();

    await expect(collectNowPaymentsRuntimeEvidence({
      ...clients(fetch),
      config: {
        conversionEnabled: false,
        payoutEnabled: true,
        ipWhitelistSatisfied: true,
        payoutDestinationWhitelistSatisfied: true,
        conversionProviderCodes: [],
        withdrawalProviderCodes: [],
      },
    })).rejects.toThrow("nowpayments.runtime_evidence.withdrawal_routes.insufficient");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not claim conversion or payout without live credential checks", async () => {
    const fetch = vi.fn(async (request: Parameters<typeof globalThis.fetch>[0]) => {
      const url = String(request);
      if (url.endsWith("/currencies")) {
        return new Response(JSON.stringify({
          currencies: ["usdttrc20", "btc"],
        }));
      }
      if (url.endsWith("/balance")) {
        return new Response(JSON.stringify({
          usdttrc20: { amount: "100" },
          btc: { amount: "1" },
        }));
      }
      if (url.endsWith("/auth")) return new Response("denied", { status: 401 });
      return new Response("missing", { status: 404 });
    });
    await expect(collectNowPaymentsRuntimeEvidence({
      ...clients(fetch),
      config: {
        conversionEnabled: true,
        payoutEnabled: true,
        ipWhitelistSatisfied: true,
        payoutDestinationWhitelistSatisfied: true,
        conversionProviderCodes: ["USDTTRC20", "BTC"],
        withdrawalProviderCodes: ["USDTTRC20"],
      },
    })).rejects.toThrow("nowpayments.custody.credential.unavailable");
  });
});

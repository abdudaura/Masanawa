import { describe, expect, it } from "vitest";
import { NowPaymentsClient } from "./client.js";
import { runReadOnlyNowPaymentsProbe } from "./probe.js";

describe("NOWPayments read-only provider probe", () => {
  it("returns only non-secret provider diagnostics", async () => {
    const requested: string[] = [];
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async (input) => {
        const url = String(input);
        requested.push(url);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({ message: "OK" }), { status: 200 });
        }
        if (url.includes("/currencies")) {
          return new Response(
            JSON.stringify({ currencies: ["btc", "usdttrc20", "usdtbsc"] }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            currency_from: "usd",
            currency_to: "usdttrc20",
            min_amount: "4.5",
          }),
          { status: 200 },
        );
      },
    });

    await expect(
      runReadOnlyNowPaymentsProbe(client, {
        sampleLimit: 2,
        minimumPair: { currencyFrom: "USD", currencyTo: "USDTTRC20" },
      }),
    ).resolves.toEqual({
      apiReachable: true,
      authenticated: true,
      currencyCount: 3,
      sampleProviderCodes: ["BTC", "USDTBSC"],
      minimumCheck: {
        currencyFrom: "USD",
        currencyTo: "USDTTRC20",
        minimumAmount: 4.5,
      },
    });
    expect(requested).toHaveLength(3);
  });

  it("rejects unsafe sample sizes before provider access", async () => {
    let called = false;
    const client = new NowPaymentsClient({
      apiKey: "secret",
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });

    await expect(
      runReadOnlyNowPaymentsProbe(client, { sampleLimit: 100 }),
    ).rejects.toThrow("nowpayments.probe.sample_limit.invalid");
    expect(called).toBe(false);
  });
});

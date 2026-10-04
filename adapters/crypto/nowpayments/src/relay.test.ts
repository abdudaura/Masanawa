import { describe, expect, it, vi } from "vitest";
import { NowPaymentsClient } from "./client.js";
import { NowPaymentsCustodyClient } from "./custody.js";
import { NowPaymentsPayoutClient } from "./payout.js";

describe("NOWPayments fixed-egress relay client headers", () => {
  it("adds the dedicated relay header to payment API calls", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const client = new NowPaymentsClient({
      apiKey: "provider-key",
      baseUrl: "https://relay.example/v1",
      relayToken: "relay-secret",
      fetch,
    });
    await client.checkApiStatus();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://relay.example/v1/status");
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("provider-key");
    expect(headers["x-masanawa-relay-token"]).toBe("relay-secret");
  });

  it("preserves provider JWT while adding relay authentication for custody", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "provider-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "conversion-1",
        status: "processing",
        from_currency: "trx",
        to_currency: "btc",
        from_amount: "1",
      })));
    const client = new NowPaymentsCustodyClient({
      apiKey: "provider-key",
      email: "merchant@example.com",
      password: "secret",
      baseUrl: "https://relay.example/v1",
      relayToken: "relay-secret",
      fetch,
    });
    await client.createConversion({
      fromCurrency: "TRX",
      toCurrency: "BTC",
      amount: "1",
    });
    const authHeaders = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(authHeaders["x-masanawa-relay-token"]).toBe("relay-secret");
    expect(authHeaders.authorization).toBeUndefined();

    const conversionHeaders =
      fetch.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(conversionHeaders["x-masanawa-relay-token"]).toBe("relay-secret");
    expect(conversionHeaders.authorization).toBe("Bearer provider-jwt");
  });

  it("preserves provider JWT while adding relay authentication for payouts", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "provider-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "batch-1",
        status: "waiting",
      })));
    const client = new NowPaymentsPayoutClient({
      apiKey: "provider-key",
      email: "merchant@example.com",
      password: "secret",
      baseUrl: "https://relay.example/v1",
      relayToken: "relay-secret",
      fetch,
    });
    await client.createPayout({
      amount: "1",
      currency: "TRX",
      address: "wallet",
    });
    const payoutHeaders =
      fetch.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(payoutHeaders["x-masanawa-relay-token"]).toBe("relay-secret");
    expect(payoutHeaders.authorization).toBe("Bearer provider-jwt");
  });

  it("does not emit the relay header in direct-provider mode", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const client = new NowPaymentsClient({
      apiKey: "provider-key",
      fetch,
    });
    await client.checkApiStatus();
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-masanawa-relay-token"]).toBeUndefined();
  });
});

import { describe, expect, it, vi } from "vitest";
import { NowPaymentsCustodyClient } from "./custody.js";

function client(fetch: typeof globalThis.fetch) {
  return new NowPaymentsCustodyClient({
    apiKey: "fixture-key",
    email: "test@example.com",
    password: "fixture-password",
    fetch,
  });
}

describe("NOWPayments custody client", () => {
  it("parses custody balances without inventing missing pending funds", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      usdttrc20: { amount: "12.340000", pendingAmount: "0.5" },
      btc: { amount: 0, pending_amount: 0 },
    })));
    await expect(client(fetch).readBalances()).resolves.toEqual([
      { currency: "BTC", available: "0", pending: "0" },
      { currency: "USDTTRC20", available: "12.34", pending: "0.5" },
    ]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.nowpayments.io/v1/balance");
  });

  it.each(["10.000000000000000001", "9007199254740993"])(
    "rejects lossy conversion amount before authentication: %s",
    async (amount) => {
      const fetch = vi.fn();
      await expect(client(fetch).createConversion({
        fromCurrency: "USDTTRC20",
        toCurrency: "BTC",
        amount,
      })).rejects.toThrow("nowpayments.conversion.amount_unrepresentable");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("preserves a small decimal whose numeric wire form uses exponent notation", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "conversion-1",
        status: "processing",
        from_currency: "btc",
        to_currency: "usdttrc20",
        from_amount: "0.00000001",
        to_amount: "0.0006",
      })));
    await expect(client(fetch).createConversion({
      fromCurrency: "BTC",
      toCurrency: "USDTTRC20",
      amount: "0.00000001",
    })).resolves.toEqual({
      conversionId: "conversion-1",
      status: "processing",
      fromCurrency: "BTC",
      toCurrency: "USDTTRC20",
      fromAmount: "0.00000001",
      toAmount: "0.0006",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const request = fetch.mock.calls[1];
    expect(request?.[0]).toBe("https://api.nowpayments.io/v1/conversion");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      from_currency: "btc",
      to_currency: "usdttrc20",
      amount: 0.00000001,
    });
  });

  it("reconciles a conversion through its authenticated provider identity endpoint", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "conversion-7",
        status: "completed",
        from_currency: "usdttrc20",
        to_currency: "btc",
        from_amount: "10",
        to_amount: "0.00016",
      })));
    await expect(client(fetch).getConversionEvidence({
      conversionId: "conversion-7",
      fromCurrency: "USDTTRC20",
      toCurrency: "BTC",
      fromAmount: "10.0",
    })).resolves.toMatchObject({
      conversionId: "conversion-7",
      status: "completed",
      fromCurrency: "USDTTRC20",
      toCurrency: "BTC",
      fromAmount: "10",
      toAmount: "0.00016",
    });
    const url = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(url.pathname).toBe("/v1/conversion/conversion-7");
    expect(url.search).toBe("");
  });

  it("rejects changed conversion terms and changed provider identity", async () => {
    const changedFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "conversion-7",
        status: "completed",
        from_currency: "btc",
        to_currency: "usdttrc20",
        from_amount: "10",
        to_amount: "11",
      })));
    await expect(client(changedFetch).getConversionEvidence({
      conversionId: "conversion-7",
      fromCurrency: "USDTTRC20",
      toCurrency: "BTC",
      fromAmount: "10",
    })).rejects.toThrow("nowpayments.conversion.evidence_mismatch");

    const changedIdFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "other",
        status: "processing",
        from_currency: "btc",
        to_currency: "trx",
        from_amount: "1",
      })));
    await expect(client(changedIdFetch).getConversionEvidence({
      conversionId: "same",
    })).rejects.toThrow("nowpayments.conversion.evidence_mismatch");
  });

  it("does not admit a completed conversion without an exact target amount", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        conversion_id: "conversion-8",
        status: "completed",
        from_currency: "btc",
        to_currency: "trx",
        from_amount: "1",
      })));
    await expect(client(fetch).createConversion({
      fromCurrency: "BTC",
      toCurrency: "TRX",
      amount: "1",
    })).rejects.toThrow("nowpayments.conversion.invalid_response");
  });
});

import { describe, expect, it, vi } from "vitest";
import { NowPaymentsClient } from "./client.js";
import {
  normalizeCreateInvoiceInput,
  parseCreatedInvoice,
} from "./invoice.js";

describe("NOWPayments hosted fiat invoice", () => {
  it("normalizes an exact fiat invoice without floating precision drift", () => {
    expect(normalizeCreateInvoiceInput({
      priceAmount: "1500.25",
      priceCurrency: "NGN",
      payCurrency: "NGN",
      payoutCurrency: "USDTTRC20",
      ipnCallbackUrl: "https://gateway.masanawa.com/v1/financial/nowpayments/ipn",
      orderId: "tenant.request",
      orderDescription: "Masanawa crypto purchase",
    })).toEqual({
      price_amount: 1500.25,
      price_currency: "ngn",
      pay_currency: "ngn",
      payout_currency: "usdttrc20",
      ipn_callback_url: "https://gateway.masanawa.com/v1/financial/nowpayments/ipn",
      order_id: "tenant.request",
      order_description: "Masanawa crypto purchase",
    });
  });

  it.each(["0", "1.001", "9007199254740993"])(
    "rejects invalid or lossy fiat amount before provider access: %s",
    async (priceAmount) => {
      const fetch = vi.fn();
      const client = new NowPaymentsClient({ apiKey: "key", fetch });
      await expect(client.createInvoice({
        priceAmount,
        priceCurrency: "NGN",
        payCurrency: "NGN",
        payoutCurrency: "USDTTRC20",
        ipnCallbackUrl: "https://example.com/ipn",
        orderId: "tenant.request",
      })).rejects.toThrow("nowpayments.invoice.amount.invalid");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("requires the provider invoice response to preserve exact order terms", () => {
    const body = {
      id: "invoice-1",
      order_id: "tenant.request",
      price_amount: 1500.25,
      price_currency: "ngn",
      pay_currency: "ngn",
      payout_currency: "usdttrc20",
      invoice_url: "https://nowpayments.io/payment/?iid=invoice-1",
    };
    expect(parseCreatedInvoice(body, {
      orderId: "tenant.request",
      priceAmount: "1500.25",
      priceCurrency: "NGN",
      payCurrency: "NGN",
      payoutCurrency: "USDTTRC20",
    })).toEqual({
      invoiceId: "invoice-1",
      checkoutUrl: "https://nowpayments.io/payment/?iid=invoice-1",
      orderId: "tenant.request",
      priceAmount: "1500.25",
      priceCurrency: "NGN",
      payCurrency: "NGN",
      payoutCurrency: "USDTTRC20",
    });
    expect(() => parseCreatedInvoice(
      { ...body, order_id: "tenant.other" },
      {
        orderId: "tenant.request",
        priceAmount: "1500.25",
        priceCurrency: "NGN",
        payCurrency: "NGN",
        payoutCurrency: "USDTTRC20",
      },
    )).toThrow("nowpayments.invoice.evidence_mismatch");
  });

  it("creates the invoice through the configured relay and preserves its checkout url", async () => {
    const fetch = vi.fn(async (
      request: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      expect(request).toBe("https://relay.example/v1/invoice");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-masanawa-relay-token"]).toBe("relay-secret");
      return new Response(JSON.stringify({
        id: "invoice-1",
        order_id: "tenant.request",
        price_amount: 2500,
        price_currency: "ngn",
        pay_currency: "ngn",
        payout_currency: "usdttrc20",
        invoice_url: "https://nowpayments.io/payment/?iid=invoice-1",
      }), { status: 201 });
    });
    const client = new NowPaymentsClient({
      apiKey: "key",
      baseUrl: "https://relay.example/v1",
      relayToken: "relay-secret",
      fetch,
    });
    await expect(client.createInvoice({
      priceAmount: "2500",
      priceCurrency: "NGN",
      payCurrency: "NGN",
      payoutCurrency: "USDTTRC20",
      ipnCallbackUrl: "https://gateway.masanawa.com/v1/financial/nowpayments/ipn",
      orderId: "tenant.request",
    })).resolves.toMatchObject({
      invoiceId: "invoice-1",
      priceAmount: "2500",
      priceCurrency: "NGN",
      payCurrency: "NGN",
      payoutCurrency: "USDTTRC20",
    });
  });
});

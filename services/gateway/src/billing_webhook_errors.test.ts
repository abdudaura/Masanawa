import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { FlutterwaveWebhookError } from "@masanawa/providers";
import type { BillingCheckoutService } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import type { BillingWalletService } from "./billing_wallet.js";
import { registerBillingRoutes } from "./billing_routes.js";

describe("Flutterwave webhook HTTP retry contract (R05)", () => {
  async function deliver(
    billing: Pick<BillingFinancialService, "receiveWebhook">,
    checkout?: Pick<BillingCheckoutService, "reconcileFulfillment">,
    wallet?: Pick<BillingWalletService, "receiveFundingWebhook">,
  ) {
    const app = Fastify();
    registerBillingRoutes(app, {
      billingFinancial: billing as BillingFinancialService,
      ...(wallet ? { billingWallet: wallet as BillingWalletService } : {}),
      ...(checkout
        ? { billingCheckout: checkout as BillingCheckoutService }
        : {}),
    });
    try {
      return await app.inject({
        method: "POST",
        url: "/v1/webhooks/flutterwave",
        headers: { "verif-hash": "test-hash" },
        payload: { event: "charge.completed", data: { tx_ref: "bill-123" } },
      });
    } finally {
      await app.close();
    }
  }

  it.each([
    ["invalid_signature", 401],
    ["invalid_webhook", 400],
    ["payload_too_large", 413],
  ] as const)("rejects %s with HTTP %s", async (code, status) => {
    const receiveWebhook = vi.fn(async () => {
      throw new FlutterwaveWebhookError(code, "invalid signed event");
    });
    const response = await deliver({ receiveWebhook });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ error: code });
  });

  it("returns retryable 503 on a provider/database failure instead of false 401", async () => {
    const receiveWebhook = vi.fn(async () => {
      throw new Error("database timeout");
    });
    const response = await deliver({ receiveWebhook });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "billing_webhook_processing_unavailable",
    });
  });

  it("requires successful quote reconciliation before acknowledging a valid webhook", async () => {
    const receiveWebhook = vi.fn(async () => ({
      duplicate: true,
      reference: "bill-123",
    }));
    const reconcileFulfillment = vi.fn(async () => {
      throw new Error("ledger unavailable");
    });
    const response = await deliver({ receiveWebhook }, { reconcileFulfillment });
    expect(reconcileFulfillment).toHaveBeenCalledWith({ reference: "bill-123" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "billing_webhook_processing_unavailable",
    });
  });

  it("returns 503 when already-credited wallet continuation fails, so Flutterwave can retry", async () => {
    const billingReceive = vi.fn(async () => ({ duplicate: false, reference: null }));
    const receiveFundingWebhook = vi.fn(async () => {
      throw new Error("fulfillment unavailable after credit");
    });
    const response = await deliver(
      { receiveWebhook: billingReceive },
      undefined,
      { receiveFundingWebhook },
    );
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "billing_webhook_processing_unavailable" });
    expect(billingReceive).not.toHaveBeenCalled();
    expect(receiveFundingWebhook).toHaveBeenCalledOnce();
  });

  it("acknowledges an idempotently resumed wallet transfer only after completion", async () => {
    const billingReceive = vi.fn(async () => ({ duplicate: false, reference: null }));
    const receiveFundingWebhook = vi.fn(async () => ({
      handled: true, duplicate: true, resumed: true,
    }));
    const response = await deliver(
      { receiveWebhook: billingReceive },
      undefined,
      { receiveFundingWebhook },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: true, duplicate: true, funding: true, resumed: true,
    });
    expect(billingReceive).not.toHaveBeenCalled();
  });

  it("acknowledges only completed processing including duplicate delivery", async () => {
    const receiveWebhook = vi.fn(async () => ({
      duplicate: true,
      reference: "bill-123",
    }));
    const reconcileFulfillment = vi.fn(async () => null);
    const response = await deliver({ receiveWebhook }, { reconcileFulfillment });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: true, duplicate: true });
    expect(reconcileFulfillment).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { createCanonicalId } from "@masanawa/contracts";
import { createBillingQuote } from "@masanawa/commerce";
import type { BillingQuote, BillingQuoteRepository, NgnFundingIntent, NgnWalletRepository } from "@masanawa/commerce";
import type { FlutterwaveFundingClient } from "@masanawa/providers";
import type { CustomerSessionAuthorizer } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import { createBillingWalletService } from "./billing_wallet.js";
import { registerBillingRoutes } from "./billing_routes.js";

function fixture() {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const quoteId = createCanonicalId("quote");
  const createdAt = new Date().toISOString();
  const quote: BillingQuote = {
    ...createBillingQuote({
      tenantId, userId, quoteId, categoryCode: "AIRTIME", billerCode: "BIL119",
      itemCode: "AIRTIME", itemName: "Airtime", customerId: "07010102053",
      serviceAmountKobo: 10_000, feeAmountKobo: 0, createdAt,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    }),
    state: "confirmed",
    confirmedAt: createdAt,
  };
  const funding: NgnFundingIntent = {
    tenantId, userId, quoteId, txRef: "wallet-test-recovery",
    fundingReference: "funding-test-recovery", amountKobo: 10_000,
    originatingCharacterId: null, state: "awaiting",
    accountNumber: "0001112223", bankName: "Example Bank",
    providerOrderRef: "order", providerReference: "ref",
    providerTransactionId: null,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    createdAt, updatedAt: createdAt,
  };
  let currentQuote: BillingQuote | null = quote;
  let currentFunding: NgnFundingIntent | null = funding;
  const readQuote = vi.fn(async () => currentQuote);
  const readLatestQuoteFunding = vi.fn(async () => currentFunding);
  const createFundingIntent = vi.fn();
  const confirmQuote = vi.fn();
  const purchaseOwned = vi.fn();
  const createDynamicVirtualAccount = vi.fn();
  const authorize = vi.fn(async (input: { authorizationHeader: string | undefined }) => {
    if (input.authorizationHeader !== "Bearer owner") throw new Error("financial.auth.unauthorized");
    return { tenantId, userId };
  });
  const service = createBillingWalletService({
    sessions: { authorize } as unknown as CustomerSessionAuthorizer,
    quotes: { readQuote, confirmQuote } as unknown as BillingQuoteRepository,
    wallet: {
      readLatestQuoteFunding, readBalance: vi.fn(async () => 1250), createFundingIntent,
    } as unknown as NgnWalletRepository,
    funding: { createDynamicVirtualAccount } as unknown as FlutterwaveFundingClient,
    billing: { purchaseOwned } as unknown as BillingFinancialService,
    webhookSecretHash: "valid-secret",
  });
  return {
    quote, funding, service, authorize, readQuote, readLatestQuoteFunding,
    createFundingIntent, createDynamicVirtualAccount, purchaseOwned, confirmQuote,
    setQuote(value: BillingQuote | null) { currentQuote = value; },
    setFunding(value: NgnFundingIntent | null) { currentFunding = value; },
  };
}

describe("R05 authenticated funding recovery", () => {
  it("restores an owned, bound and unexpired virtual account without performing writes", async () => {
    const t = fixture();
    const result = await t.service.readQuoteFunding({
      authorizationHeader: "Bearer owner", quoteId: t.quote.quoteId,
    });
    expect(result.phase).toBe("awaiting-funds");
    expect(result.balanceKobo).toBe(1250);
    expect(result.funding?.accountNumber).toBe("0001112223");
    expect(t.readQuote).toHaveBeenCalledWith({
      tenantId: t.quote.tenantId, userId: t.quote.userId, quoteId: t.quote.quoteId,
    });
    expect(t.readLatestQuoteFunding).toHaveBeenCalledWith({
      tenantId: t.quote.tenantId, userId: t.quote.userId, quoteId: t.quote.quoteId,
    });
    expect(t.createFundingIntent).not.toHaveBeenCalled();
    expect(t.createDynamicVirtualAccount).not.toHaveBeenCalled();
    expect(t.purchaseOwned).not.toHaveBeenCalled();
    expect(t.confirmQuote).not.toHaveBeenCalled();
  });

  it("never restores expired, credited, failed or unbound bank instructions", async () => {
    const t = fixture();
    for (const change of [
      { expiresAt: new Date(Date.now() - 1000).toISOString() },
      { state: "credited" as const },
      { state: "failed" as const },
      { bankName: null },
      { accountNumber: null },
    ]) {
      t.setFunding({ ...t.funding, ...change });
      const value = await t.service.readQuoteFunding({
        authorizationHeader: "Bearer owner", quoteId: t.quote.quoteId,
      });
      expect(value.funding).toBeNull();
      expect(JSON.stringify(value.document)).not.toContain("0001112223");
    }
  });

  it("never exposes an unexpired account against expired quote terms", async () => {
    const t = fixture();
    t.setQuote({ ...t.quote, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const value = await t.service.readQuoteFunding({
      authorizationHeader: "Bearer owner", quoteId: t.quote.quoteId,
    });
    expect(value.phase).toBe("failed");
    expect(value.funding).toBeNull();
  });

  it("does not expose instructions after the quote succeeds, expires or refunds", async () => {
    const t = fixture();
    for (const state of ["succeeded", "refunded", "expired"] as const) {
      t.setQuote({ ...t.quote, state });
      const value = await t.service.readQuoteFunding({
        authorizationHeader: "Bearer owner", quoteId: t.quote.quoteId,
      });
      expect(value.funding).toBeNull();
      expect(["fulfilled", "failed"]).toContain(value.phase);
    }
  });

  it("does not synthesize funding for a quote without a persisted intent", async () => {
    const t = fixture();
    t.setFunding(null);
    const value = await t.service.readQuoteFunding({
      authorizationHeader: "Bearer owner", quoteId: t.quote.quoteId,
    });
    expect(value.phase).toBe("ready");
    expect(value.funding).toBeNull();
    expect(t.createFundingIntent).not.toHaveBeenCalled();
  });

  it("returns correct HTTP authentication, ownership and retry classifications", async () => {
    const t = fixture();
    const app = Fastify();
    registerBillingRoutes(app, { billingWallet: t.service });
    const url = `/v1/commerce/bills/quotes/${t.quote.quoteId}/wallet-status`;
    try {
      const unauthorized = await app.inject({ method: "GET", url });
      expect(unauthorized.statusCode).toBe(401);
      expect(t.readQuote).not.toHaveBeenCalled();

      t.setQuote(null);
      const missing = await app.inject({
        method: "GET", url, headers: { authorization: "Bearer owner" },
      });
      expect(missing.statusCode).toBe(404);
      expect(t.readLatestQuoteFunding).not.toHaveBeenCalled();

      t.setQuote(t.quote);
      const available = await app.inject({
        method: "GET", url, headers: { authorization: "Bearer owner" },
      });
      expect(available.statusCode).toBe(200);
      expect(available.json().funding.accountNumber).toBe("0001112223");

      t.readLatestQuoteFunding.mockRejectedValueOnce(new Error("DB offline"));
      const retriable = await app.inject({
        method: "GET", url, headers: { authorization: "Bearer owner" },
      });
      expect(retriable.statusCode).toBe(503);
      expect(retriable.json()).toEqual({ error: "billing_wallet_status_unavailable" });

      // Funding recovery exposes short-lived bank instructions. Neither
      // successful reads nor error responses may enter shared/browser caches.
      // The validation error is produced before the handler runs.
      const invalid = await app.inject({
        method: "GET",
        url: `/v1/commerce/bills/quotes/${"x".repeat(181)}/wallet-status`,
        headers: { authorization: "Bearer owner" },
      });
      expect(invalid.statusCode).toBe(400);
      const head = await app.inject({
        method: "HEAD", url, headers: { authorization: "Bearer owner" },
      });
      expect(head.statusCode).toBe(200);
      expect(head.body).toBe("");
      for (const response of [unauthorized, missing, available, retriable, invalid, head]) {
        expect(response.headers["cache-control"]).toContain("no-store");
        expect(response.headers["cache-control"]).toContain("private");
        expect(response.headers.pragma).toBe("no-cache");
        expect(response.headers.expires).toBe("0");
      }
    } finally {
      await app.close();
    }
  });
});

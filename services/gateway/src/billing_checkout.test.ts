import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { BillingQuote, BillingQuoteRepository } from "@masanawa/commerce";
import {
  FlutterwaveBillsClient,
  FlutterwaveFundingClient,
  type FlutterwaveBillsTransport,
} from "@masanawa/providers";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { BillingFinancialService } from "./financial_billing.js";
import { createBillingCheckoutService } from "./billing_checkout.js";

class MemoryQuotes implements BillingQuoteRepository {
  quote: BillingQuote | null = null;

  async createQuote(input: BillingQuote) {
    this.quote ??= input;
    return this.quote;
  }
  async readQuote() { return this.quote; }
  async listQuotes() { return this.quote ? [this.quote] : []; }

  async confirmQuote(input: Parameters<BillingQuoteRepository["confirmQuote"]>[0]) {
    if (!this.quote || this.quote.quoteId !== input.quoteId) throw new Error("missing");
    this.quote = Object.freeze({
      ...this.quote,
      state: "confirmed",
      confirmedAt: input.confirmedAt,
      updatedAt: input.confirmedAt,
    });
    return this.quote;
  }

  async bindCheckout(input: Parameters<BillingQuoteRepository["bindCheckout"]>[0]) {
    if (!this.quote) throw new Error("missing");
    this.quote = Object.freeze({
      ...this.quote,
      state: "checkout-created",
      checkoutTxRef: input.txRef,
      checkoutUrl: input.checkoutUrl,
      updatedAt: input.boundAt,
    });
    return this.quote;
  }

  async recordVerifiedPayment(input: Parameters<BillingQuoteRepository["recordVerifiedPayment"]>[0]) {
    if (!this.quote || input.amountKobo !== this.quote.totalAmountKobo || input.currency !== "NGN") {
      throw new Error("financial.billing.payment_amount_mismatch");
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: "funded",
      providerTransactionId: input.providerTransactionId,
      providerReference: input.providerReference,
      paymentVerifiedAt: input.verifiedAt,
      updatedAt: input.verifiedAt,
    });
    return this.quote;
  }

  async reserveConfirmedBill(input: Parameters<BillingQuoteRepository["reserveConfirmedBill"]>[0]) {
    if (!this.quote || this.quote.state !== "funded") throw new Error("financial.billing.funds_not_available");
    if (
      this.quote.quoteId !== input.quoteId ||
      this.quote.billerCode !== input.billerCode ||
      this.quote.itemCode !== input.itemCode ||
      this.quote.customerId !== input.customerId
    ) throw new Error("financial.billing.quote_terms_mismatch");
    this.quote = Object.freeze({
      ...this.quote,
      state: "reserved",
      fulfillmentReference: input.fulfillmentReference,
    });
  }

  async settleBill(input: Parameters<BillingQuoteRepository["settleBill"]>[0]) {
    if (!this.quote || this.quote.fulfillmentReference !== input.fulfillmentReference) {
      throw new Error("financial.billing.reserve_not_found");
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: input.state === "succeeded" ? "succeeded" : "refund-pending",
      settlementState: input.state,
      billProviderReference: input.providerReference,
    });
  }

  async claimRefundDispatch(input: Parameters<BillingQuoteRepository["claimRefundDispatch"]>[0]) {
    if (!this.quote || this.quote.providerTransactionId !== input.providerTransactionId) throw new Error("missing");
    this.quote = Object.freeze({ ...this.quote, state: "refund-dispatching", updatedAt: input.claimedAt });
    return this.quote;
  }
  async recordRefundInitiated(input: Parameters<BillingQuoteRepository["recordRefundInitiated"]>[0]) {
    if (!this.quote) throw new Error("missing");
    this.quote = Object.freeze({
      ...this.quote,
      state: "refund-submitted",
      refundReference: input.refundReference,
      updatedAt: input.initiatedAt,
    });
    return this.quote;
  }
  async markRefunded(input: Parameters<BillingQuoteRepository["markRefunded"]>[0]) {
    if (!this.quote) throw new Error("missing");
    this.quote = Object.freeze({
      ...this.quote,
      state: "refunded",
      refundReference: input.refundReference,
      updatedAt: input.refundedAt,
    });
    return this.quote;
  }
}

function identity(): PlatformSessionIdentity {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  return Object.freeze({
    tenantId,
    userId,
    profile: Object.freeze({
      tenantId,
      userId,
      name: "Test Customer",
      email: "customer@example.com",
      phone: "+2348012345678",
      locale: "en-NG",
      createdAt: "2026-10-04T20:00:00.000Z",
    }),
  });
}

function providerTransport(verifiedAmount = "101"): FlutterwaveBillsTransport {
  return {
    async request(request) {
      if (request.method === "GET" && request.path === "/v3/top-bill-categories") {
        return { status: 200, body: { status: "success", data: [{
          code: "AIRTIME", name: "Airtime", description: "Airtime", country_code: "NG",
        }] } };
      }
      if (request.method === "GET" && request.path === "/v3/bills/AIRTIME/billers") {
        return { status: 200, body: { status: "success", data: [{
          biller_code: "BIL102", name: "MTN Airtime",
        }] } };
      }
      if (request.method === "GET" && request.path === "/v3/billers/BIL102/items") {
        return { status: 200, body: { status: "success", data: [{
          biller_code: "BIL102", item_code: "AT102", name: "MTN Airtime",
          amount: "0", currency: "NGN", label_name: "Phone",
        }] } };
      }
      if (request.method === "POST" && request.path === "/v3/payments") {
        return { status: 200, body: { status: "success", data: {
          link: "https://checkout.flutterwave.com/v3/hosted/pay/test",
        } } };
      }
      if (request.method === "GET" && request.path === "/v3/transactions/verify_by_reference") {
        return { status: 200, body: { status: "success", data: {
          id: 44, tx_ref: request.query?.tx_ref, flw_ref: "FLW-PAY-44",
          status: "successful", amount: verifiedAmount, currency: "NGN",
        } } };
      }
      throw new Error(`unexpected provider call ${request.method} ${request.path}`);
    },
  };
}

function billing(quotes: MemoryQuotes): BillingFinancialService {
  return {
    async listCategories() { return []; },
    async listBillers() { return []; },
    async listItems() { return []; },
    async purchase(request) {
      const owner = identity();
      await quotes.reserveConfirmedBill({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: request.quoteId!,
        quoteRevision: request.quoteRevision!,
        fulfillmentReference: request.requestId,
        billerCode: request.billerCode,
        itemCode: request.itemCode,
        customerId: request.customerId,
        amount: request.amount,
        currency: "NGN",
      });
      await quotes.settleBill({
        tenantId: owner.tenantId,
        userId: owner.userId,
        fulfillmentReference: request.requestId,
        state: "succeeded",
        providerReference: "BILL-1",
      });
      return {
        fulfillmentReference: request.requestId,
        billerCode: request.billerCode,
        itemCode: request.itemCode,
        itemName: request.itemName,
        customerId: request.customerId,
        customerName: null,
        amount: request.amount,
        currency: "NGN",
        revision: 2,
        state: "succeeded",
        providerReference: "BILL-1",
        providerStatus: "successful",
        lastEvidenceAt: "2026-10-04T20:02:00.000Z",
      };
    },
    async readPurchase() { throw new Error("unused"); },
    async receiveWebhook() { return { duplicate: false, reference: null }; },
  };
}

describe("billing checkout", () => {
  it("binds live catalog, hosted payment verification and bill fulfillment to one quote", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const transport = providerTransport("101");
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      feeBasisPoints: 100,
      now: (() => {
        let tick = 0;
        return () => new Date(Date.parse("2026-10-04T20:00:00Z") + tick++ * 1000).toISOString();
      })(),
    });

    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
    });
    expect(quoted.quote).toMatchObject({
      serviceAmountKobo: 10000,
      feeAmountKobo: 100,
      totalAmountKobo: 10100,
      state: "quoted",
    });

    const checkout = await service.startCheckout({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: quoted.quote.revision,
    });
    expect(checkout.checkoutUrl).toContain("checkout.flutterwave.com");
    expect(checkout.quote.state).toBe("checkout-created");

    const done = await service.verifyAndPurchase({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: quoted.quote.revision,
    });
    expect(done.phase).toBe("fulfilled");
    expect(done.quote).toMatchObject({
      state: "succeeded",
      providerTransactionId: "44",
      providerReference: "FLW-PAY-44",
      billProviderReference: "BILL-1",
    });
  });

  it("does not dispatch a bill when verified payment is not the exact quote total", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const transport = providerTransport("100");
    let purchases = 0;
    const billingService = billing(quotes);
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: { ...billingService, async purchase(input) { purchases += 1; return billingService.purchase(input); } },
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      feeBasisPoints: 100,
    });

    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
    });
    await service.startCheckout({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: 1,
    });
    await expect(service.verifyAndPurchase({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: 1,
    })).rejects.toThrow("payment_amount_mismatch");
    expect(purchases).toBe(0);
  });
});

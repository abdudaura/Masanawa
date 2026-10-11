import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { formatNgnKobo, type BillingQuote, type BillingQuoteRepository } from "@masanawa/commerce";
import {
  BillingCommerceError,
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
  async readByFulfillmentReference(input: Parameters<BillingQuoteRepository["readByFulfillmentReference"]>[0]) {
    return this.quote?.fulfillmentReference === input.fulfillmentReference ? this.quote : null;
  }
  async listQuotes() { return this.quote ? [this.quote] : []; }

  async confirmQuote(input: Parameters<BillingQuoteRepository["confirmQuote"]>[0]) {
    if (!this.quote || this.quote.quoteId !== input.quoteId) throw new Error("missing");
    if (this.quote.confirmedAt) return this.quote;
    this.quote = Object.freeze({
      ...this.quote,
      state: "confirmed",
      confirmedAt: input.confirmedAt,
      updatedAt: input.confirmedAt,
    });
    return this.quote;
  }

  async claimCheckoutDispatch(
    input: Parameters<BillingQuoteRepository["claimCheckoutDispatch"]>[0],
  ) {
    if (!this.quote || this.quote.quoteId !== input.quoteId) {
      throw new Error("missing");
    }
    if (this.quote.checkoutTxRef) {
      if (this.quote.checkoutTxRef !== input.txRef) {
        throw new Error("financial.billing.checkout_replay_conflict");
      }
      return Object.freeze({ quote: this.quote, claimed: false });
    }
    if (this.quote.state !== "confirmed") {
      throw new Error("financial.billing.checkout_not_allowed");
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: "checkout-dispatching",
      checkoutTxRef: input.txRef,
      updatedAt: input.claimedAt,
    });
    return Object.freeze({ quote: this.quote, claimed: true });
  }

  async bindCheckout(input: Parameters<BillingQuoteRepository["bindCheckout"]>[0]) {
    if (!this.quote || this.quote.checkoutTxRef !== input.txRef) {
      throw new Error("financial.billing.checkout_replay_conflict");
    }
    if (this.quote.checkoutUrl) return this.quote;
    if (this.quote.state !== "checkout-dispatching") {
      throw new Error("financial.billing.checkout_not_allowed");
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: "checkout-created",
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

  async requestFundedRefund(input: Parameters<BillingQuoteRepository["requestFundedRefund"]>[0]) {
    if (!this.quote || this.quote.state !== "funded") {
      throw new Error("financial.billing.funded_refund_not_allowed");
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: "refund-pending",
      settlementState: "failed",
      updatedAt: input.requestedAt,
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
    if (!this.quote || this.quote.providerTransactionId !== input.providerTransactionId) {
      throw new Error("missing");
    }
    if (this.quote.state !== "refund-pending") {
      return Object.freeze({ quote: this.quote, claimed: false });
    }
    this.quote = Object.freeze({
      ...this.quote,
      state: "refund-dispatching",
      updatedAt: input.claimedAt,
    });
    return Object.freeze({ quote: this.quote, claimed: true });
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
        categoryCode: request.categoryCode ?? null,
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
    async purchaseOwned(request) {
      const owner = identity();
      if (request.tenantId !== owner.tenantId || request.userId !== owner.userId) {
        throw new Error("financial.billing_not_found");
      }
      await quotes.reserveConfirmedBill({
        tenantId: owner.tenantId,
        userId: owner.userId,
        quoteId: request.quoteId as never,
        quoteRevision: request.quoteRevision,
        fulfillmentReference: request.requestId,
        categoryCode: request.categoryCode ?? null,
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
    async reconcileOwnedPurchase(request) {
      const current = quotes.quote;
      if (!current || current.fulfillmentReference !== request.reference) {
        throw new Error("financial.billing_not_found");
      }
      return {
        fulfillmentReference: request.reference,
        billerCode: current.billerCode,
        itemCode: current.itemCode,
        itemName: current.itemName,
        customerId: current.customerId,
        customerName: null,
        amount: formatNgnKobo(current.serviceAmountKobo),
        currency: "NGN",
        revision: 2,
        state: current.state === "succeeded" ? "succeeded" : "checking",
        providerReference: current.billProviderReference,
        providerStatus: current.state === "succeeded" ? "successful" : "pending",
        lastEvidenceAt: "2026-10-04T20:02:00.000Z",
      };
    },
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

  it("settles configured Twin commission from the persisted chat origin without blocking bill success", async () => {
    const owner = identity();
    const originatingCharacterId = createCanonicalId("character");
    const quotes = new MemoryQuotes();
    const transport = providerTransport("100");
    const calls: Array<Record<string, unknown>> = [];
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport,
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      twinMonetization: {
        async attribute(input) {
          calls.push({ kind: "attribute", ...input });
        },
        async settleProviderValue(input) {
          calls.push({ kind: "settle", ...input });
          return { eligible: true };
        },
        async reverseFull(input) {
          calls.push({ kind: "reverse", ...input });
        },
      },
    });

    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
      originatingCharacterId,
    });
    expect(quoted.quote.originatingCharacterId).toBe(originatingCharacterId);

    await service.startCheckout({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: quoted.quote.revision,
    });
    const done = await service.verifyAndPurchase({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: quoted.quote.revision,
    });
    expect(done.phase).toBe("fulfilled");
    expect(calls).toContainEqual(expect.objectContaining({
      kind: "attribute",
      characterId: originatingCharacterId,
      eventType: "commerce-purchase",
      operationId: `billing:${quoted.quote.quoteId}`,
    }));
    expect(calls).toContainEqual(expect.objectContaining({
      kind: "settle",
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "commerce-purchase",
      operationId: `billing:${quoted.quote.quoteId}`,
      sourceUnits: 10000,
    }));
  });

  it("does not fail a fulfilled bill when Twin valuation is not configured", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const transport = providerTransport("100");
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport,
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      twinMonetization: {
        async attribute() {},
        async settleProviderValue() {
          throw Object.assign(new Error("Provider valuation policy is not configured"), {
            statusCode: 409,
          });
        },
        async reverseFull() {},
      },
    });
    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
      originatingCharacterId: createCanonicalId("character"),
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
    })).resolves.toMatchObject({ phase: "fulfilled" });
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

  it("creates exactly one hosted checkout when two start requests race", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const base = providerTransport("100");
    let checkoutPosts = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (request.method === "POST" && request.path === "/v3/payments") {
          checkoutPosts += 1;
          await Promise.resolve();
        }
        return base.request(request);
      },
    };
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
    });
    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
    });

    const attempts = await Promise.allSettled([
      service.startCheckout({
        authorizationHeader: "Bearer session",
        quoteId: quoted.quote.quoteId,
        quoteRevision: 1,
      }),
      service.startCheckout({
        authorizationHeader: "Bearer session",
        quoteId: quoted.quote.quoteId,
        quoteRevision: 1,
      }),
    ]);

    expect(checkoutPosts).toBe(1);
    expect(attempts.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    const rejected = attempts.find((entry) => entry.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({
        message: "financial.billing.checkout_creation_in_progress",
      }),
    });

    const replay = await service.startCheckout({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: 1,
    });
    expect(replay.checkoutUrl).toContain("checkout.flutterwave.com");
    expect(checkoutPosts).toBe(1);
  });

  it("keeps an already-created hosted checkout verifiable after the short quote TTL", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const transport = providerTransport("100");
    let at = "2026-10-04T20:00:00.000Z";
    let purchases = 0;
    const billingService = billing(quotes);
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: {
        ...billingService,
        async purchase(request) {
          purchases += 1;
          return billingService.purchase(request);
        },
      },
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      quoteTtlSeconds: 60,
      now: () => at,
    });

    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
    });
    const quotedDoc = quoted.document as {
      id: string;
      revision: number;
      nodes: Array<{ action?: string; token?: string }>;
    };
    const confirm = quotedDoc.nodes.find((node) => node.action === "billing.wallet.confirm")!;
    expect(confirm).toBeDefined();
    at = "2026-10-04T20:00:30.000Z";
    const confirmed = await service.verifyWalletConfirmAction({
      authorizationHeader: "Bearer session",
      documentId: quotedDoc.id,
      revision: quotedDoc.revision,
      actionId: "billing.wallet.confirm",
      token: confirm.token!,
    });
    const checkout = await service.startCheckout({
      authorizationHeader: "Bearer session", ...confirmed,
    });
    const checkoutDoc = checkout.document as {
      id: string;
      revision: number;
      expiresAt: string;
      nodes: Array<{ action?: string; token?: string }>;
    };
    const verify = checkoutDoc.nodes.find((node) => node.action === "billing.checkout.verify")!;

    expect(Date.parse(checkoutDoc.expiresAt)).toBeGreaterThan(
      Date.parse(quoted.quote.expiresAt),
    );

    // The economic quote has expired, but this checkout was legitimately
    // created before expiry and remains in its bounded hosted-payment grace.
    at = "2026-10-04T20:02:00.000Z";
    const verified = await service.executeShellAction({
      authorizationHeader: "Bearer session",
      documentId: checkoutDoc.id,
      revision: checkoutDoc.revision,
      actionId: "billing.checkout.verify",
      token: verify.token!,
    });

    expect(verified.phase).toBe("fulfilled");
    expect(quotes.quote).toMatchObject({
      state: "succeeded",
      providerTransactionId: "44",
      billProviderReference: "BILL-1",
    });
    expect(purchases).toBe(1);
  });

  it("refunds verified funds after a definitive pre-dispatch failure", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const base = providerTransport("100");
    let refundPosts = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (
          request.method === "POST" &&
          request.path === "/v3/transactions/44/refund"
        ) {
          refundPosts += 1;
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                id: "refund-44",
                flw_ref: "REFUND-44",
                status: "successful",
                amount_refunded: "100",
              },
            },
          };
        }
        return base.request(request);
      },
    };
    const billingService = billing(quotes);
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: {
        ...billingService,
        async purchase() {
          throw new BillingCommerceError(
            "recipient_invalid",
            "Provider definitively rejected the recipient",
          );
        },
      },
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
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

    const result = await service.verifyAndPurchase({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: 1,
    });

    expect(result.phase).toBe("refunded");
    expect(result.quote).toMatchObject({
      state: "refunded",
      providerTransactionId: "44",
      refundReference: "REFUND-44",
    });
    expect(refundPosts).toBe(1);
  });

  it("reconciles an uncertain reserved bill to success without another purchase dispatch", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const transport = providerTransport("100");
    const billingService = billing(quotes);
    let purchaseCalls = 0;
    let reconcileCalls = 0;
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: {
        ...billingService,
        async purchase(request) {
          purchaseCalls += 1;
          await quotes.reserveConfirmedBill({
            tenantId: owner.tenantId,
            userId: owner.userId,
            quoteId: request.quoteId!,
            quoteRevision: request.quoteRevision!,
            fulfillmentReference: request.requestId,
            categoryCode: request.categoryCode ?? null,
            billerCode: request.billerCode,
            itemCode: request.itemCode,
            customerId: request.customerId,
            amount: request.amount,
            currency: "NGN",
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
            state: "checking",
            providerReference: null,
            providerStatus: "outcome_unknown",
            lastEvidenceAt: "2026-10-04T20:02:00.000Z",
          };
        },
        async reconcileOwnedPurchase(request) {
          reconcileCalls += 1;
          await quotes.settleBill({
            tenantId: owner.tenantId,
            userId: owner.userId,
            fulfillmentReference: request.reference,
            state: "succeeded",
            providerReference: "BILL-RECOVERED-1",
          });
          return {
            fulfillmentReference: request.reference,
            billerCode: quotes.quote!.billerCode,
            itemCode: quotes.quote!.itemCode,
            itemName: quotes.quote!.itemName,
            customerId: quotes.quote!.customerId,
            customerName: null,
            amount: formatNgnKobo(quotes.quote!.serviceAmountKobo),
            currency: "NGN",
            revision: 3,
            state: "succeeded",
            providerReference: "BILL-RECOVERED-1",
            providerStatus: "successful",
            lastEvidenceAt: "2026-10-04T20:03:00.000Z",
            deliveryCode: "TOKEN-RECOVERED-123",
          };
        },
      },
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
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
    const uncertain = await service.verifyAndPurchase({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
      quoteRevision: 1,
    });
    expect(uncertain.quote.state).toBe("reserved");
    expect(purchaseCalls).toBe(1);

    const recovered = await service.read({
      authorizationHeader: "Bearer session",
      quoteId: quoted.quote.quoteId,
    });
    expect(recovered.phase).toBe("fulfilled");
    expect(recovered.quote).toMatchObject({
      state: "succeeded",
      billProviderReference: "BILL-RECOVERED-1",
    });
    expect(recovered.purchase).toMatchObject({
      state: "succeeded",
      deliveryCode: "TOKEN-RECOVERED-123",
    });
    const recoveredDocument = recovered.document as {
      nodes: Array<{ text?: string; value?: string }>;
    };
    expect(recoveredDocument.nodes).toContainEqual(
      expect.objectContaining({
        text: "Token / code",
        value: "TOKEN-RECOVERED-123",
      }),
    );
    expect(reconcileCalls).toBe(1);
    expect(purchaseCalls).toBe(1);
  });

  it("lists only the authenticated customer's durable billing history", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport: providerTransport("100"),
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({
        secretKey: "secret",
        transport: providerTransport("100"),
      }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
    });

    const quoted = await service.createQuote({
      authorizationHeader: "Bearer session",
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      customerId: "+2348012345678",
      amount: "100",
    });
    const history = await service.list({
      authorizationHeader: "Bearer session",
      limit: 10,
    });

    expect(history).toHaveLength(1);
    expect(history[0]?.quote.quoteId).toBe(quoted.quote.quoteId);
    expect(history[0]?.quote.userId).toBe(owner.userId);
  });
});

describe("billing service qualification policy", () => {
  const categoryCodes = [
    "CABLEBILLS",
    "INTSERVICE",
    "UTILITYBILLS",
    "TAX",
    "DONATIONS",
    "TRANSLOG",
    "DEALPAY",
    "RELINST",
    "SCHPB",
  ] as const;

  for (const categoryCode of categoryCodes) {
    it(`validates provider customer identity for ${categoryCode}`, async () => {
      const owner = identity();
      const quotes = new MemoryQuotes();
      let validationCalls = 0;
      const transport: FlutterwaveBillsTransport = {
        async request(request) {
          if (request.method === "GET" && request.path === "/v3/top-bill-categories") {
            return { status: 200, body: { status: "success", data: [{
              code: categoryCode, name: categoryCode, description: categoryCode, country_code: "NG",
            }] } };
          }
          if (request.method === "GET" && request.path === `/v3/bills/${categoryCode}/billers`) {
            return { status: 200, body: { status: "success", data: [{
              biller_code: "BIL900", name: "Qualified biller",
            }] } };
          }
          if (request.method === "GET" && request.path === "/v3/billers/BIL900/items") {
            return { status: 200, body: { status: "success", data: [{
              biller_code: "BIL900", item_code: "ITEM900", name: "Qualified item",
              amount: "100", currency: "NGN", label_name: "Customer identifier",
            }] } };
          }
          if (request.method === "GET" && request.path === "/v3/bill-items/ITEM900/validate") {
            validationCalls += 1;
            return { status: 200, body: { status: "success", data: {
              response_code: "00", response_message: "Successful",
              customer: "CUSTOMER-900", name: "Qualified Customer",
              biller_code: "BIL900", product_code: "ITEM900",
              minimum: "100", maximum: "100",
            } } };
          }
          throw new Error(`unexpected provider call ${request.method} ${request.path}`);
        },
      };
      const service = createBillingCheckoutService({
        sessions: { async authorize() { return owner; } },
        quotes,
        catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
        funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
        billing: billing(quotes),
        actionSecret: "a".repeat(48),
        redirectUrl: "https://app.masanawa.com/billing/return",
      });
      await expect(service.createQuote({
        authorizationHeader: "Bearer session",
        categoryCode,
        billerCode: "BIL900",
        itemCode: "ITEM900",
        customerId: "CUSTOMER-900",
        amount: "100",
      })).resolves.toMatchObject({ quote: { categoryCode, state: "quoted" } });
      expect(validationCalls).toBe(1);
    });
  }

  for (const categoryCode of ["AIRTIME","MOBILEDATA"] as const) {
    it(`uses phone validation without provider recipient lookup for ${categoryCode}`, async () => {
      const owner = identity();
      const quotes = new MemoryQuotes();
      let validationCalls = 0;
      const transport: FlutterwaveBillsTransport = {
        async request(request) {
          if (request.method === "GET" && request.path === "/v3/top-bill-categories") {
            return { status: 200, body: { status: "success", data: [{
              code: categoryCode, name: categoryCode, description: categoryCode, country_code: "NG",
            }] } };
          }
          if (request.method === "GET" && request.path === `/v3/bills/${categoryCode}/billers`) {
            return { status: 200, body: { status: "success", data: [{
              biller_code: "BIL901", name: "Mobile biller",
            }] } };
          }
          if (request.method === "GET" && request.path === "/v3/billers/BIL901/items") {
            return { status: 200, body: { status: "success", data: [{
              biller_code: "BIL901", item_code: "ITEM901", name: "Mobile item",
              amount: categoryCode === "AIRTIME" ? "0" : "100",
              currency: "NGN", label_name: "Mobile Number",
            }] } };
          }
          if (request.path.includes("/validate")) {
            validationCalls += 1;
            throw new Error("mobile validation must be skipped");
          }
          throw new Error(`unexpected provider call ${request.method} ${request.path}`);
        },
      };
      const service = createBillingCheckoutService({
        sessions: { async authorize() { return owner; } },
        quotes,
        catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
        funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
        billing: billing(quotes),
        actionSecret: "a".repeat(48),
        redirectUrl: "https://app.masanawa.com/billing/return",
      });
      await expect(service.createQuote({
        authorizationHeader: "Bearer session",
        categoryCode,
        billerCode: "BIL901",
        itemCode: "ITEM901",
        customerId: "+2348012345678",
        amount: "100",
      })).resolves.toMatchObject({ quote: { categoryCode, state: "quoted" } });
      expect(validationCalls).toBe(0);
    });
  }
});

describe("billing Twin commission reversal", () => {
  it("reverses the full settled commission when a Twin-origin bill is fully refunded", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const originatingCharacterId = createCanonicalId("character");
    const createdAt = "2026-10-04T20:00:00.000Z";
    quotes.quote = Object.freeze({
      schemaVersion: 1 as const,
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: createCanonicalId("quote"),
      revision: 1,
      categoryCode: "AIRTIME",
      originatingCharacterId,
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10000,
      feeAmountKobo: 0,
      totalAmountKobo: 10000,
      currency: "NGN" as const,
      state: "refunded" as const,
      confirmedAt: createdAt,
      expiresAt: "2026-10-04T21:00:00.000Z",
      checkoutTxRef: "bill-test-r1",
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      providerTransactionId: "44",
      providerReference: "FLW-PAY-44",
      billProviderReference: "BILL-1",
      paymentVerifiedAt: createdAt,
      fulfillmentReference: "bill-fulfillment-1",
      settlementState: "failed" as const,
      refundReference: "REFUND-44",
      createdAt,
      updatedAt: createdAt,
    });
    const reversals: Array<Record<string, unknown>> = [];
    const transport = providerTransport("100");
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport,
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      twinMonetization: {
        async attribute() {},
        async settleProviderValue() { return { eligible: true }; },
        async reverseFull(input) { reversals.push(input); },
      },
    });

    await service.read({
      authorizationHeader: "Bearer session",
      quoteId: quotes.quote.quoteId,
    });
    expect(reversals).toEqual([
      expect.objectContaining({
        operationId: `billing:${quotes.quote.quoteId}`,
        reversalId: `billing-refund:${quotes.quote.quoteId}`,
      }),
    ]);
  });
});

describe("billing refund safety", () => {
  it("allows exactly one refund POST when two requests race from refund-pending", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const createdAt = "2026-10-04T20:00:00.000Z";
    quotes.quote = Object.freeze({
      schemaVersion: 1 as const,
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: createCanonicalId("quote"),
      revision: 1,
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10000,
      feeAmountKobo: 0,
      totalAmountKobo: 10000,
      currency: "NGN" as const,
      state: "refund-pending" as const,
      confirmedAt: createdAt,
      expiresAt: "2026-10-04T21:00:00.000Z",
      checkoutTxRef: "bill-test-r1",
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      providerTransactionId: "44",
      providerReference: "FLW-PAY-44",
      billProviderReference: "BILL-FAILED-1",
      paymentVerifiedAt: createdAt,
      fulfillmentReference: "bill-fulfillment-1",
      settlementState: "failed" as const,
      refundReference: null,
      createdAt,
      updatedAt: createdAt,
    });

    let refundPosts = 0;
    let refundQueries = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (request.method === "GET" && request.path === "/v3/refunds") {
          refundQueries += 1;
          return { status: 200, body: { status: "success", data: [] } };
        }
        if (
          request.method === "POST" &&
          request.path === "/v3/transactions/44/refund"
        ) {
          refundPosts += 1;
          await Promise.resolve();
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                id: "refund-44",
                flw_ref: "REFUND-44",
                status: "completed-bank-transfer",
                amount_refunded: "100",
              },
            },
          };
        }
        throw new Error(`unexpected provider call ${request.method} ${request.path}`);
      },
    };
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport,
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      now: () => "2026-10-04T20:10:00.000Z",
    });

    const [left,right] = await Promise.all([
      service.read({
        authorizationHeader: "Bearer session",
        quoteId: quotes.quote.quoteId,
      }),
      service.read({
        authorizationHeader: "Bearer session",
        quoteId: quotes.quote.quoteId,
      }),
    ]);

    expect(refundPosts).toBe(1);
    expect(refundQueries).toBeLessThanOrEqual(1);
    expect([left.quote.state,right.quote.state]).toContain("refunded");
    expect(quotes.quote.state).toBe("refunded");
  });

  it("does not mark a partial refund as fully refunded", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const createdAt = "2026-10-04T20:00:00.000Z";
    quotes.quote = Object.freeze({
      schemaVersion: 1 as const,
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: createCanonicalId("quote"),
      revision: 1,
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10000,
      feeAmountKobo: 0,
      totalAmountKobo: 10000,
      currency: "NGN" as const,
      state: "refund-pending" as const,
      confirmedAt: createdAt,
      expiresAt: "2026-10-04T21:00:00.000Z",
      checkoutTxRef: "bill-test-r1",
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      providerTransactionId: "44",
      providerReference: "FLW-PAY-44",
      billProviderReference: "BILL-FAILED-1",
      paymentVerifiedAt: createdAt,
      fulfillmentReference: "bill-fulfillment-1",
      settlementState: "failed" as const,
      refundReference: null,
      createdAt,
      updatedAt: createdAt,
    });
    let refundPosts = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (
          request.method === "POST" &&
          request.path === "/v3/transactions/44/refund"
        ) {
          refundPosts += 1;
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                id: "refund-partial",
                flw_ref: "REFUND-PARTIAL",
                status: "completed-bank-transfer",
                amount_refunded: "50",
              },
            },
          };
        }
        throw new Error(`unexpected provider call ${request.method} ${request.path}`);
      },
    };
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({
        secretKey: "secret",
        transport,
        country: "NG",
      }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      now: () => "2026-10-04T20:10:00.000Z",
    });

    const result = await service.read({
      authorizationHeader: "Bearer session",
      quoteId: quotes.quote.quoteId,
    });

    expect(refundPosts).toBe(1);
    expect(result.quote).toMatchObject({
      state: "refund-submitted",
      refundReference: "REFUND-PARTIAL",
    });
    expect(result.phase).toBe("processing");
  });

  it("never emits a second refund POST from a pre-existing unknown dispatch", async () => {
    const owner = identity();
    const quotes = new MemoryQuotes();
    const createdAt = "2026-10-04T20:00:00.000Z";
    quotes.quote = Object.freeze({
      schemaVersion: 1 as const,
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: createCanonicalId("quote"),
      revision: 1,
      categoryCode: "AIRTIME",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "+2348012345678",
      serviceAmountKobo: 10000,
      feeAmountKobo: 0,
      totalAmountKobo: 10000,
      currency: "NGN" as const,
      state: "refund-dispatching" as const,
      confirmedAt: createdAt,
      expiresAt: "2026-10-04T21:00:00.000Z",
      checkoutTxRef: "bill-test-r1",
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/test",
      providerTransactionId: "44",
      providerReference: "FLW-PAY-44",
      billProviderReference: "BILL-FAILED-1",
      paymentVerifiedAt: createdAt,
      fulfillmentReference: "bill-fulfillment-1",
      settlementState: "failed" as const,
      refundReference: null,
      createdAt,
      updatedAt: createdAt,
    });

    let refundPosts = 0;
    let refundQueries = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (request.method === "GET" && request.path === "/v3/refunds") {
          refundQueries += 1;
          return { status: 200, body: { status: "success", data: [] } };
        }
        if (request.method === "POST" && request.path.includes("/refund")) {
          refundPosts += 1;
          throw new Error("duplicate refund must never be sent");
        }
        throw new Error(`unexpected provider call ${request.method} ${request.path}`);
      },
    };
    const service = createBillingCheckoutService({
      sessions: { async authorize() { return owner; } },
      quotes,
      catalog: new FlutterwaveBillsClient({ secretKey: "secret", transport, country: "NG" }),
      funding: new FlutterwaveFundingClient({ secretKey: "secret", transport }),
      billing: billing(quotes),
      actionSecret: "a".repeat(48),
      redirectUrl: "https://app.masanawa.com/billing/return",
      now: () => "2026-10-04T20:10:00.000Z",
    });

    const result = await service.read({
      authorizationHeader: "Bearer session",
      quoteId: quotes.quote.quoteId,
    });
    expect(result.quote.state).toBe("refund-dispatching");
    expect(refundQueries).toBe(1);
    expect(refundPosts).toBe(0);
  });
});


import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  FlutterwaveBillsClient,
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
  type FlutterwaveBillsTransport,
} from "@masanawa/providers";
import { createBillingFinancialService, type BillingWebhookAdmissionRepository } from "./financial_billing.js";
import type { FinancialAuthorizer } from "./financial_service.js";

class MemoryStore implements BillingFulfillmentStore {
  #records = new Map<string, BillingFulfillmentRecord>();

  async createIfAbsent(input: BillingFulfillmentRecord) {
    const existing = this.#records.get(input.fulfillmentReference);
    if (existing) return { record: existing, created: false };
    this.#records.set(input.fulfillmentReference, input);
    return { record: input, created: true };
  }

  async read(reference: string) {
    return this.#records.get(reference) ?? null;
  }

  async compareAndSet(expectedRevision: number, next: BillingFulfillmentRecord) {
    const current = this.#records.get(next.fulfillmentReference);
    if (!current || current.revision !== expectedRevision) throw new Error("conflict");
    this.#records.set(next.fulfillmentReference, next);
    return next;
  }
}

describe("BillingFinancialService catalog authority", () => {
  it("fails closed when relay configuration is incomplete", () => {
    const store = new MemoryStore();
    const authorizer: FinancialAuthorizer = {
      async authorize() {
        return {
          tenantId: createCanonicalId("tenant"),
          userId: createCanonicalId("user"),
        };
      },
    };
    const webhookRepository: BillingWebhookAdmissionRepository = {
      async admitProviderWebhook() {
        return { duplicate: false };
      },
    };

    const base = {
      billingStore: () => store,
      webhookRepository,
      authorizer,
      flutterwaveSecretKey: "test-secret",
      flutterwaveWebhookHash: "test-hash",
      flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
    };

    expect(() =>
      createBillingFinancialService({
        ...base,
        flutterwaveRelayUrl: "https://relay.example.test",
      }),
    ).toThrow("flutterwave.relay.configuration_incomplete");

    expect(() =>
      createBillingFinancialService({
        ...base,
        flutterwaveRelayToken: "relay-secret",
      }),
    ).toThrow("flutterwave.relay.configuration_incomplete");

    expect(() =>
      createBillingFinancialService({
        ...base,
        flutterwaveRelayUrl: "https://relay.example.test",
        flutterwaveRelayToken: "relay-secret",
      }),
    ).not.toThrow();
  });

  it("re-derives provider catalog fields before dispatch and ignores tampered client metadata", async () => {
    const paymentBodies: unknown[] = [];
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (request.method === "GET" && request.path === "/v3/billers/BIL119/items") {
          return {
            status: 200,
            body: {
              status: "success",
              data: [{
                biller_code: "BIL119",
                item_code: "AIRTIME",
                name: "Airtel Airtime",
                amount: "0",
                currency: "NGN",
                label_name: "Phone",
              }],
            },
          };
        }
        if (request.method === "GET" && request.path === "/v3/bill-items/AIRTIME/validate") {
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                response_code: "00",
                response_message: "Successful",
                customer: "07010102053",
                name: "Test Customer",
                biller_code: "BIL119",
                product_code: "AIRTIME",
                minimum: "50",
                maximum: "50000",
              },
            },
          };
        }
        if (request.method === "POST" && request.path === "/v3/billers/BIL119/items/AIRTIME/payment") {
          paymentBodies.push(request.body);
          const body = request.body as Record<string, unknown>;
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                customer_reference: body.reference,
                flw_ref: "BP-TEST-1",
                status: "successful",
                amount: body.amount,
                currency: "NGN",
                customer_id: body.customer_id,
                product: "AIRTIME",
                product_name: "Airtel Airtime",
              },
            },
          };
        }
        throw new Error(`unexpected request: ${request.method} ${request.path}`);
      },
    };

    const providerClient = new FlutterwaveBillsClient({
      secretKey: "test-secret",
      transport,
      country: "NG",
    });
    const store = new MemoryStore();
    const authorizer: FinancialAuthorizer = {
      async authorize() {
        return {
          tenantId: createCanonicalId("tenant"),
          userId: createCanonicalId("user"),
        };
      },
    };
    const webhookRepository: BillingWebhookAdmissionRepository = {
      async admitProviderWebhook() {
        return { duplicate: false };
      },
    };

    const service = createBillingFinancialService({
      billingStore: () => store,
      webhookRepository,
      authorizer,
      flutterwaveSecretKey: "test-secret",
      flutterwaveWebhookHash: "test-hash",
      flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
      providerClient,
      billingFunding: { async reserveConfirmedBill() {}, async settleBill() {} },
    });

    const result = await service.purchase({
      authorizationHeader: "Bearer test",
      requestId: "billing-request-123",
      quoteId: "confirmed-quote-123", quoteRevision: 1,
      billerCode: "BIL119",
      itemCode: "AIRTIME",
      itemName: "Tampered Cheap Product",
      customerId: "07010102053",
      amount: "100",
      catalogAmount: "1",
    });

    expect(result).toMatchObject({
      itemName: "Airtel Airtime",
      amount: "100",
      state: "succeeded",
      providerReference: "BP-TEST-1",
    });
    expect(paymentBodies).toHaveLength(1);
    expect(paymentBodies[0]).toMatchObject({
      amount: "100",
      customer_id: "07010102053",
      reference: "billing-request-123",
    });
  });
  it("reconciles a trusted owner-scoped uncertain purchase and settles exact funding", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const reference = "billing-request-reconcile";
    const store = new MemoryStore();
    await store.createIfAbsent({
      fulfillmentReference: reference,
      billerCode: "BIL119",
      itemCode: "AIRTIME",
      itemName: "Airtel Airtime",
      customerId: "07010102053",
      customerName: null,
      amount: "100",
      currency: "NGN",
      revision: 2,
      state: "checking",
      providerReference: null,
      providerStatus: "outcome_unknown",
      lastEvidenceAt: "2026-10-04T20:00:00.000Z",
    });
    const settled: unknown[] = [];
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (
          request.method === "GET" &&
          request.path === `/v3/bills/${reference}`
        ) {
          return {
            status: 200,
            body: {
              status: "success",
              data: {
                customer_reference: reference,
                flw_ref: "BP-RECOVERED-1",
                status: "successful",
                amount: "100",
                currency: "NGN",
                customer_id: "07010102053",
                product: "AIRTIME",
                product_name: "Airtel Airtime",
              },
            },
          };
        }
        throw new Error(`unexpected request: ${request.method} ${request.path}`);
      },
    };
    const service = createBillingFinancialService({
      billingStore: () => store,
      webhookRepository: { async admitProviderWebhook() { return { duplicate: false }; } },
      authorizer: {
        async authorize() {
          throw new Error("public authorizer must not be used for trusted internal reconciliation");
        },
      },
      flutterwaveSecretKey: "test-secret",
      flutterwaveWebhookHash: "test-hash",
      flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
      providerClient: new FlutterwaveBillsClient({
        secretKey: "test-secret",
        transport,
        country: "NG",
      }),
      billingFunding: {
        async reserveConfirmedBill() {},
        async settleBill(input) { settled.push(input); },
      },
    });

    const result = await service.reconcileOwnedPurchase({
      tenantId,
      userId,
      reference,
    });

    expect(result).toMatchObject({
      state: "succeeded",
      providerReference: "BP-RECOVERED-1",
      providerStatus: "successful",
    });
    expect(settled).toEqual([{
      tenantId,
      userId,
      fulfillmentReference: reference,
      state: "succeeded",
      providerReference: "BP-RECOVERED-1",
    }]);
  });

  it("rejects a client category relabel at the funding boundary before provider dispatch", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    let paymentPosts = 0;
    const transport: FlutterwaveBillsTransport = {
      async request(request) {
        if (request.method === "GET" && request.path === "/v3/billers/BIL119/items") {
          return {
            status: 200,
            body: {
              status: "success",
              data: [{
                biller_code: "BIL119",
                item_code: "ITEM119",
                name: "Provider item",
                amount: "0",
                currency: "NGN",
                label_name: "Customer",
              }],
            },
          };
        }
        if (request.method === "GET" && request.path === "/v3/top-bill-categories") {
          return {
            status: 200,
            body: {
              status: "success",
              data: [{
                code: "AIRTIME",
                name: "Airtime",
                description: "Airtime",
                country_code: "NG",
              }],
            },
          };
        }
        if (request.method === "GET" && request.path === "/v3/bills/AIRTIME/billers") {
          return {
            status: 200,
            body: {
              status: "success",
              data: [{ biller_code: "BIL119", name: "Provider biller" }],
            },
          };
        }
        if (request.method === "POST") {
          paymentPosts += 1;
          throw new Error("provider dispatch must not happen");
        }
        throw new Error(`unexpected request: ${request.method} ${request.path}`);
      },
    };
    const service = createBillingFinancialService({
      billingStore: () => new MemoryStore(),
      webhookRepository: {
        async admitProviderWebhook() { return { duplicate: false }; },
      },
      authorizer: {
        async authorize() { return { tenantId, userId }; },
      },
      flutterwaveSecretKey: "test-secret",
      flutterwaveWebhookHash: "test-hash",
      flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
      providerClient: new FlutterwaveBillsClient({
        secretKey: "test-secret",
        transport,
        country: "NG",
      }),
      billingFunding: {
        async reserveConfirmedBill(input) {
          if (input.categoryCode !== "UTILITYBILLS") {
            throw new Error("financial.billing.quote_terms_mismatch");
          }
        },
        async settleBill() {},
      },
    });

    await expect(service.purchase({
      authorizationHeader: "Bearer test",
      requestId: "billing-request-category-tamper",
      quoteId: "quote-bound-to-utility",
      quoteRevision: 1,
      categoryCode: "AIRTIME",
      billerCode: "BIL119",
      itemCode: "ITEM119",
      itemName: "Tampered item",
      customerId: "07010102053",
      amount: "100",
      catalogAmount: "100",
    })).rejects.toThrow("financial.billing.quote_terms_mismatch");

    expect(paymentPosts).toBe(0);
  });

  it("never calls a provider without canonical verified funding and a confirmed quote", async () => {
    let calls = 0;
    const identity = {tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user")};
    const base = {
      billingStore: () => new MemoryStore(),
      webhookRepository: {async admitProviderWebhook() { return {duplicate: false}; }},
      authorizer: {async authorize() { return identity; }},
      flutterwaveSecretKey: "secret", flutterwaveWebhookHash: "hash", flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
      providerClient: new FlutterwaveBillsClient({secretKey: "secret", transport: {async request() {calls++; throw new Error("must not call provider"); }}}),
    };
    const request = {authorizationHeader: "Bearer test", requestId: "billing-request", quoteId: "quote-confirmed", quoteRevision: 1, billerCode: "B", itemCode: "I", itemName: "Bill", customerId: "Customer", amount: "100", catalogAmount: "100"};
    // Both prerequisites are independently enforced before provider requests:
    // a valid quote cannot bypass missing funding, and available funding
    // cannot authorize a purchase with missing/invalid quote identity.
    await expect(createBillingFinancialService(base).purchase(request)).rejects.toThrow("funding_unavailable");
    await expect(createBillingFinancialService({...base, billingFunding: {async reserveConfirmedBill() {}, async settleBill() {}}}).purchase({
      ...request, quoteId: "", quoteRevision: 0,
    })).rejects.toThrow("confirmed_quote_required");
    expect(calls).toBe(0);
  });

});


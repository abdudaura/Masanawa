import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  FlutterwaveBillsClient,
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
  type FlutterwaveBillsTransport,
} from "@masanawa/providers";
import type {
  BillingFundingRepository,
  BillingFundingReceipt,
  ProviderWebhookRepository,
} from "@masanawa/postgres";
import {
  createBillingCreditPricingPolicy,
  createBillingFinancialService,
} from "./financial_billing.js";
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


function fundingRepository(events: string[]): BillingFundingRepository {
  let snapshot: BillingFundingReceipt | null = null;
  return {
    async reserve(input) {
      events.push("funding:reserve");
      snapshot = {
        reference: input.reference,
        tenantId: createCanonicalId("tenant"),
        userId: createCanonicalId("user"),
        quoteId: createCanonicalId("quote"),
        providerAmountNgn: input.providerAmountNgn,
        customerPriceCredits: input.customerPriceCredits,
        providerReserveCredits: input.providerReserveCredits,
        platformMarginCredits: input.platformMarginCredits,
        pricingPolicyVersion: input.pricingPolicyVersion,
        state: "reserved",
      };
      return snapshot;
    },
    async settle(input) {
      events.push(`funding:${input.outcome}`);
      if (!snapshot) throw new Error("not reserved");
      snapshot = { ...snapshot, state: input.outcome === "succeeded" ? "settled" : "refunded" };
      return snapshot;
    },
  };
}

describe("BillingFinancialService catalog authority", () => {
  it("fails closed when relay configuration is incomplete", () => {
    const store = new MemoryStore();
    const fundingEvents: string[] = [];
    const authorizer: FinancialAuthorizer = {
      async authorize() {
        return {
          tenantId: createCanonicalId("tenant"),
          userId: createCanonicalId("user"),
        };
      },
    };
    const webhookRepository: ProviderWebhookRepository = {
      async admitProviderWebhook() {
        return { duplicate: false };
      },
    };

    const base = {
      billingStore: () => store,
      billingFunding: () => fundingRepository(fundingEvents),
      pricingPolicy: createBillingCreditPricingPolicy({
        creditsPerNgn: 1,
        platformMarginBps: 1_000,
        version: "test-v1",
      }),
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

  it("prices NGN amounts deterministically without assuming a hidden exchange rate", () => {
    const policy = createBillingCreditPricingPolicy({
      creditsPerNgn: 2,
      platformMarginBps: 500,
      version: "pricing-v2",
    });
    expect(policy.quote({
      providerAmountNgn: "100.25",
      billerCode: "BIL119",
      itemCode: "AIRTIME",
    })).toEqual({
      providerReserveCredits: 201,
      platformMarginCredits: 11,
      customerPriceCredits: 212,
    });
    expect(() => createBillingCreditPricingPolicy({
      creditsPerNgn: 0,
      platformMarginBps: 500,
      version: "pricing-v2",
    })).toThrow();
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
    const webhookRepository: ProviderWebhookRepository = {
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
    });

    const result = await service.purchase({
      authorizationHeader: "Bearer test",
      requestId: "request_0194c2d2-6c00-7abc-8abc-1234567890ab",
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
    expect(fundingEvents).toEqual(["funding:reserve", "funding:succeeded"]);
    expect(paymentBodies[0]).toMatchObject({
      amount: "100",
      customer_id: "07010102053",
      reference: "request_0194c2d2-6c00-7abc-8abc-1234567890ab",
    });
  });
});

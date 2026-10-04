import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  FlutterwaveBillsClient,
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
  type FlutterwaveBillsTransport,
} from "@masanawa/providers";
import type { ProviderWebhookRepository } from "@masanawa/postgres";
import { createBillingFinancialService } from "./financial_billing.js";
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
    const webhookRepository: ProviderWebhookRepository = {
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
      requestId: "billing-request-123",
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
});

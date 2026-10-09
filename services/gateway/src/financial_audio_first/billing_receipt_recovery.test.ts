import { describe, expect, it, vi } from "vitest";
import {
  FlutterwaveBillsClient,
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
} from "@masanawa/providers";
import {
  createBillingFinancialService,
  type BillingWebhookAdmissionRepository,
} from "../financial_billing.js";

class MemoryStore implements BillingFulfillmentStore {
  readonly records = new Map<string, BillingFulfillmentRecord>();

  async createIfAbsent(record: BillingFulfillmentRecord) {
    const current = this.records.get(record.fulfillmentReference);
    if (current) return { record: current, created: false };
    this.records.set(record.fulfillmentReference, record);
    return { record, created: true };
  }

  async read(reference: string) {
    return this.records.get(reference) ?? null;
  }

  async compareAndSet(revision: number, record: BillingFulfillmentRecord) {
    const current = this.records.get(record.fulfillmentReference);
    if (!current || current.revision !== revision) throw new Error("conflict");
    this.records.set(record.fulfillmentReference, record);
    return record;
  }
}

const identity = { tenantId: "tenant-test", userId: "user-test" };
const reference = "bill-test-001";

function fulfillment(state: BillingFulfillmentRecord["state"]): BillingFulfillmentRecord {
  return {
    fulfillmentReference: reference,
    billerCode: "BIL119",
    itemCode: "AIRTIME",
    itemName: "Airtime",
    customerId: "07010102053",
    customerName: null,
    amount: "100",
    currency: "NGN",
    revision: 2,
    state,
    providerReference: state === "succeeded" ? "BP-TEST" : null,
    providerStatus: state === "succeeded" ? "successful" : "outcome_unknown",
    lastEvidenceAt: "2026-10-09T09:00:00.000Z",
  };
}

function harness(store = new MemoryStore()) {
  const providerRequests = vi.fn(async (): Promise<never> => {
    throw new Error("provider unavailable");
  });
  const settleBill = vi.fn(async () => {});
  const admitProviderWebhook = vi.fn(async () => ({ duplicate: false }));
  const webhookRepository: BillingWebhookAdmissionRepository = { admitProviderWebhook };
  const service = createBillingFinancialService({
    billingStore: () => store,
    webhookRepository,
    authorizer: { async authorize() { return identity; } },
    flutterwaveSecretKey: "test-secret",
    flutterwaveWebhookHash: "test-hash",
    flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
    providerClient: new FlutterwaveBillsClient({
      secretKey: "test-secret",
      country: "NG",
      transport: { request: providerRequests },
    }),
    billingFunding: {
      async reserveConfirmedBill() {},
      settleBill,
    },
  });
  return { service, store, providerRequests, settleBill, admitProviderWebhook };
}

function webhook(payload: Record<string, unknown>) {
  return {
    rawBody: Buffer.from(JSON.stringify(payload), "utf8"),
    verifHash: "test-hash",
  };
}

describe("AF01 billing receipt recovery (UX-A07 / WF-A08)", () => {
  it("preserves previously confirmed success when the provider refresh fails", async () => {
    const h = harness();
    h.store.records.set(reference, fulfillment("succeeded"));

    const result = await h.service.readPurchase({
      authorizationHeader: "Bearer valid-session",
      reference,
      refresh: true,
    });

    expect(result.state).toBe("succeeded");
    expect(result.providerReference).toBe("BP-TEST");
    expect(h.providerRequests).toHaveBeenCalledOnce();
    expect(h.settleBill).toHaveBeenCalledTimes(1);
    expect(h.settleBill).toHaveBeenCalledWith({
      ...identity,
      fulfillmentReference: reference,
      state: "succeeded",
      providerReference: "BP-TEST",
    });
  });

  it("does not mask provider errors for unsettled or outcome-unknown purchases", async () => {
    const h = harness();
    h.store.records.set(reference, fulfillment("checking"));

    await expect(h.service.readPurchase({
      authorizationHeader: "Bearer valid-session",
      reference,
      refresh: true,
    })).rejects.toThrow("Flutterwave bill request failed");

    expect(h.providerRequests).toHaveBeenCalledOnce();
    expect(h.settleBill).not.toHaveBeenCalled();
  });


  it("never hides a failed database compare-and-set after a provider reversal", async () => {
    const store = new MemoryStore();
    store.records.set(reference, fulfillment("succeeded"));
    const compareAndSet = vi.spyOn(store, "compareAndSet").mockRejectedValue(new Error("database conflict"));
    const settleBill = vi.fn(async () => {});
    const service = createBillingFinancialService({
      billingStore: () => store,
      webhookRepository: { async admitProviderWebhook() { return { duplicate: false }; } },
      authorizer: { async authorize() { return identity; } },
      flutterwaveSecretKey: "test-secret",
      flutterwaveWebhookHash: "test-hash",
      flutterwaveWebhookUrl: "https://example.com/webhooks/flutterwave",
      providerClient: new FlutterwaveBillsClient({
        secretKey: "test-secret",
        country: "NG",
        transport: {
          async request() {
            return { status: 200, body: { status: "success", data: {
              customer_reference: reference,
              flw_ref: "BP-REVERSAL",
              status: "reversed",
              amount: "100",
              currency: "NGN",
              customer_id: "07010102053",
              product: "AIRTIME",
              product_name: "Airtime",
            } } };
          },
        },
      }),
      billingFunding: { async reserveConfirmedBill() {}, settleBill },
    });

    await expect(service.readPurchase({
      authorizationHeader: "Bearer valid-session",
      reference,
      refresh: true,
    })).rejects.toThrow("database conflict");
    expect(compareAndSet).toHaveBeenCalledOnce();
    expect(settleBill).not.toHaveBeenCalled();
  });

  it("prefers signed customer fulfillment reference over unrelated provider reference", async () => {
    const h = harness();
    const result = await h.service.receiveWebhook(webhook({
      event: "bill.completed",
      reference: "provider-transaction-9",
      data: { customer_reference: reference, tx_ref: reference },
    }));

    expect(result).toEqual({ duplicate: false, reference });
    expect(h.admitProviderWebhook).toHaveBeenCalledTimes(1);
    expect(h.admitProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "flutterwave",
        eventKey: `bill:${reference}:bill.completed`,
      }),
    );
    expect(h.providerRequests).not.toHaveBeenCalled();
    expect(h.settleBill).not.toHaveBeenCalled();
  });

  it("rejects conflicting signed client aliases before creating an admitted event", async () => {
    const h = harness();

    await expect(h.service.receiveWebhook(webhook({
      event: "bill.completed",
      tx_ref: reference,
      data: { customer_reference: "another-bill" },
    }))).rejects.toMatchObject({ code: "invalid_webhook" });

    expect(h.admitProviderWebhook).not.toHaveBeenCalled();
    expect(h.providerRequests).not.toHaveBeenCalled();
  });

  it.each([
    ["overlength", "x".repeat(129)],
    ["control-byte", `bill-\\u0000other`],
    ["bidi override", `bill-\\u202eother`],
  ])("rejects %s signed identifiers before durable admission", async (_, invalidReference) => {
    const h = harness();
    await expect(h.service.receiveWebhook(webhook({
      event: "bill.completed",
      data: { customer_reference: invalidReference },
    }))).rejects.toMatchObject({ code: "invalid_webhook" });
    expect(h.admitProviderWebhook).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signature before database admission", async () => {
    const h = harness();
    await expect(h.service.receiveWebhook({
      ...webhook({ event: "bill.completed", data: { customer_reference: reference } }),
      verifHash: "wrong-hash",
    })).rejects.toMatchObject({ code: "invalid_signature" });
    expect(h.admitProviderWebhook).not.toHaveBeenCalled();
  });

  it("keeps unreferenced signed events scoped to their fingerprint without crediting a bill", async () => {
    const h = harness();
    expect(await h.service.receiveWebhook(webhook({
      event: "charge.completed",
      data: { status: "successful" },
    }))).toEqual({ duplicate: false, reference: null });
    expect(h.admitProviderWebhook).toHaveBeenCalledTimes(1);
    expect(h.admitProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: "event:charge.completed" }),
    );
    expect(h.settleBill).not.toHaveBeenCalled();
  });
});

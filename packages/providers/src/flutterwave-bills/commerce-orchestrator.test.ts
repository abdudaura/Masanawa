import { describe, expect, it } from "vitest";
import {
  BillingCommerceError,
  BillingCommerceOrchestrator,
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
  type FlutterwaveBillingPort,
} from "./commerce-orchestrator.js";
import { FlutterwaveBillProviderError } from "./client.js";

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
    if (!current || current.revision !== expectedRevision) {
      throw new Error("conflict");
    }
    this.#records.set(next.fulfillmentReference, next);
    return next;
  }
}

function provider(overrides: Partial<FlutterwaveBillingPort> = {}): FlutterwaveBillingPort {
  return {
    async validateCustomer(_item, customer) {
      return {
        valid: true,
        responseCode: "00",
        responseMessage: "Successful",
        customer,
        name: "Ada Customer",
        billerCode: "BIL119",
        productCode: "CB141",
        minimum: "100",
        maximum: "50000",
      };
    },
    async createPayment(input) {
      return {
        reference: input.reference,
        providerReference: "BP-1",
        status: "successful",
        amount: input.amount,
        currency: "NGN",
        customerId: input.customerId,
        product: input.itemCode,
        productName: "Electricity",
        extra: null,
      };
    },
    async getStatus(reference) {
      return {
        reference,
        providerReference: "BP-1",
        status: "successful",
        amount: "24900.00",
        currency: "NGN",
        customerId: "0025401100",
        product: "CB141",
        productName: "Electricity",
        extra: null,
      };
    },
    ...overrides,
  };
}

const purchase = {
  fulfillmentReference: "fulfillment-123",
  billerCode: "BIL119",
  itemCode: "CB141",
  itemName: "Electricity",
  customerId: "0025401100",
  amount: "24900.00",
  catalogAmount: "24900",
};

describe("BillingCommerceOrchestrator", () => {
  it("validates recipient and provider amount limits before creating a durable ready record", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({ provider: provider(), store });
    await expect(orchestrator.prepare(purchase)).resolves.toMatchObject({
      fulfillmentReference: "fulfillment-123",
      customerName: "Ada Customer",
      amount: "24900.00",
      state: "ready",
      revision: 1,
    });
  });

  it("supports Flutterwave airtime/data flow without validation when the catalog says it is unnecessary", async () => {
    let validations = 0;
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async validateCustomer() {
          validations += 1;
          throw new Error("must not validate airtime/data");
        },
      }),
    });
    await expect(
      orchestrator.prepare({
        ...purchase,
        itemName: "1 GB Data",
        recipientValidation: "not-required",
      }),
    ).resolves.toMatchObject({
      state: "ready",
      customerName: null,
    });
    expect(validations).toBe(0);
  });

  it("accepts provider-declared variable-value catalog items while enforcing recipient limits", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      provider: provider(),
      store,
    });
    await expect(
      orchestrator.prepare({
        ...purchase,
        itemName: "Airtel Airtime",
        amount: "100",
        catalogAmount: "0",
      }),
    ).resolves.toMatchObject({
      itemName: "Airtel Airtime",
      amount: "100",
      state: "ready",
    });
    await expect(
      orchestrator.prepare({
        ...purchase,
        fulfillmentReference: "fulfillment-too-small",
        itemName: "Airtel Airtime",
        amount: "10",
        catalogAmount: "0",
      }),
    ).rejects.toMatchObject({ code: "amount_below_minimum" });
  });

  it("rejects a provider validation that does not bind the selected biller", async () => {
    const orchestrator = new BillingCommerceOrchestrator({
      store: new MemoryStore(),
      provider: provider({
        async validateCustomer(_item, customer) {
          return {
            valid: true,
            responseCode: "00",
            responseMessage: "Successful",
            customer,
            name: null,
            billerCode: "DIFFERENT",
            productCode: null,
            minimum: null,
            maximum: null,
          };
        },
      }),
    });
    await expect(orchestrator.prepare(purchase)).rejects.toMatchObject({
      code: "recipient_mismatch",
    });
  });

  it("binds one fulfillment reference to one immutable set of bill terms", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({ provider: provider(), store });
    await orchestrator.prepare(purchase);
    await expect(
      orchestrator.prepare({ ...purchase, amount: "25000.00", catalogAmount: "25000" }),
    ).rejects.toMatchObject({ code: "fulfillment_reference_conflict" });
  });

  it("rejects a confirmed amount that differs from the selected live catalog item", async () => {
    const orchestrator = new BillingCommerceOrchestrator({
      provider: provider(),
      store: new MemoryStore(),
    });
    await expect(
      orchestrator.prepare({
        ...purchase,
        amount: "25000.00",
      }),
    ).rejects.toMatchObject({ code: "catalog_amount_mismatch" });
  });

  it("dispatches exact prepared terms and succeeds only on matching provider evidence", async () => {
    const calls: unknown[] = [];
    const p = provider({
      async createPayment(input) {
        calls.push(input);
        return {
          reference: input.reference,
          providerReference: "BP-9",
          status: "successful",
          amount: input.amount,
          currency: "NGN",
          customerId: input.customerId,
          product: input.itemCode,
          productName: "Electricity",
          extra: null,
        };
      },
    });
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({ provider: p, store });
    await orchestrator.prepare(purchase);
    const result = await orchestrator.dispatch("fulfillment-123");
    expect(result.state).toBe("succeeded");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      reference: "fulfillment-123",
      customerId: "0025401100",
      amount: "24900.00",
      billerCode: "BIL119",
      itemCode: "CB141",
    });
  });

  it("moves an ambiguous provider dispatch to checking and never blindly dispatches again", async () => {
    let dispatches = 0;
    let statusChecks = 0;
    const p = provider({
      async createPayment() {
        dispatches += 1;
        throw new FlutterwaveBillProviderError(
          "dispatch_outcome_unknown",
          "unknown",
          { outcomeUnknown: true },
        );
      },
      async getStatus() {
        statusChecks += 1;
        return null;
      },
    });
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({ provider: p, store });
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch("fulfillment-123")).resolves.toMatchObject({
      state: "checking",
      providerStatus: "outcome_unknown",
    });
    await expect(orchestrator.dispatch("fulfillment-123")).resolves.toMatchObject({
      state: "checking",
    });
    expect(dispatches).toBe(1);
    expect(statusChecks).toBe(1);
  });

  it("reconciles a persisted dispatching state instead of creating a second payment", async () => {
    let dispatches = 0;
    let checks = 0;
    const store = new MemoryStore();
    const p = provider({
      async createPayment(input) {
        dispatches += 1;
        return provider().createPayment(input);
      },
      async getStatus(reference) {
        checks += 1;
        return provider().getStatus(reference);
      },
    });
    const orchestrator = new BillingCommerceOrchestrator({ provider: p, store });
    const ready = await orchestrator.prepare(purchase);
    await store.compareAndSet(ready.revision, {
      ...ready,
      revision: ready.revision + 1,
      state: "dispatching",
    });
    const result = await orchestrator.dispatch("fulfillment-123");
    expect(result.state).toBe("succeeded");
    expect(dispatches).toBe(0);
    expect(checks).toBe(1);
  });

  it("accepts equivalent decimal formatting in provider success evidence", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async createPayment(input) {
          return {
            reference: input.reference,
            providerReference: "BP-EQ",
            status: "successful",
            amount: "24900",
            currency: "NGN",
            customerId: input.customerId,
            product: input.itemCode,
            productName: "Electricity",
            extra: null,
          };
        },
      }),
    });
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch("fulfillment-123")).resolves.toMatchObject({
      state: "succeeded",
      providerReference: "BP-EQ",
    });
  });

  it("fails closed to manual review when successful evidence has a different amount", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async createPayment(input) {
          return {
            reference: input.reference,
            providerReference: "BP-BAD",
            status: "successful",
            amount: "1.00",
            currency: "NGN",
            customerId: input.customerId,
            product: input.itemCode,
            productName: "Electricity",
            extra: null,
          };
        },
      }),
    });
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch("fulfillment-123")).resolves.toMatchObject({
      state: "manual_review",
      providerReference: "BP-BAD",
    });
  });

  it("recovers manual review when a later read-only status check returns exact evidence", async () => {
    let dispatches = 0;
    let checks = 0;
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async createPayment(input) {
          dispatches += 1;
          return {
            reference: input.reference,
            providerReference: "BP-BAD-FIRST",
            status: "successful",
            amount: "1.00",
            currency: "NGN",
            customerId: input.customerId,
            product: input.itemCode,
            productName: "Electricity",
            extra: null,
          };
        },
        async getStatus(reference) {
          checks += 1;
          return {
            reference,
            providerReference: "BP-CORRECTED",
            status: "successful",
            amount: purchase.amount,
            currency: "NGN",
            customerId: purchase.customerId,
            product: purchase.itemCode,
            productName: "Electricity",
            extra: null,
          };
        },
      }),
    });
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch(purchase.fulfillmentReference))
      .resolves.toMatchObject({ state: "manual_review" });

    await expect(orchestrator.reconcile(purchase.fulfillmentReference))
      .resolves.toMatchObject({
        state: "succeeded",
        providerReference: "BP-CORRECTED",
      });
    expect(dispatches).toBe(1);
    expect(checks).toBe(1);
  });

  it("does not treat a provider 404 during reconciliation as permission to redispatch", async () => {
    let dispatches = 0;
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async createPayment() {
          dispatches += 1;
          throw new FlutterwaveBillProviderError(
            "dispatch_outcome_unknown",
            "unknown",
            { outcomeUnknown: true },
          );
        },
        async getStatus() {
          return null;
        },
      }),
    });
    await orchestrator.prepare(purchase);
    await orchestrator.dispatch("fulfillment-123");
    await orchestrator.reconcile("fulfillment-123");
    await orchestrator.reconcile("fulfillment-123");
    expect(dispatches).toBe(1);
  });

  it("restores ready only for a proven non-ambiguous dispatch rejection", async () => {
    const store = new MemoryStore();
    const orchestrator = new BillingCommerceOrchestrator({
      store,
      provider: provider({
        async createPayment() {
          throw new FlutterwaveBillProviderError(
            "dispatch_rejected",
            "rejected",
          );
        },
      }),
    });
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch("fulfillment-123")).rejects.toMatchObject({
      code: "dispatch_rejected",
    });
    await expect(store.read("fulfillment-123")).resolves.toMatchObject({
      state: "ready",
      providerStatus: "dispatch_rejected",
    });
  });

  it("reports missing fulfillments without leaking storage details", async () => {
    const orchestrator = new BillingCommerceOrchestrator({
      provider: provider(),
      store: new MemoryStore(),
    });
    try {
      await orchestrator.dispatch("missing-reference");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BillingCommerceError);
      expect(error).toMatchObject({ code: "fulfillment_not_found" });
    }
  });
  it("does not reset dispatch protection when result persistence fails", async () => {
    const store = new MemoryStore();
    const original = store.compareAndSet.bind(store);
    let failOnce = true;
    store.compareAndSet = async (revision, next) => {
      if (next.state === "succeeded" && failOnce) { failOnce = false; throw new Error("database unavailable"); }
      return original(revision, next);
    };
    let dispatches = 0;
    const orchestrator = new BillingCommerceOrchestrator({store, provider: provider({async createPayment(input) { dispatches++; return provider().createPayment(input); }})});
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch(purchase.fulfillmentReference)).rejects.toThrow("database unavailable");
    await expect(store.read(purchase.fulfillmentReference)).resolves.toMatchObject({state: "dispatching"});
    await expect(orchestrator.dispatch(purchase.fulfillmentReference)).resolves.toMatchObject({state: "succeeded"});
    expect(dispatches).toBe(1);
  });

  it("reconciles untyped provider failures without a second dispatch", async () => {
    let dispatches = 0;
    const orchestrator = new BillingCommerceOrchestrator({store: new MemoryStore(), provider: provider({async createPayment() { dispatches++; throw new Error("unknown failure"); }, async getStatus() { return null; }})});
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch(purchase.fulfillmentReference)).resolves.toMatchObject({state: "checking"});
    await orchestrator.dispatch(purchase.fulfillmentReference);
    expect(dispatches).toBe(1);
  });

  it("does not accept a mismatched reversal as refund evidence", async () => {
    const orchestrator = new BillingCommerceOrchestrator({store: new MemoryStore(), provider: provider({async createPayment(input) { return {...await provider().createPayment(input), status: "reversed", amount: "1"}; }})});
    await orchestrator.prepare(purchase);
    await expect(orchestrator.dispatch(purchase.fulfillmentReference)).resolves.toMatchObject({state: "manual_review"});
  });

  it("recovers a delayed prepaid token without purchasing again", async () => {
    let dispatches = 0;
    const orchestrator = new BillingCommerceOrchestrator({store: new MemoryStore(), provider: provider({
      async createPayment(input) { dispatches++; return provider().createPayment(input); },
      async getStatus(reference) { return {...(await provider().getStatus(reference))!, extra: "TOKEN114700005707123"}; },
    })});
    await orchestrator.prepare(purchase);
    await orchestrator.dispatch(purchase.fulfillmentReference);
    await expect(orchestrator.reconcile(purchase.fulfillmentReference)).resolves.toMatchObject({state: "succeeded", deliveryCode: "TOKEN114700005707123"});
    expect(dispatches).toBe(1);
  });

  it("retains successful evidence if a later requery temporarily finds no record", async () => {
    const orchestrator = new BillingCommerceOrchestrator({store: new MemoryStore(), provider: provider({async getStatus() { return null; }})});
    await orchestrator.prepare(purchase);
    await orchestrator.dispatch(purchase.fulfillmentReference);
    await expect(orchestrator.reconcile(purchase.fulfillmentReference)).resolves.toMatchObject({state: "succeeded"});
  });

});


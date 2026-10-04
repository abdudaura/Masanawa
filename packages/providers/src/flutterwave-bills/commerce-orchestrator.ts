import {
  FlutterwaveBillProviderError,
  type FlutterwaveBillReceipt,
  type FlutterwaveCustomerValidation,
} from "./client.js";

export type BillingFulfillmentState =
  | "ready"
  | "dispatching"
  | "checking"
  | "succeeded"
  | "failed"
  | "reversed"
  | "manual_review";

export type PreparedBillPurchase = Readonly<{
  fulfillmentReference: string;
  billerCode: string;
  itemCode: string;
  itemName: string;
  customerId: string;
  customerName: string | null;
  amount: string;
  currency: "NGN";
}>;

export type BillingFulfillmentRecord = PreparedBillPurchase &
  Readonly<{
    revision: number;
    state: BillingFulfillmentState;
    providerReference: string | null;
    providerStatus: string | null;
    lastEvidenceAt: string | null;
  }>;

export interface BillingFulfillmentStore {
  createIfAbsent(
    input: BillingFulfillmentRecord,
  ): Promise<Readonly<{ record: BillingFulfillmentRecord; created: boolean }>>;
  read(reference: string): Promise<BillingFulfillmentRecord | null>;
  compareAndSet(
    expectedRevision: number,
    next: BillingFulfillmentRecord,
  ): Promise<BillingFulfillmentRecord>;
}

export interface FlutterwaveBillingPort {
  validateCustomer(
    itemCode: string,
    customer: string,
    signal?: AbortSignal,
  ): Promise<FlutterwaveCustomerValidation>;
  createPayment(input: Readonly<{
    billerCode: string;
    itemCode: string;
    customerId: string;
    amount: string;
    reference: string;
    callbackUrl?: string;
    signal?: AbortSignal;
  }>): Promise<FlutterwaveBillReceipt>;
  getStatus(
    reference: string,
    signal?: AbortSignal,
  ): Promise<FlutterwaveBillReceipt | null>;
}

export class BillingCommerceError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "BillingCommerceError";
    this.code = code;
    this.retryable = retryable;
  }
}

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") {
    throw new BillingCommerceError("invalid_input", `${label} must be text`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new BillingCommerceError("invalid_input", `${label} is invalid`);
  }
  return normalized;
}

function amount(value: string): string {
  const normalized = bounded(value, "amount", 80);
  if (!DECIMAL.test(normalized) || Number(normalized) <= 0) {
    throw new BillingCommerceError("invalid_amount", "Bill amount is invalid");
  }
  return normalized;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function sameIdentity(
  existing: BillingFulfillmentRecord,
  prepared: PreparedBillPurchase,
): boolean {
  return (
    existing.fulfillmentReference === prepared.fulfillmentReference &&
    existing.billerCode === prepared.billerCode &&
    existing.itemCode === prepared.itemCode &&
    existing.itemName === prepared.itemName &&
    existing.customerId === prepared.customerId &&
    existing.amount === prepared.amount &&
    existing.currency === prepared.currency
  );
}

function nextRecord(
  current: BillingFulfillmentRecord,
  patch: Partial<
    Pick<
      BillingFulfillmentRecord,
      "state" | "providerReference" | "providerStatus" | "lastEvidenceAt"
    >
  >,
): BillingFulfillmentRecord {
  return Object.freeze({
    ...current,
    ...patch,
    revision: current.revision + 1,
  });
}

function evaluateReceipt(
  current: BillingFulfillmentRecord,
  receipt: FlutterwaveBillReceipt,
  at: string,
): BillingFulfillmentRecord {
  if (receipt.reference !== current.fulfillmentReference) {
    return nextRecord(current, {
      state: "manual_review",
      providerReference: receipt.providerReference,
      providerStatus: receipt.status,
      lastEvidenceAt: at,
    });
  }

  const amountMatches = receipt.amount !== null && receipt.amount === current.amount;
  const customerMatches =
    receipt.customerId !== null && receipt.customerId === current.customerId;
  const currencyMatches = receipt.currency === "NGN";

  if (receipt.status === "successful") {
    return nextRecord(current, {
      state:
        amountMatches && customerMatches && currencyMatches
          ? "succeeded"
          : "manual_review",
      providerReference: receipt.providerReference,
      providerStatus: receipt.status,
      lastEvidenceAt: at,
    });
  }

  if (receipt.status === "failed") {
    return nextRecord(current, {
      state: "failed",
      providerReference: receipt.providerReference,
      providerStatus: receipt.status,
      lastEvidenceAt: at,
    });
  }

  if (receipt.status === "reversed") {
    return nextRecord(current, {
      state: "reversed",
      providerReference: receipt.providerReference,
      providerStatus: receipt.status,
      lastEvidenceAt: at,
    });
  }

  return nextRecord(current, {
    state: "checking",
    providerReference: receipt.providerReference,
    providerStatus: receipt.status,
    lastEvidenceAt: at,
  });
}

export class BillingCommerceOrchestrator {
  readonly #provider: FlutterwaveBillingPort;
  readonly #store: BillingFulfillmentStore;
  readonly #now: () => Date;

  constructor(input: Readonly<{
    provider: FlutterwaveBillingPort;
    store: BillingFulfillmentStore;
    now?: () => Date;
  }>) {
    this.#provider = input.provider;
    this.#store = input.store;
    this.#now = input.now ?? (() => new Date());
  }

  async prepare(input: Readonly<{
    fulfillmentReference: string;
    billerCode: string;
    itemCode: string;
    itemName: string;
    customerId: string;
    amount: string;
    signal?: AbortSignal;
  }>): Promise<BillingFulfillmentRecord> {
    const preparedBase = {
      fulfillmentReference: bounded(
        input.fulfillmentReference,
        "fulfillment reference",
        128,
      ),
      billerCode: bounded(input.billerCode, "biller code", 128),
      itemCode: bounded(input.itemCode, "item code", 128),
      itemName: bounded(input.itemName, "item name", 300),
      customerId: bounded(input.customerId, "customer", 200),
      amount: amount(input.amount),
      currency: "NGN" as const,
    };

    const validation = await this.#provider.validateCustomer(
      preparedBase.itemCode,
      preparedBase.customerId,
      input.signal,
    );
    if (!validation.valid) {
      throw new BillingCommerceError(
        "recipient_invalid",
        "The bill recipient could not be validated",
      );
    }
    if (
      validation.customer !== preparedBase.customerId ||
      validation.billerCode !== preparedBase.billerCode
    ) {
      throw new BillingCommerceError(
        "recipient_mismatch",
        "Provider validation did not match the selected bill",
      );
    }
    if (
      validation.minimum !== null &&
      Number(preparedBase.amount) < Number(validation.minimum)
    ) {
      throw new BillingCommerceError(
        "amount_below_minimum",
        "Bill amount is below the provider minimum",
      );
    }
    if (
      validation.maximum !== null &&
      Number(validation.maximum) > 0 &&
      Number(preparedBase.amount) > Number(validation.maximum)
    ) {
      throw new BillingCommerceError(
        "amount_above_maximum",
        "Bill amount exceeds the provider maximum",
      );
    }

    const prepared: PreparedBillPurchase = Object.freeze({
      ...preparedBase,
      customerName: validation.name,
    });
    const initial: BillingFulfillmentRecord = Object.freeze({
      ...prepared,
      revision: 1,
      state: "ready",
      providerReference: null,
      providerStatus: null,
      lastEvidenceAt: nowIso(this.#now),
    });

    const result = await this.#store.createIfAbsent(initial);
    if (!sameIdentity(result.record, prepared)) {
      throw new BillingCommerceError(
        "fulfillment_reference_conflict",
        "The fulfillment reference is already bound to different bill terms",
      );
    }
    return result.record;
  }

  async dispatch(
    reference: string,
    options?: Readonly<{ callbackUrl?: string; signal?: AbortSignal }>,
  ): Promise<BillingFulfillmentRecord> {
    const current = await this.#required(reference);

    if (
      current.state === "succeeded" ||
      current.state === "failed" ||
      current.state === "reversed" ||
      current.state === "manual_review"
    ) {
      return current;
    }
    if (current.state === "dispatching" || current.state === "checking") {
      return this.reconcile(current.fulfillmentReference, options?.signal);
    }

    const dispatching = await this.#store.compareAndSet(
      current.revision,
      nextRecord(current, {
        state: "dispatching",
        lastEvidenceAt: nowIso(this.#now),
      }),
    );

    try {
      const receipt = await this.#provider.createPayment({
        billerCode: dispatching.billerCode,
        itemCode: dispatching.itemCode,
        customerId: dispatching.customerId,
        amount: dispatching.amount,
        reference: dispatching.fulfillmentReference,
        ...(options?.callbackUrl ? { callbackUrl: options.callbackUrl } : {}),
        signal: options?.signal,
      });
      const evaluated = evaluateReceipt(
        dispatching,
        receipt,
        nowIso(this.#now),
      );
      return await this.#store.compareAndSet(dispatching.revision, evaluated);
    } catch (error) {
      if (
        error instanceof FlutterwaveBillProviderError &&
        error.outcomeUnknown
      ) {
        return await this.#store.compareAndSet(
          dispatching.revision,
          nextRecord(dispatching, {
            state: "checking",
            providerStatus: "outcome_unknown",
            lastEvidenceAt: nowIso(this.#now),
          }),
        );
      }
      try {
        await this.#store.compareAndSet(
          dispatching.revision,
          nextRecord(dispatching, {
            state: "ready",
            providerStatus:
              error instanceof FlutterwaveBillProviderError
                ? error.code
                : "dispatch_error",
            lastEvidenceAt: nowIso(this.#now),
          }),
        );
      } catch {
        // Preserve the original provider error. CAS failure means another worker
        // already advanced the same fulfillment and must be reconciled by reference.
      }
      throw error;
    }
  }

  async reconcile(
    reference: string,
    signal?: AbortSignal,
  ): Promise<BillingFulfillmentRecord> {
    const current = await this.#required(reference);
    if (
      current.state === "succeeded" ||
      current.state === "failed" ||
      current.state === "reversed" ||
      current.state === "manual_review"
    ) {
      return current;
    }

    const receipt = await this.#provider.getStatus(
      current.fulfillmentReference,
      signal,
    );
    if (receipt === null) {
      if (current.state === "checking") return current;
      return await this.#store.compareAndSet(
        current.revision,
        nextRecord(current, {
          state: "checking",
          providerStatus: "not_found_yet",
          lastEvidenceAt: nowIso(this.#now),
        }),
      );
    }

    const evaluated = evaluateReceipt(current, receipt, nowIso(this.#now));
    return await this.#store.compareAndSet(current.revision, evaluated);
  }

  async #required(reference: string): Promise<BillingFulfillmentRecord> {
    const normalized = bounded(reference, "fulfillment reference", 128);
    const record = await this.#store.read(normalized);
    if (record === null) {
      throw new BillingCommerceError(
        "fulfillment_not_found",
        "Bill fulfillment was not found",
      );
    }
    return record;
  }
}

import {
  parseCanonicalId,
  toInstant,
  type Instant,
  type LedgerEntryId,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type CryptoOperation = "deposit" | "withdraw" | "convert";
export type CryptoIntentStatus =
  | "quoted"
  | "awaiting_payment"
  | "processing"
  | "partial"
  | "succeeded"
  | "failed"
  | "refunded"
  | "expired"
  | "manual_review";

export interface CryptoIntent {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly requestId: RequestId;
  readonly operation: CryptoOperation;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly targetAsset: string | null;
  readonly destinationAddress: string | null;
  readonly provider: "nowpayments";
  readonly providerPaymentId: string | null;
  readonly providerPayoutId: string | null;
  readonly payAddress: string | null;
  readonly providerPayAmount: string | null;
  readonly status: CryptoIntentStatus;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CryptoLedgerEntry {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly ledgerEntryId: LedgerEntryId;
  readonly userId: UserId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly direction: "credit" | "debit";
  readonly reason:
    | "provider-deposit"
    | "provider-refund"
    | "withdrawal-reserve"
    | "withdrawal-release"
    | "conversion-debit"
    | "conversion-credit"
    | "adjustment";
  readonly requestId: RequestId;
  readonly providerReference: string | null;
  readonly createdAt: Instant;
}

const assetPattern = /^[A-Z0-9_-]{2,32}$/u;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u;

function bounded(value: string, code: string, max = 256): string {
  if (typeof value !== "string") throw new TypeError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(code);
  return normalized;
}

export function normalizeCryptoAsset(value: string): string {
  const normalized = bounded(value, "crypto.asset.invalid", 32).toUpperCase();
  if (!assetPattern.test(normalized)) throw new TypeError("crypto.asset.invalid");
  return normalized;
}

export function normalizeCryptoNetwork(value: string | null): string | null {
  if (value === null) return null;
  const normalized = bounded(value, "crypto.network.invalid", 64).toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/u.test(normalized)) throw new TypeError("crypto.network.invalid");
  return normalized;
}

export function normalizeCryptoAmount(value: string): string {
  const normalized = bounded(value, "crypto.amount.invalid", 80);
  if (!decimalPattern.test(normalized)) throw new TypeError("crypto.amount.invalid");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new RangeError("crypto.amount.invalid");
  return normalized.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
}

function optional(value: string | null, code: string, max = 512): string | null {
  return value === null ? null : bounded(value, code, max);
}

export function normalizeCryptoIntent(input: CryptoIntent): CryptoIntent {
  if (input.schemaVersion !== 1) throw new TypeError("crypto.intent.schema.invalid");
  const operation = input.operation;
  if (!["deposit", "withdraw", "convert"].includes(operation)) {
    throw new TypeError("crypto.intent.operation.invalid");
  }
  const status = input.status;
  if (![
    "quoted","awaiting_payment","processing","partial","succeeded",
    "failed","refunded","expired","manual_review",
  ].includes(status)) throw new TypeError("crypto.intent.status.invalid");
  const amount = normalizeCryptoAmount(input.amount);
  const destinationAddress = optional(input.destinationAddress, "crypto.destination.invalid", 512);
  if (operation === "withdraw" && destinationAddress === null) {
    throw new TypeError("crypto.withdraw.destination.required");
  }
  const targetAsset =
    input.targetAsset === null ? null : normalizeCryptoAsset(input.targetAsset);
  if (operation === "convert" && targetAsset === null) {
    throw new TypeError("crypto.convert.target.required");
  }
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError("crypto.intent.updated_before_created");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    requestId: parseCanonicalId("request", input.requestId),
    operation,
    asset: normalizeCryptoAsset(input.asset),
    network: normalizeCryptoNetwork(input.network),
    amount,
    targetAsset,
    destinationAddress,
    provider: "nowpayments",
    providerPaymentId: optional(input.providerPaymentId, "crypto.provider_payment.invalid", 128),
    providerPayoutId: optional(input.providerPayoutId, "crypto.provider_payout.invalid", 128),
    payAddress: optional(input.payAddress, "crypto.pay_address.invalid", 512),
    providerPayAmount:
      input.providerPayAmount === null ? null : normalizeCryptoAmount(input.providerPayAmount),
    status,
    createdAt,
    updatedAt,
  });
}

export function normalizeCryptoLedgerEntry(input: CryptoLedgerEntry): CryptoLedgerEntry {
  if (input.schemaVersion !== 1) throw new TypeError("crypto.ledger.schema.invalid");
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    ledgerEntryId: parseCanonicalId("ledger-entry", input.ledgerEntryId),
    userId: parseCanonicalId("user", input.userId),
    asset: normalizeCryptoAsset(input.asset),
    network: normalizeCryptoNetwork(input.network),
    amount: normalizeCryptoAmount(input.amount),
    direction: input.direction === "credit" ? "credit" : input.direction === "debit" ? "debit" : (() => { throw new TypeError("crypto.ledger.direction.invalid"); })(),
    reason: input.reason,
    requestId: parseCanonicalId("request", input.requestId),
    providerReference: optional(input.providerReference, "crypto.provider_reference.invalid", 128),
    createdAt: toInstant(input.createdAt),
  });
}


export interface CryptoProviderPaymentEvent {
  readonly paymentId: string;
  readonly parentPaymentId: string | null;
  readonly orderId: RequestId;
  readonly status:
    | "waiting"
    | "confirming"
    | "confirmed"
    | "sending"
    | "partially_paid"
    | "finished"
    | "failed"
    | "refunded"
    | "expired";
  readonly priceAmount: string;
  readonly priceCurrency: string;
  readonly payAmount: string;
  readonly payCurrency: string;
  readonly actuallyPaid: string;
  readonly payloadHash: string;
  readonly observedAt: Instant;
}

export interface CryptoIntentHistoryQuery {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly limit?: number;
}

export interface CryptoRepository {
  createIntent(input: CryptoIntent): Promise<CryptoIntent>;
  readIntent(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
  }): Promise<CryptoIntent | null>;
  listIntents(input: CryptoIntentHistoryQuery): Promise<readonly CryptoIntent[]>;
  bindProviderPayment(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly providerPaymentId: string;
    readonly payAddress: string;
    readonly providerPayAmount: string;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
  applyProviderPaymentEvent(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly event: CryptoProviderPaymentEvent;
  }): Promise<CryptoIntent>;
  readBalance(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly asset: string;
    readonly network: string | null;
  }): Promise<string>;
  reserveWithdrawal(input: CryptoIntent): Promise<CryptoIntent>;
  bindProviderPayout(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly providerPayoutId: string;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
  settleWithdrawal(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly succeeded: boolean;
    readonly providerReference: string | null;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
}

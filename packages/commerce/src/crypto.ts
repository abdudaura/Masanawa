import {
  parseCanonicalId,
  toInstant,
  type Instant,
  type LedgerEntryId,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type CryptoOperation = "deposit" | "withdraw" | "convert" | "buy";
export type CryptoWithdrawalFeePayer = "user" | "platform";
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
  /** Optional for backward-compatible callers; normalized intents always materialize null or a value. */
  readonly targetNetwork?: string | null;
  readonly destinationAddress: string | null;
  readonly provider: "nowpayments";
  readonly providerPaymentId: string | null;
  readonly providerPayoutId: string | null;
  /** Durable NOWPayments hosted invoice identity for fiat on-ramp purchases. */
  readonly providerInvoiceId?: string | null;
  /** Hosted provider checkout URL for fiat on-ramp purchases. */
  readonly checkoutUrl?: string | null;
  /** Durable NOWPayments custody conversion identity. */
  readonly providerConversionId?: string | null;
  /** Exact target crypto amount evidenced after conversion or fiat purchase settlement. */
  readonly providerTargetAmount?: string | null;
  readonly payAddress: string | null;
  readonly providerPayAmount: string | null;
  /** Live payout network fee admitted at reserve time; zero is represented as null. */
  readonly providerNetworkFee?: string | null;
  readonly withdrawalFeePayer?: CryptoWithdrawalFeePayer | null;
  readonly providerDispatchStartedAt: Instant | null;
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
    | "withdrawal-fee-reserve"
    | "withdrawal-fee-release"
    | "conversion-debit"
    | "conversion-credit"
    | "conversion-release"
    | "fiat-purchase-credit"
    | "fiat-purchase-refund"
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

export function normalizeCryptoNonNegativeAmount(value: string): string {
  if (typeof value !== "string") throw new TypeError("crypto.amount.invalid");
  const normalized = value.trim();
  if (!decimalPattern.test(normalized) || normalized.length > 80) {
    throw new TypeError("crypto.amount.invalid");
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) throw new RangeError("crypto.amount.invalid");
  return normalized.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
}

function optional(value: string | null, code: string, max = 512): string | null {
  return value === null ? null : bounded(value, code, max);
}

export function normalizeCryptoIntent(input: CryptoIntent): CryptoIntent {
  if (input.schemaVersion !== 1) throw new TypeError("crypto.intent.schema.invalid");
  const operation = input.operation;
  if (!["deposit", "withdraw", "convert", "buy"].includes(operation)) {
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
  const targetNetwork =
    input.targetNetwork === undefined || input.targetNetwork === null
      ? null
      : normalizeCryptoNetwork(input.targetNetwork);
  if ((operation === "convert" || operation === "buy") && targetAsset === null) {
    throw new TypeError(
      operation === "convert"
        ? "crypto.convert.target.required"
        : "crypto.buy.target.required",
    );
  }
  if (
    operation !== "convert" &&
    operation !== "buy" &&
    (targetAsset !== null || targetNetwork !== null)
  ) {
    throw new TypeError("crypto.target.unexpected");
  }
  if (operation === "buy" && (input.network !== null || destinationAddress !== null)) {
    throw new TypeError("crypto.buy.source_shape.invalid");
  }
  const providerInvoiceId =
    optional(input.providerInvoiceId ?? null, "crypto.provider_invoice.invalid", 128);
  const checkoutUrl =
    optional(input.checkoutUrl ?? null, "crypto.checkout_url.invalid", 2048);
  if (checkoutUrl !== null) {
    let parsedCheckout: URL;
    try {
      parsedCheckout = new URL(checkoutUrl);
    } catch {
      throw new TypeError("crypto.checkout_url.invalid");
    }
    if (parsedCheckout.protocol !== "https:") {
      throw new TypeError("crypto.checkout_url.insecure");
    }
  }
  if (
    operation !== "buy" &&
    (providerInvoiceId !== null || checkoutUrl !== null)
  ) {
    throw new TypeError("crypto.provider_invoice.unexpected");
  }
  if ((providerInvoiceId === null) !== (checkoutUrl === null)) {
    throw new TypeError("crypto.provider_invoice.incomplete");
  }
  const providerConversionId =
    optional(input.providerConversionId ?? null, "crypto.provider_conversion.invalid", 128);
  const providerTargetAmount =
    input.providerTargetAmount === undefined || input.providerTargetAmount === null
      ? null
      : normalizeCryptoAmount(input.providerTargetAmount);
  if (operation !== "convert" && providerConversionId !== null) {
    throw new TypeError("crypto.provider_conversion.unexpected");
  }
  if (
    operation !== "convert" &&
    operation !== "buy" &&
    providerTargetAmount !== null
  ) {
    throw new TypeError("crypto.provider_target_amount.unexpected");
  }
  if (
    (operation === "convert" || operation === "buy") &&
    providerTargetAmount !== null &&
    status !== "succeeded"
  ) {
    throw new TypeError("crypto.provider_target_amount.unexpected");
  }
  if (
    operation === "buy" &&
    providerTargetAmount !== null &&
    input.providerPaymentId === null
  ) {
    throw new TypeError("crypto.buy.provider_payment.required");
  }
  const providerNetworkFee =
    input.providerNetworkFee === undefined || input.providerNetworkFee === null
      ? null
      : normalizeCryptoNonNegativeAmount(input.providerNetworkFee);
  const withdrawalFeePayer = input.withdrawalFeePayer ?? null;
  if (
    withdrawalFeePayer !== null &&
    withdrawalFeePayer !== "user" &&
    withdrawalFeePayer !== "platform"
  ) {
    throw new TypeError("crypto.withdrawal_fee_payer.invalid");
  }
  if (
    operation !== "withdraw" &&
    (providerNetworkFee !== null || withdrawalFeePayer !== null)
  ) {
    throw new TypeError("crypto.withdrawal_fee.unexpected");
  }
  if ((providerNetworkFee === null) !== (withdrawalFeePayer === null)) {
    throw new TypeError("crypto.withdrawal_fee.incomplete");
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
    targetNetwork,
    destinationAddress,
    provider: "nowpayments",
    providerPaymentId: optional(input.providerPaymentId, "crypto.provider_payment.invalid", 128),
    providerPayoutId: optional(input.providerPayoutId, "crypto.provider_payout.invalid", 128),
    providerInvoiceId,
    checkoutUrl,
    providerConversionId,
    providerTargetAmount,
    payAddress: optional(input.payAddress, "crypto.pay_address.invalid", 512),
    providerPayAmount:
      input.providerPayAmount === null ? null : normalizeCryptoAmount(input.providerPayAmount),
    providerNetworkFee,
    withdrawalFeePayer,
    providerDispatchStartedAt:
      input.providerDispatchStartedAt === null ? null : toInstant(input.providerDispatchStartedAt),
    status,
    createdAt,
    updatedAt,
  });
}

/**
 * Crypto ledger reasons are an accounting boundary, not free-form provider text.
 * Keep this exhaustive mapping in sync with the canonical reason union.
 */
const cryptoLedgerReasonDirections: Readonly<
  Record<CryptoLedgerEntry["reason"], "credit" | "debit" | "either">
> = Object.freeze({
  "provider-deposit": "credit",
  "provider-refund": "debit",
  "withdrawal-reserve": "debit",
  "withdrawal-release": "credit",
  "withdrawal-fee-reserve": "debit",
  "withdrawal-fee-release": "credit",
  "conversion-debit": "debit",
  "conversion-credit": "credit",
  "conversion-release": "credit",
  "fiat-purchase-credit": "credit",
  "fiat-purchase-refund": "debit",
  "adjustment": "either",
});

export function normalizeCryptoLedgerEntry(input: CryptoLedgerEntry): CryptoLedgerEntry {
  if (input.schemaVersion !== 1) throw new TypeError("crypto.ledger.schema.invalid");
  const direction = input.direction;
  if (direction !== "credit" && direction !== "debit") {
    throw new TypeError("crypto.ledger.direction.invalid");
  }
  const reason = input.reason;
  if (!Object.prototype.hasOwnProperty.call(cryptoLedgerReasonDirections, reason)) {
    throw new TypeError("crypto.ledger.reason.invalid");
  }
  const expectedDirection = cryptoLedgerReasonDirections[reason];
  if (expectedDirection !== "either" && expectedDirection !== direction) {
    throw new TypeError("crypto.ledger.reason_direction.invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    ledgerEntryId: parseCanonicalId("ledger-entry", input.ledgerEntryId),
    userId: parseCanonicalId("user", input.userId),
    asset: normalizeCryptoAsset(input.asset),
    network: normalizeCryptoNetwork(input.network),
    amount: normalizeCryptoAmount(input.amount),
    direction,
    reason,
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
  readonly invoiceId?: string | null;
  readonly outcomeAmount?: string | null;
  readonly outcomeCurrency?: string | null;
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
  readIntentByRequestId(input: {
    readonly tenantId: TenantId;
    readonly requestId: RequestId;
  }): Promise<CryptoIntent | null>;
  readIntentByProviderPayoutId(input: {
    readonly providerPayoutId: string;
  }): Promise<CryptoIntent | null>;
  listIntents(input: CryptoIntentHistoryQuery): Promise<readonly CryptoIntent[]>;
  beginProviderDispatch(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly updatedAt: Instant;
  }): Promise<{ readonly intent: CryptoIntent; readonly shouldDispatch: boolean }>;
  failProviderDispatch(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly operation: CryptoOperation;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
  bindProviderInvoice(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly providerInvoiceId: string;
    readonly checkoutUrl: string;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
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
  reserveWithdrawalWithFee(input: {
    readonly intent: CryptoIntent;
    readonly networkFee: string;
    readonly feePayer: CryptoWithdrawalFeePayer;
  }): Promise<CryptoIntent>;
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
  reserveConversion(input: CryptoIntent): Promise<CryptoIntent>;
  bindProviderConversion(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly providerConversionId: string;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
  settleConversion(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
    readonly succeeded: boolean;
    readonly targetAmount: string | null;
    readonly providerReference: string | null;
    readonly updatedAt: Instant;
  }): Promise<CryptoIntent>;
  readAggregateLiability(input: {
    readonly tenantId: TenantId;
    readonly asset: string;
    readonly network: string | null;
  }): Promise<string>;
  /**
   * Aggregate all positive user liabilities across every Masanawa tenant
   * backed by the shared provider custody account.
   */
  readPlatformAggregateLiability(input: {
    readonly asset: string;
    readonly network: string | null;
  }): Promise<string>;
}

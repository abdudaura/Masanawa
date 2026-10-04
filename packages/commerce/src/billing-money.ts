import { createCanonicalId, type QuoteId, type TenantId, type UserId } from "@masanawa/contracts";
import type { BillingFundingAuthority } from "./billing-funding.js";

export type BillingQuoteState =
  | "quoted" | "confirmed" | "checkout-created" | "funded" | "reserved"
  | "succeeded" | "refund-pending" | "refunded" | "expired";

export interface BillingQuote {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly quoteId: QuoteId;
  readonly revision: number;
  readonly categoryCode: string | null;
  readonly billerCode: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly customerId: string;
  readonly serviceAmountKobo: number;
  readonly feeAmountKobo: number;
  readonly totalAmountKobo: number;
  readonly currency: "NGN";
  readonly state: BillingQuoteState;
  readonly confirmedAt: string | null;
  readonly expiresAt: string;
  readonly checkoutTxRef: string | null;
  readonly checkoutUrl: string | null;
  readonly providerTransactionId: string | null;
  readonly providerReference: string | null;
  /** Flutterwave bill-payment provider reference; kept separate from funding evidence. */
  readonly billProviderReference: string | null;
  readonly paymentVerifiedAt: string | null;
  readonly fulfillmentReference: string | null;
  readonly settlementState: "succeeded" | "failed" | "reversed" | null;
  readonly refundReference: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BillingQuoteRepository extends BillingFundingAuthority {
  createQuote(input: BillingQuote): Promise<BillingQuote>;
  readQuote(input: Readonly<{ tenantId: TenantId; userId: UserId; quoteId: QuoteId }>): Promise<BillingQuote | null>;
  listQuotes(input: Readonly<{ tenantId: TenantId; userId: UserId; limit: number }>): Promise<readonly BillingQuote[]>;
  confirmQuote(input: Readonly<{
    tenantId: TenantId; userId: UserId; quoteId: QuoteId; quoteRevision: number; confirmedAt: string;
  }>): Promise<BillingQuote>;
  bindCheckout(input: Readonly<{
    tenantId: TenantId; userId: UserId; quoteId: QuoteId; quoteRevision: number;
    txRef: string; checkoutUrl: string; boundAt: string;
  }>): Promise<BillingQuote>;
  recordVerifiedPayment(input: Readonly<{
    tenantId: TenantId; userId: UserId; quoteId: QuoteId; quoteRevision: number;
    txRef: string; providerTransactionId: string; providerReference: string | null;
    amountKobo: number; currency: "NGN"; verifiedAt: string;
  }>): Promise<BillingQuote>;
  markRefunded(input: Readonly<{
    tenantId: TenantId; userId: UserId; quoteId: QuoteId; providerTransactionId: string;
    refundReference: string; refundedAt: string;
  }>): Promise<BillingQuote>;
}

function bounded(value: string, label: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) throw new TypeError(`${label} is invalid`);
  return normalized;
}
function instant(value: string, label: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new TypeError(`${label} is invalid`);
  return new Date(ms).toISOString();
}

export function parseNgnKobo(value: string): number {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(value.trim());
  if (!match) throw new TypeError("NGN amount is invalid");
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(amount)) throw new RangeError("NGN amount exceeds safe range");
  return amount;
}
export function formatNgnKobo(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("NGN kobo amount is invalid");
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, "0");
  return fraction === "00" ? String(whole) : `${whole}.${fraction}`;
}
export function calculateBillingFeeKobo(
  serviceAmountKobo: number,
  policy: Readonly<{ basisPoints: number; fixedKobo: number }>,
): number {
  if (!Number.isSafeInteger(serviceAmountKobo) || serviceAmountKobo <= 0) throw new TypeError("Billing service amount is invalid");
  if (!Number.isSafeInteger(policy.basisPoints) || policy.basisPoints < 0 || policy.basisPoints > 10_000) throw new TypeError("Billing fee basis points are invalid");
  if (!Number.isSafeInteger(policy.fixedKobo) || policy.fixedKobo < 0) throw new TypeError("Billing fixed fee is invalid");
  const fee = Math.ceil((serviceAmountKobo * policy.basisPoints) / 10_000) + policy.fixedKobo;
  if (!Number.isSafeInteger(fee)) throw new RangeError("Billing fee exceeds safe range");
  return fee;
}
export function createBillingQuote(input: Readonly<{
  tenantId: TenantId; userId: UserId; categoryCode?: string | null; billerCode: string;
  itemCode: string; itemName: string; customerId: string; serviceAmountKobo: number;
  feeAmountKobo: number; createdAt: string; expiresAt: string; quoteId?: QuoteId;
}>): BillingQuote {
  if (!Number.isSafeInteger(input.serviceAmountKobo) || input.serviceAmountKobo <= 0) throw new TypeError("Billing service amount is invalid");
  if (!Number.isSafeInteger(input.feeAmountKobo) || input.feeAmountKobo < 0) throw new TypeError("Billing fee is invalid");
  const totalAmountKobo = input.serviceAmountKobo + input.feeAmountKobo;
  if (!Number.isSafeInteger(totalAmountKobo)) throw new RangeError("Billing total exceeds safe range");
  const createdAt = instant(input.createdAt, "createdAt");
  const expiresAt = instant(input.expiresAt, "expiresAt");
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) throw new RangeError("Billing quote expiry is invalid");
  return Object.freeze({
    schemaVersion: 1 as const, tenantId: input.tenantId, userId: input.userId,
    quoteId: input.quoteId ?? createCanonicalId("quote"), revision: 1,
    categoryCode: input.categoryCode ? bounded(input.categoryCode, "categoryCode", 128) : null,
    billerCode: bounded(input.billerCode, "billerCode", 128),
    itemCode: bounded(input.itemCode, "itemCode", 128),
    itemName: bounded(input.itemName, "itemName", 300),
    customerId: bounded(input.customerId, "customerId", 200),
    serviceAmountKobo: input.serviceAmountKobo, feeAmountKobo: input.feeAmountKobo,
    totalAmountKobo, currency: "NGN" as const, state: "quoted" as const,
    confirmedAt: null, expiresAt, checkoutTxRef: null, checkoutUrl: null,
    providerTransactionId: null, providerReference: null, billProviderReference: null, paymentVerifiedAt: null,
    fulfillmentReference: null, settlementState: null, refundReference: null,
    createdAt, updatedAt: createdAt,
  });
}

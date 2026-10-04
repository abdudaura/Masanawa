import { createHash } from "node:crypto";
import { canonicalizeIpnPayload, verifyIpnSignature } from "@masanawa/nowpayments";

const statuses = new Set([
  "new", "creating", "waiting", "processing", "sending", "finished",
  "failed", "rejected", "rejected_not_checked", "cancelled", "canceled",
]);

export interface PayoutBindingEvidence {
  readonly batchId: string;
  readonly currency: string;
  readonly amount: string;
  readonly address: string;
  readonly uniqueExternalId: string;
}

export interface FinancialPayoutEvidence extends PayoutBindingEvidence {
  readonly withdrawalId: string;
  readonly status: string;
  readonly payloadHash: string;
}

function identity(value: unknown, code: string, max = 256): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(code);
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!text || text.length > max || !/^[A-Za-z0-9_.-]+$/u.test(text)) throw new Error(code);
  return text;
}

function amount(value: unknown): string {
  const text =
    typeof value === "string" ? value.trim() :
    typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(text)) {
    throw new Error("financial.crypto.payout_evidence_invalid");
  }
  const normalized = text.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0") throw new Error("financial.crypto.payout_evidence_invalid");
  return normalized;
}

function currency(value: unknown): string {
  if (typeof value !== "string") throw new Error("financial.crypto.payout_evidence_invalid");
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new Error("financial.crypto.payout_evidence_invalid");
  }
  return normalized;
}

function address(value: unknown): string {
  if (typeof value !== "string") throw new Error("financial.crypto.payout_evidence_invalid");
  const normalized = value.trim();
  if (!normalized || normalized.length > 512) throw new Error("financial.crypto.payout_evidence_invalid");
  return normalized;
}

export function parseVerifiedPayoutIpn(input: {
  readonly payload: unknown;
  readonly signature: string;
  readonly secret: string;
}): FinancialPayoutEvidence {
  if (!verifyIpnSignature(input)) throw new Error("nowpayments.ipn.signature.invalid");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new Error("financial.crypto.payout_evidence_invalid");
  }
  const payload = input.payload as Record<string, unknown>;
  const rawStatus = payload.payout_status ?? payload.status;
  if (typeof rawStatus !== "string" || !statuses.has(rawStatus.trim().toLowerCase())) {
    throw new Error("financial.crypto.payout_evidence_invalid");
  }
  const canonical = canonicalizeIpnPayload(payload);
  return Object.freeze({
    batchId: identity(
      payload.batch_withdrawal_id ?? payload.batch_id,
      "financial.crypto.payout_evidence_invalid",
      128,
    ),
    withdrawalId: identity(
      payload.id ?? payload.payout_id,
      "financial.crypto.payout_evidence_invalid",
      128,
    ),
    status: rawStatus.trim().toLowerCase(),
    currency: currency(payload.currency),
    amount: amount(payload.amount),
    address: address(payload.address),
    uniqueExternalId: identity(
      payload.unique_external_id,
      "financial.crypto.payout_evidence_invalid",
      256,
    ),
    payloadHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
  });
}

export function assertPayoutEvidence(
  evidence: PayoutBindingEvidence,
  expected: {
    readonly batchId: string;
    readonly currency: string;
    readonly amount: string;
    readonly address: string;
    readonly uniqueExternalId: string;
  },
): void {
  if (
    evidence.batchId !== expected.batchId ||
    evidence.currency !== expected.currency.trim().toUpperCase() ||
    evidence.amount !== amount(expected.amount) ||
    evidence.address !== expected.address.trim() ||
    evidence.uniqueExternalId !== expected.uniqueExternalId
  ) {
    throw new Error("financial.crypto.payout_evidence_mismatch");
  }
}

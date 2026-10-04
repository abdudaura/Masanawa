import { createHash } from "node:crypto";

const statuses = ["waiting", "confirming", "confirmed", "sending", "partially_paid", "finished", "failed", "refunded", "expired"] as const;
type PaymentStatus = typeof statuses[number];
function amount(value: unknown, allowZero = false): string {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text) || text.length > 80) throw new Error("financial.crypto.evidence_invalid");
  const normalized = text.replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
  if (!allowZero && normalized === "0") throw new Error("financial.crypto.evidence_invalid");
  return normalized;
}
function identity(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error("financial.crypto.evidence_invalid");
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!/^[A-Za-z0-9_.-]{1,256}$/.test(text)) throw new Error("financial.crypto.evidence_invalid");
  return text;
}
function currency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{2,32}$/.test(value)) throw new Error("financial.crypto.evidence_invalid");
  return value.toUpperCase();
}
function amountUnits(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(18, "0"));
}

/** Only authenticated provider responses, bound to the exact stored deposit, enter this parser. */
export function admitPaymentEvidence(payload: unknown, expected: {
  readonly paymentId: string;
  readonly orderId: string;
  readonly asset: string;
  readonly amount: string;
  readonly payAmount?: string | null;
}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("financial.crypto.evidence_invalid");
  const p = payload as Record<string, unknown>;
  const paymentId = identity(p.payment_id), orderId = identity(p.order_id);
  const priceAmount = amount(p.price_amount);
  const priceCurrency = currency(p.price_currency);
  const payCurrency = currency(p.pay_currency);
  const payAmount = amount(p.pay_amount);
  const expectedPayAmount = amount(expected.payAmount ?? expected.amount);
  if (paymentId !== expected.paymentId || orderId !== expected.orderId ||
      priceCurrency !== expected.asset || payCurrency !== expected.asset ||
      priceAmount !== expected.amount || payAmount !== expectedPayAmount) {
    throw new Error("financial.crypto.evidence_mismatch");
  }
  if (typeof p.payment_status !== "string" || !statuses.includes(p.payment_status as PaymentStatus)) throw new Error("financial.crypto.evidence_invalid");
  const status = p.payment_status as PaymentStatus;
  const actuallyPaid = amount(p.actually_paid, true);
  if (status === "finished" && amountUnits(actuallyPaid) < amountUnits(expectedPayAmount)) {
    throw new Error("financial.crypto.evidence_mismatch");
  }
  const evidence = {
    paymentId, parentPaymentId: p.parent_payment_id == null ? null : identity(p.parent_payment_id),
    status, priceAmount, priceCurrency, payAmount, payCurrency, actuallyPaid,
  };
  return Object.freeze({ ...evidence,
    payloadHash: createHash("sha256").update(JSON.stringify({ ...evidence, orderId })).digest("hex"),
  });
}

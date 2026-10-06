import { createHash } from "node:crypto";

const statuses = [
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "finished",
  "failed",
  "refunded",
  "expired",
] as const;

type Status = typeof statuses[number];

function identity(value: unknown, code: string, max = 256): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(code);
  }
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  if (!text || text.length > max || !/^[A-Za-z0-9_.-]+$/u.test(text)) {
    throw new Error(code);
  }
  return text;
}

function optionalIdentity(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return identity(value, "financial.crypto.onramp_evidence_invalid");
}

function decimal(
  value: unknown,
  options: { readonly allowZero?: boolean; readonly maxDecimals?: number } = {},
): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  const maxDecimals = options.maxDecimals ?? 18;
  const match = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/u.exec(text);
  if (!match || text.length > 80 || (match[1]?.length ?? 0) > maxDecimals) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  const normalized = text
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0" && options.allowZero !== true) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  return normalized;
}

function currency(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  return normalized;
}

export interface FiatOnRampPaymentEvidence {
  readonly paymentId: string;
  readonly invoiceId: string;
  readonly parentPaymentId: string | null;
  readonly orderId: string;
  readonly status: Status;
  readonly priceAmount: string;
  readonly priceCurrency: string;
  readonly payAmount: string;
  readonly payCurrency: string;
  readonly actuallyPaid: string;
  readonly outcomeAmount: string | null;
  readonly outcomeCurrency: string | null;
  readonly payloadHash: string;
}

export function admitFiatOnRampEvidence(
  payload: unknown,
  expected: {
    readonly invoiceId: string;
    readonly orderId: string;
    readonly fiatAmount: string;
    readonly fiatCurrency: string;
    readonly settlementAsset: string;
  },
): FiatOnRampPaymentEvidence {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  const p = payload as Record<string, unknown>;
  const paymentId = identity(
    p.payment_id,
    "financial.crypto.onramp_evidence_invalid",
    128,
  );
  const invoiceId = identity(
    p.invoice_id,
    "financial.crypto.onramp_evidence_invalid",
    128,
  );
  const orderId = identity(
    p.order_id,
    "financial.crypto.onramp_evidence_invalid",
    256,
  );
  const rawStatus = p.payment_status;
  if (
    typeof rawStatus !== "string" ||
    !statuses.includes(rawStatus as Status)
  ) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  const status = rawStatus as Status;
  const priceAmount = decimal(p.price_amount, { maxDecimals: 2 });
  const priceCurrency = currency(p.price_currency);
  const payAmount = decimal(p.pay_amount, {
    allowZero: status !== "finished",
    maxDecimals: 18,
  });
  const payCurrency = currency(p.pay_currency);
  const actuallyPaid = decimal(p.actually_paid, {
    allowZero: status !== "finished",
    maxDecimals: 18,
  });
  const outcomeAmount =
    p.outcome_amount === undefined ||
    p.outcome_amount === null ||
    p.outcome_amount === ""
      ? null
      : decimal(p.outcome_amount, { maxDecimals: 18 });
  const outcomeCurrency =
    p.outcome_currency === undefined ||
    p.outcome_currency === null ||
    p.outcome_currency === ""
      ? null
      : currency(p.outcome_currency);

  if (
    invoiceId !== expected.invoiceId ||
    orderId !== expected.orderId ||
    priceAmount !== decimal(expected.fiatAmount, { maxDecimals: 2 }) ||
    priceCurrency !== currency(expected.fiatCurrency) ||
    payCurrency !== currency(expected.fiatCurrency)
  ) {
    throw new Error("financial.crypto.onramp_evidence_mismatch");
  }
  if (
    status === "finished" &&
    (
      outcomeAmount === null ||
      outcomeCurrency !== currency(expected.settlementAsset)
    )
  ) {
    throw new Error("financial.crypto.onramp_evidence_mismatch");
  }

  const evidence = {
    paymentId,
    invoiceId,
    parentPaymentId: optionalIdentity(p.parent_payment_id),
    orderId,
    status,
    priceAmount,
    priceCurrency,
    payAmount,
    payCurrency,
    actuallyPaid,
    outcomeAmount,
    outcomeCurrency,
  };
  return Object.freeze({
    ...evidence,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(evidence))
      .digest("hex"),
  });
}

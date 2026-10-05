import { parsePaymentStatus, type NowPaymentsPaymentStatus } from "./status.js";

export interface CreateNowPaymentsPaymentInput {
  readonly priceAmount: number;
  readonly priceCurrency: string;
  readonly payCurrency: string;
  readonly ipnCallbackUrl: string;
  readonly orderId: string;
  readonly orderDescription?: string;
}

export interface NowPaymentsCreatedPayment {
  readonly paymentId: string;
  readonly purchaseId: string | null;
  readonly status: NowPaymentsPaymentStatus;
  readonly payAddress: string;
  readonly priceAmount: number;
  readonly priceAmountExact: string;
  readonly priceCurrency: string;
  readonly payAmount: number;
  readonly payAmountExact: string;
  readonly payCurrency: string;
  readonly orderId: string | null;
}

function boundedString(value: unknown, code: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) throw new Error(code);
  return normalized;
}

function currency(value: unknown): string {
  const normalized = boundedString(value, "nowpayments.currency.invalid", 32).toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(normalized)) throw new Error("nowpayments.currency.invalid");
  return normalized;
}

function numberToPlainDecimal(value: number, code: string): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
  const text = String(value);
  if (!/[eE]/u.test(text)) return text;
  const match = /^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(text);
  if (!match) throw new Error(code);
  const integer = match[1] ?? "";
  const fraction = match[2] ?? "";
  const exponent = Number(match[3]);
  if (!Number.isSafeInteger(exponent)) throw new Error(code);
  const digits = integer + fraction;
  const decimalAt = integer.length + exponent;
  if (decimalAt <= 0) return "0." + "0".repeat(-decimalAt) + digits;
  if (decimalAt >= digits.length) return digits + "0".repeat(decimalAt - digits.length);
  return digits.slice(0, decimalAt) + "." + digits.slice(decimalAt);
}

function positiveAmountExact(value: unknown, code: string): string {
  const text =
    typeof value === "string" ? value.trim() :
    typeof value === "number" ? numberToPlainDecimal(value, code) : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(text)) throw new Error(code);
  const normalized = text.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0") throw new Error(code);
  return normalized;
}

function positiveAmount(value: unknown, code: string): number {
  const exact = positiveAmountExact(value, code);
  const numeric = Number(exact);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(code);
  return numeric;
}

export function normalizeCreatePaymentInput(
  input: CreateNowPaymentsPaymentInput,
): Readonly<Record<string, string | number>> {
  if (!Number.isFinite(input.priceAmount) || input.priceAmount <= 0) {
    throw new Error("nowpayments.amount.invalid");
  }

  let callback: URL;
  try {
    callback = new URL(input.ipnCallbackUrl);
  } catch {
    throw new Error("nowpayments.ipn_callback.invalid");
  }
  if (callback.protocol !== "https:") throw new Error("nowpayments.ipn_callback.insecure");
  if (callback.username !== "" || callback.password !== "") {
    throw new Error("nowpayments.ipn_callback.credentials_forbidden");
  }

  const orderId = boundedString(input.orderId, "nowpayments.order_id.invalid", 128);
  if (!/^[A-Za-z0-9_.:-]+$/.test(orderId)) throw new Error("nowpayments.order_id.invalid");

  const request: Record<string, string | number> = {
    price_amount: input.priceAmount,
    price_currency: currency(input.priceCurrency).toLowerCase(),
    pay_currency: currency(input.payCurrency).toLowerCase(),
    ipn_callback_url: callback.toString(),
    order_id: orderId,
  };

  if (input.orderDescription !== undefined) {
    request.order_description = boundedString(
      input.orderDescription,
      "nowpayments.order_description.invalid",
      256,
    );
  }

  return Object.freeze(request);
}

export function parseCreatedPayment(body: unknown): NowPaymentsCreatedPayment {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("nowpayments.payment.invalid_response");
  }
  const record = body as Record<string, unknown>;
  const paymentId = String(record.payment_id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) {
    throw new Error("nowpayments.payment.invalid_response");
  }

  const purchaseValue = record.purchase_id;
  const purchaseId =
    purchaseValue === undefined || purchaseValue === null || purchaseValue === ""
      ? null
      : String(purchaseValue).trim();
  if (purchaseId !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(purchaseId)) {
    throw new Error("nowpayments.payment.invalid_response");
  }

  const orderValue = record.order_id;
  const orderId =
    orderValue === undefined || orderValue === null || orderValue === ""
      ? null
      : boundedString(orderValue, "nowpayments.payment.invalid_response", 128);

  const priceAmountExact = positiveAmountExact(
    record.price_amount,
    "nowpayments.payment.invalid_response",
  );
  const payAmountExact = positiveAmountExact(
    record.pay_amount,
    "nowpayments.payment.invalid_response",
  );
  return Object.freeze({
    paymentId,
    purchaseId,
    status: parsePaymentStatus(record.payment_status),
    payAddress: boundedString(record.pay_address, "nowpayments.payment.invalid_response", 512),
    priceAmount: positiveAmount(priceAmountExact, "nowpayments.payment.invalid_response"),
    priceAmountExact,
    priceCurrency: currency(record.price_currency),
    payAmount: positiveAmount(payAmountExact, "nowpayments.payment.invalid_response"),
    payAmountExact,
    payCurrency: currency(record.pay_currency),
    orderId,
  });
}

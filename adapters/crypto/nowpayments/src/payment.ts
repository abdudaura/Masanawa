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
  readonly priceCurrency: string;
  readonly payAmount: number;
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

function positiveAmount(value: unknown, code: string): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(code);
  return amount;
}

export function normalizeCreatePaymentInput(
  input: CreateNowPaymentsPaymentInput,
): Readonly<Record<string, string | number>> {
  if (!Number.isFinite(input.priceAmount) || input.priceAmount <= 0) {
    throw new Error("nowpayments.amount.invalid");
  }

  const callback = new URL(input.ipnCallbackUrl);
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

  return Object.freeze({
    paymentId,
    purchaseId,
    status: parsePaymentStatus(record.payment_status),
    payAddress: boundedString(record.pay_address, "nowpayments.payment.invalid_response", 512),
    priceAmount: positiveAmount(record.price_amount, "nowpayments.payment.invalid_response"),
    priceCurrency: currency(record.price_currency),
    payAmount: positiveAmount(record.pay_amount, "nowpayments.payment.invalid_response"),
    payCurrency: currency(record.pay_currency),
    orderId,
  });
}

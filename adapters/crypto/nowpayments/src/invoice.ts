export interface CreateNowPaymentsInvoiceInput {
  readonly priceAmount: string;
  readonly priceCurrency: string;
  /**
   * For NOWPayments fiat on-ramp this is the fiat currency the customer pays.
   * The crypto settlement currency is merchant-account configured and is
   * verified later from outcome_currency before Masanawa credits the user.
   */
  readonly payCurrency: string;
  readonly ipnCallbackUrl: string;
  readonly orderId: string;
  readonly orderDescription?: string;
  readonly signal?: AbortSignal;
}

export interface NowPaymentsCreatedInvoice {
  readonly invoiceId: string;
  readonly checkoutUrl: string;
  readonly orderId: string;
  readonly priceAmount: string;
  readonly priceCurrency: string;
  readonly payCurrency: string;
}

function bounded(value: unknown, code: string, max: number): string {
  if (typeof value !== "string") throw new Error(code);
  const text = value.trim();
  if (!text || text.length > max) throw new Error(code);
  return text;
}

function currency(value: unknown): string {
  const text = bounded(value, "nowpayments.invoice.currency.invalid", 32).toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(text)) {
    throw new Error("nowpayments.invoice.currency.invalid");
  }
  return text;
}

function exactAmount(value: unknown): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(text) || text.length > 32) {
    throw new Error("nowpayments.invoice.amount.invalid");
  }
  const normalized = text
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0") throw new Error("nowpayments.invoice.amount.invalid");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0 || String(numeric) !== normalized) {
    throw new Error("nowpayments.invoice.amount.invalid");
  }
  return normalized;
}

function secureUrl(value: unknown, code: string): string {
  const text = bounded(value, code, 2048);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(code);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error(code);
  }
  return parsed.toString();
}

export function normalizeCreateInvoiceInput(
  input: CreateNowPaymentsInvoiceInput,
): Readonly<Record<string, string | number>> {
  const priceAmount = exactAmount(input.priceAmount);
  const callback = secureUrl(
    input.ipnCallbackUrl,
    "nowpayments.invoice.ipn_callback.invalid",
  );
  const orderId = bounded(input.orderId, "nowpayments.invoice.order_id.invalid", 128);
  if (!/^[A-Za-z0-9_.:-]+$/u.test(orderId)) {
    throw new Error("nowpayments.invoice.order_id.invalid");
  }
  const body: Record<string, string | number> = {
    price_amount: Number(priceAmount),
    price_currency: currency(input.priceCurrency).toLowerCase(),
    pay_currency: currency(input.payCurrency).toLowerCase(),
    ipn_callback_url: callback,
    order_id: orderId,
  };
  if (input.orderDescription !== undefined) {
    body.order_description = bounded(
      input.orderDescription,
      "nowpayments.invoice.order_description.invalid",
      256,
    );
  }
  return Object.freeze(body);
}

export function parseCreatedInvoice(
  body: unknown,
  expected: {
    readonly orderId: string;
    readonly priceAmount: string;
    readonly priceCurrency: string;
    readonly payCurrency: string;
  },
): NowPaymentsCreatedInvoice {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("nowpayments.invoice.invalid_response");
  }
  const record = body as Record<string, unknown>;
  const invoiceId = String(record.id ?? record.invoice_id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(invoiceId)) {
    throw new Error("nowpayments.invoice.invalid_response");
  }
  const checkoutUrl = secureUrl(
    record.invoice_url,
    "nowpayments.invoice.invalid_response",
  );
  const orderId = bounded(
    record.order_id,
    "nowpayments.invoice.invalid_response",
    128,
  );
  const priceAmount = exactAmount(record.price_amount);
  const priceCurrency = currency(record.price_currency);
  const payCurrency = currency(record.pay_currency);
  if (
    orderId !== expected.orderId ||
    priceAmount !== exactAmount(expected.priceAmount) ||
    priceCurrency !== currency(expected.priceCurrency) ||
    payCurrency !== currency(expected.payCurrency)
  ) {
    throw new Error("nowpayments.invoice.evidence_mismatch");
  }
  return Object.freeze({
    invoiceId,
    checkoutUrl,
    orderId,
    priceAmount,
    priceCurrency,
    payCurrency,
  });
}

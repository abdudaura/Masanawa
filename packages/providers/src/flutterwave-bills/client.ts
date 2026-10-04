export type FlutterwaveBillCategory = Readonly<{
  code: string;
  name: string;
  description: string | null;
  country: "NG";
}>;

export type FlutterwaveBiller = Readonly<{
  billerCode: string;
  name: string;
}>;

export type FlutterwaveBillItem = Readonly<{
  billerCode: string;
  itemCode: string;
  name: string;
  amount: string;
  currency: "NGN";
  labelName: string | null;
}>;

export type FlutterwaveCustomerValidation = Readonly<{
  valid: boolean;
  responseCode: string;
  responseMessage: string;
  customer: string;
  name: string | null;
  billerCode: string;
  productCode: string | null;
  minimum: string | null;
  maximum: string | null;
}>;

export type FlutterwaveBillStatus =
  | "pending"
  | "successful"
  | "failed"
  | "reversed"
  | "unknown";

export type FlutterwaveBillReceipt = Readonly<{
  reference: string;
  providerReference: string | null;
  status: FlutterwaveBillStatus;
  amount: string | null;
  currency: "NGN" | null;
  customerId: string | null;
  product: string | null;
  productName: string | null;
  extra: unknown;
}>;

export class FlutterwaveBillProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;

  constructor(code: string, message: string, options?: {
    readonly retryable?: boolean;
    readonly outcomeUnknown?: boolean;
  }) {
    super(message);
    this.name = "FlutterwaveBillProviderError";
    this.code = code;
    this.retryable = options?.retryable === true;
    this.outcomeUnknown = options?.outcomeUnknown === true;
  }
}

export interface FlutterwaveBillsTransport {
  request(input: Readonly<{
    method: "GET" | "POST";
    path: string;
    query?: Readonly<Record<string, string>>;
    body?: unknown;
    headers: Readonly<Record<string, string>>;
    signal?: AbortSignal;
  }>): Promise<Readonly<{ status: number; body: unknown }>>;
}

export interface FlutterwaveBillsClientOptions {
  readonly secretKey: string;
  readonly transport: FlutterwaveBillsTransport;
  readonly country?: "NG";
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FlutterwaveBillProviderError("invalid_response", `Flutterwave ${label} response is invalid`);
  }
  return value as JsonRecord;
}

function textValue(value: unknown, label: string, max = 300): string {
  if (typeof value !== "string") {
    throw new FlutterwaveBillProviderError("invalid_response", `Flutterwave ${label} is invalid`);
  }
  const valueTrimmed = value.trim();
  if (valueTrimmed.length < 1 || valueTrimmed.length > max) {
    throw new FlutterwaveBillProviderError("invalid_response", `Flutterwave ${label} is invalid`);
  }
  return valueTrimmed;
}

function optionalText(value: unknown, label: string, max = 300): string | null {
  if (value === null || value === undefined || value === "") return null;
  return textValue(value, label, max);
}

function decimal(value: unknown, label: string): string {
  const candidate = typeof value === "number" ? String(value) : textValue(value, label, 80);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(candidate)) {
    throw new FlutterwaveBillProviderError("invalid_response", `Flutterwave ${label} is invalid`);
  }
  return candidate;
}

function optionalDecimal(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return decimal(value, label);
}

function dataArray(body: unknown): unknown[] {
  const envelope = record(body, "envelope");
  if (envelope.status !== "success" || !Array.isArray(envelope.data)) {
    throw new FlutterwaveBillProviderError("provider_rejected", "Flutterwave did not return a successful bill catalog response");
  }
  return envelope.data;
}

function successfulData(body: unknown): JsonRecord {
  const envelope = record(body, "envelope");
  if (envelope.status !== "success") {
    throw new FlutterwaveBillProviderError("provider_rejected", "Flutterwave rejected the bill request");
  }
  return record(envelope.data, "data");
}

function mapStatus(value: unknown): FlutterwaveBillStatus {
  if (typeof value !== "string") return "unknown";
  switch (value.trim().toLowerCase()) {
    case "success":
    case "successful":
    case "completed":
      return "successful";
    case "failed":
    case "fail":
      return "failed";
    case "reversed":
      return "reversed";
    case "pending":
    case "processing":
      return "pending";
    default:
      return "unknown";
  }
}

function encodeSegment(value: string, label: string): string {
  const normalized = textValue(value, label, 128);
  return encodeURIComponent(normalized);
}

export class FlutterwaveBillsClient {
  readonly #secretKey: string;
  readonly #transport: FlutterwaveBillsTransport;
  readonly #country: "NG";

  constructor(options: FlutterwaveBillsClientOptions) {
    this.#secretKey = textValue(options.secretKey, "secret key", 512);
    this.#transport = options.transport;
    this.#country = options.country ?? "NG";
    if (this.#country !== "NG") {
      throw new FlutterwaveBillProviderError("unsupported_country", "Flutterwave bill payments are currently qualified only for Nigeria");
    }
  }

  #headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      authorization: `Bearer ${this.#secretKey}`,
      accept: "application/json",
      "content-type": "application/json",
    });
  }

  async #request(input: Parameters<FlutterwaveBillsTransport["request"]>[0]): Promise<Readonly<{ status: number; body: unknown }>> {
    try {
      return await this.#transport.request(input);
    } catch {
      throw new FlutterwaveBillProviderError(
        input.method === "POST" ? "dispatch_outcome_unknown" : "transport_failure",
        input.method === "POST"
          ? "Flutterwave bill dispatch outcome is unknown; reconcile by reference before any retry"
          : "Flutterwave bill request failed",
        { retryable: input.method === "GET", outcomeUnknown: input.method === "POST" },
      );
    }
  }

  async listCategories(signal?: AbortSignal): Promise<readonly FlutterwaveBillCategory[]> {
    const response = await this.#request({
      method: "GET",
      path: "/v3/top-bill-categories",
      query: { country: this.#country },
      headers: this.#headers(),
      signal,
    });
    if (response.status !== 200) throw new FlutterwaveBillProviderError("catalog_unavailable", "Flutterwave bill categories are unavailable", { retryable: response.status >= 500 });
    return Object.freeze(dataArray(response.body).map((entry) => {
      const row = record(entry, "category");
      const country = textValue(row.country_code, "category country", 2);
      if (country !== "NG") throw new FlutterwaveBillProviderError("unsupported_country", "Flutterwave returned an unqualified bill country");
      return Object.freeze({
        code: textValue(row.code, "category code", 80),
        name: textValue(row.name, "category name"),
        description: optionalText(row.description, "category description", 500),
        country: "NG" as const,
      });
    }));
  }

  async listBillers(categoryCode: string, signal?: AbortSignal): Promise<readonly FlutterwaveBiller[]> {
    const response = await this.#request({
      method: "GET",
      path: `/v3/bills/${encodeSegment(categoryCode, "category code")}/billers`,
      query: { country: this.#country },
      headers: this.#headers(),
      signal,
    });
    if (response.status !== 200) throw new FlutterwaveBillProviderError("billers_unavailable", "Flutterwave billers are unavailable", { retryable: response.status >= 500 });
    return Object.freeze(dataArray(response.body).map((entry) => {
      const row = record(entry, "biller");
      return Object.freeze({
        billerCode: textValue(row.biller_code ?? row.code, "biller code", 128),
        name: textValue(row.name, "biller name"),
      });
    }));
  }

  async listItems(billerCode: string, signal?: AbortSignal): Promise<readonly FlutterwaveBillItem[]> {
    const normalizedBiller = textValue(billerCode, "biller code", 128);
    const response = await this.#request({
      method: "GET",
      path: `/v3/billers/${encodeSegment(normalizedBiller, "biller code")}/items`,
      headers: this.#headers(),
      signal,
    });
    if (response.status !== 200) throw new FlutterwaveBillProviderError("items_unavailable", "Flutterwave bill items are unavailable", { retryable: response.status >= 500 });
    return Object.freeze(dataArray(response.body).map((entry) => {
      const row = record(entry, "bill item");
      const currency = optionalText(row.currency, "item currency", 3) ?? "NGN";
      if (currency !== "NGN") throw new FlutterwaveBillProviderError("unsupported_currency", "Flutterwave returned an unqualified bill currency");
      return Object.freeze({
        billerCode: optionalText(row.biller_code, "item biller code", 128) ?? normalizedBiller,
        itemCode: textValue(row.item_code, "item code", 128),
        name: textValue(row.name, "item name"),
        amount: decimal(row.amount, "item amount"),
        currency: "NGN" as const,
        labelName: optionalText(row.label_name, "item label", 200),
      });
    }));
  }

  async validateCustomer(itemCode: string, customer: string, signal?: AbortSignal): Promise<FlutterwaveCustomerValidation> {
    const normalizedCustomer = textValue(customer, "customer", 200);
    const response = await this.#request({
      method: "GET",
      path: `/v3/bill-items/${encodeSegment(itemCode, "item code")}/validate`,
      query: { customer: normalizedCustomer },
      headers: this.#headers(),
      signal,
    });
    if (response.status !== 200) throw new FlutterwaveBillProviderError("customer_validation_unavailable", "Flutterwave customer validation is unavailable", { retryable: response.status >= 500 });
    const row = successfulData(response.body);
    const responseCode = textValue(row.response_code, "validation response code", 32);
    return Object.freeze({
      valid: responseCode === "00",
      responseCode,
      responseMessage: textValue(row.response_message, "validation message", 500),
      customer: optionalText(row.customer, "validated customer", 200) ?? normalizedCustomer,
      name: optionalText(row.name, "validated customer name", 300),
      billerCode: textValue(row.biller_code, "validated biller code", 128),
      productCode: optionalText(row.product_code, "validated product code", 128),
      minimum: optionalDecimal(row.minimum, "validation minimum"),
      maximum: optionalDecimal(row.maximum, "validation maximum"),
    });
  }

  async createPayment(input: Readonly<{
    billerCode: string;
    itemCode: string;
    customerId: string;
    amount: string;
    reference: string;
    callbackUrl?: string;
    signal?: AbortSignal;
  }>): Promise<FlutterwaveBillReceipt> {
    const reference = textValue(input.reference, "reference", 128);
    const amount = decimal(input.amount, "payment amount");
    if (amount === "0") throw new FlutterwaveBillProviderError("invalid_amount", "Bill payment amount must be greater than zero");
    const response = await this.#request({
      method: "POST",
      path: `/v3/billers/${encodeSegment(input.billerCode, "biller code")}/items/${encodeSegment(input.itemCode, "item code")}/payment`,
      body: {
        country: this.#country,
        customer_id: textValue(input.customerId, "customer id", 200),
        amount,
        reference,
        ...(input.callbackUrl ? { callback_url: textValue(input.callbackUrl, "callback URL", 1000) } : {}),
      },
      headers: this.#headers(),
      signal: input.signal,
    });
    if (response.status >= 500) {
      throw new FlutterwaveBillProviderError("dispatch_outcome_unknown", "Flutterwave bill dispatch outcome is unknown; reconcile by reference before any retry", { outcomeUnknown: true });
    }
    if (response.status !== 200) {
      throw new FlutterwaveBillProviderError("dispatch_rejected", "Flutterwave rejected the bill dispatch");
    }
    return this.#receipt(successfulData(response.body), reference);
  }

  async getStatus(reference: string, signal?: AbortSignal): Promise<FlutterwaveBillReceipt | null> {
    const normalizedReference = textValue(reference, "reference", 128);
    const response = await this.#request({
      method: "GET",
      path: `/v3/bills/${encodeSegment(normalizedReference, "reference")}`,
      query: { verbose: "1" },
      headers: this.#headers(),
      signal,
    });
    if (response.status === 404) return null;
    if (response.status !== 200) throw new FlutterwaveBillProviderError("status_unavailable", "Flutterwave bill status is unavailable", { retryable: response.status >= 500 });
    return this.#receipt(successfulData(response.body), normalizedReference);
  }

  #receipt(row: JsonRecord, fallbackReference: string): FlutterwaveBillReceipt {
    const reference = optionalText(row.customer_reference ?? row.reference, "receipt reference", 128) ?? fallbackReference;
    return Object.freeze({
      reference,
      providerReference: optionalText(row.flw_ref ?? row.tx_ref, "provider reference", 200),
      status: mapStatus(row.status),
      amount: optionalDecimal(row.amount, "receipt amount"),
      currency: row.currency === undefined || row.currency === null ? null : textValue(row.currency, "receipt currency", 3) === "NGN" ? "NGN" : null,
      customerId: optionalText(row.customer_id, "receipt customer", 200),
      product: optionalText(row.product, "receipt product", 200),
      productName: optionalText(row.product_name, "receipt product name", 300),
      extra: row.extra ?? null,
    });
  }
}

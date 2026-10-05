export interface NowPaymentsCustodyClientOptions {
  readonly apiKey: string;
  readonly email: string;
  readonly password: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

export interface NowPaymentsCustodyBalance {
  readonly currency: string;
  readonly available: string;
  readonly pending: string;
}

export type NowPaymentsConversionStatus =
  | "new"
  | "created"
  | "waiting"
  | "processing"
  | "finished"
  | "completed"
  | "success"
  | "successful"
  | "failed"
  | "rejected"
  | "cancelled"
  | "canceled"
  | "expired";

export interface NowPaymentsConversionEvidence {
  readonly conversionId: string;
  readonly status: NowPaymentsConversionStatus;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly fromAmount: string;
  readonly toAmount: string | null;
}

function nonEmpty(value: string, code: string, max = 512): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function currency(value: unknown): string {
  if (typeof value !== "string") throw new Error("nowpayments.conversion.currency.invalid");
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new Error("nowpayments.conversion.currency.invalid");
  }
  return normalized;
}

function amount(value: unknown, options: { readonly allowZero?: boolean } = {}): string {
  let text: string;
  if (typeof value === "string") text = value.trim();
  else if (typeof value === "number" && Number.isFinite(value)) text = numberToPlainDecimal(value);
  else throw new Error("nowpayments.conversion.amount.invalid");

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(text) || text.length > 80) {
    throw new Error("nowpayments.conversion.amount.invalid");
  }
  const normalized = text.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0" && options.allowZero !== true) {
    throw new Error("nowpayments.conversion.amount.invalid");
  }
  return normalized;
}

function numberToPlainDecimal(value: number): string {
  const text = String(value);
  if (!/[eE]/u.test(text)) return text;
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(text);
  if (!match) throw new Error("nowpayments.conversion.amount.invalid");
  const sign = match[1] ?? "";
  const integer = match[2] ?? "";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isSafeInteger(exponent)) throw new Error("nowpayments.conversion.amount.invalid");
  const digits = integer + fraction;
  const decimalAt = integer.length + exponent;
  if (decimalAt <= 0) return sign + "0." + "0".repeat(-decimalAt) + digits;
  if (decimalAt >= digits.length) return sign + digits + "0".repeat(decimalAt - digits.length);
  return sign + digits.slice(0, decimalAt) + "." + digits.slice(decimalAt);
}

function numericWireAmount(value: string): number {
  const exact = amount(value);
  const numeric = Number(exact);
  if (!Number.isFinite(numeric) || numeric <= 0 || numberToPlainDecimal(numeric) !== exact) {
    throw new Error("nowpayments.conversion.amount_unrepresentable");
  }
  return numeric;
}

function conversionId(value: unknown): string {
  const normalized =
    typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw new Error("nowpayments.conversion.id.invalid");
  }
  return normalized;
}

const statuses = new Set<NowPaymentsConversionStatus>([
  "new", "created", "waiting", "processing", "finished", "completed",
  "success", "successful", "failed", "rejected", "cancelled", "canceled", "expired",
]);

function conversionStatus(value: unknown): NowPaymentsConversionStatus {
  if (typeof value !== "string") throw new Error("nowpayments.conversion.status.invalid");
  const normalized = value.trim().toLowerCase() as NowPaymentsConversionStatus;
  if (!statuses.has(normalized)) throw new Error("nowpayments.conversion.status.invalid");
  return normalized;
}

function parseConversion(
  body: unknown,
  expected?: {
    readonly conversionId?: string;
    readonly fromCurrency?: string;
    readonly toCurrency?: string;
    readonly fromAmount?: string;
  },
): NowPaymentsConversionEvidence {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("nowpayments.conversion.invalid_response");
  }
  const record = body as Record<string, unknown>;
  const result: NowPaymentsConversionEvidence = Object.freeze({
    conversionId: conversionId(record.conversion_id ?? record.id),
    status: conversionStatus(record.status),
    fromCurrency: currency(record.from_currency),
    toCurrency: currency(record.to_currency),
    fromAmount: amount(record.from_amount ?? record.amount),
    toAmount:
      record.to_amount === undefined || record.to_amount === null || record.to_amount === ""
        ? null
        : amount(record.to_amount),
  });
  if (
    (expected?.conversionId !== undefined && result.conversionId !== expected.conversionId) ||
    (expected?.fromCurrency !== undefined && result.fromCurrency !== currency(expected.fromCurrency)) ||
    (expected?.toCurrency !== undefined && result.toCurrency !== currency(expected.toCurrency)) ||
    (expected?.fromAmount !== undefined && result.fromAmount !== amount(expected.fromAmount))
  ) {
    throw new Error("nowpayments.conversion.evidence_mismatch");
  }
  if (
    ["finished", "completed", "success", "successful"].includes(result.status) &&
    result.toAmount === null
  ) {
    throw new Error("nowpayments.conversion.invalid_response");
  }
  return result;
}

export class NowPaymentsCustodyClient {
  readonly #apiKey: string;
  readonly #email: string;
  readonly #password: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: NowPaymentsCustodyClientOptions) {
    this.#apiKey = nonEmpty(options.apiKey, "nowpayments.api_key.required", 256);
    this.#email = nonEmpty(options.email, "nowpayments.custody.email.required", 320);
    this.#password = nonEmpty(options.password, "nowpayments.custody.password.required", 512);
    this.#baseUrl = (options.baseUrl ?? "https://api.nowpayments.io/v1").replace(/\/+$/u, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async authenticate(signal?: AbortSignal): Promise<string> {
    const response = await this.#request("/auth", {
      method: "POST",
      body: JSON.stringify({ email: this.#email, password: this.#password }),
      authenticated: false,
      ...(signal === undefined ? {} : { signal }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    const token =
      typeof body.token === "string" ? body.token.trim() :
      typeof body.jwt === "string" ? body.jwt.trim() : "";
    if (!token || token.length > 8192) throw new Error("nowpayments.custody.auth.invalid_response");
    return token;
  }

  async readBalances(signal?: AbortSignal): Promise<readonly NowPaymentsCustodyBalance[]> {
    const response = await this.#request("/balance", {
      method: "GET",
      authenticated: false,
      ...(signal === undefined ? {} : { signal }),
    });
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("nowpayments.custody.balance.invalid_response");
    }
    const rows: NowPaymentsCustodyBalance[] = [];
    for (const [rawCurrency, rawEntry] of Object.entries(body as Record<string, unknown>)) {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
        throw new Error("nowpayments.custody.balance.invalid_response");
      }
      const entry = rawEntry as Record<string, unknown>;
      rows.push(Object.freeze({
        currency: currency(rawCurrency),
        available: amount(entry.amount, { allowZero: true }),
        pending: amount(entry.pendingAmount ?? entry.pending_amount ?? 0, { allowZero: true }),
      }));
    }
    rows.sort((left, right) => left.currency.localeCompare(right.currency));
    return Object.freeze(rows);
  }

  async createConversion(input: {
    readonly fromCurrency: string;
    readonly toCurrency: string;
    readonly amount: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsConversionEvidence> {
    const fromCurrency = currency(input.fromCurrency);
    const toCurrency = currency(input.toCurrency);
    if (fromCurrency === toCurrency) throw new Error("nowpayments.conversion.same_currency");
    const exactAmount = amount(input.amount);
    const wireAmount = numericWireAmount(exactAmount);

    let token: string;
    try {
      token = await this.authenticate(input.signal);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (
        code === "nowpayments.custody.credential.unavailable" ||
        code === "nowpayments.custody.transport.unavailable" ||
        code === "nowpayments.custody.provider.unavailable" ||
        code === "nowpayments.custody.auth.invalid_response"
      ) {
        throw new Error("nowpayments.conversion.authentication_unavailable");
      }
      throw error;
    }

    const response = await this.#request("/conversion", {
      method: "POST",
      body: JSON.stringify({
        from_currency: fromCurrency.toLowerCase(),
        to_currency: toCurrency.toLowerCase(),
        amount: wireAmount,
      }),
      authenticated: true,
      token,
      badRequestCode: "nowpayments.conversion.request_rejected",
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    return parseConversion(await response.json(), { fromCurrency, toCurrency, fromAmount: exactAmount });
  }

  async getConversionEvidence(input: {
    readonly conversionId: string;
    readonly fromCurrency?: string;
    readonly toCurrency?: string;
    readonly fromAmount?: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsConversionEvidence> {
    const id = conversionId(input.conversionId);
    const token = await this.authenticate(input.signal);
    const response = await this.#request(`/conversion/${encodeURIComponent(id)}`, {
      method: "GET",
      authenticated: true,
      token,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    return parseConversion(await response.json(), {
      conversionId: id,
      ...(input.fromCurrency === undefined ? {} : { fromCurrency: input.fromCurrency }),
      ...(input.toCurrency === undefined ? {} : { toCurrency: input.toCurrency }),
      ...(input.fromAmount === undefined ? {} : { fromAmount: input.fromAmount }),
    });
  }

  async #request(
    path: string,
    input: {
      readonly method: "GET" | "POST";
      readonly body?: string;
      readonly signal?: AbortSignal;
      readonly authenticated: boolean;
      readonly token?: string;
      readonly badRequestCode?: string;
    },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "x-api-key": this.#apiKey,
      accept: "application/json",
    };
    if (input.body !== undefined) headers["content-type"] = "application/json";
    if (input.authenticated) {
      if (!input.token) throw new Error("nowpayments.custody.auth.required");
      headers.authorization = `Bearer ${input.token}`;
    }
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: input.method,
        headers,
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
    } catch {
      throw new Error("nowpayments.custody.transport.unavailable");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("nowpayments.custody.credential.unavailable");
      }
      if (
        input.badRequestCode !== undefined &&
        (response.status === 400 || response.status === 422)
      ) {
        throw new Error(input.badRequestCode);
      }
      throw new Error("nowpayments.custody.provider.unavailable");
    }
    return response;
  }
}

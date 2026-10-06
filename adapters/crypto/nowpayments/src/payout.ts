export interface NowPaymentsPayoutClientOptions {
  readonly apiKey: string;
  readonly email: string;
  readonly password: string;
  readonly baseUrl?: string;
  readonly relayToken?: string;
  readonly fetch?: typeof globalThis.fetch;
}

export interface NowPaymentsCreatedPayout {
  /** NOWPayments batch withdrawal id. Verification is performed against this id. */
  readonly payoutId: string;
  readonly withdrawalId: string | null;
  readonly status: string | null;
}

export interface NowPaymentsPayoutEvidence {
  readonly batchId: string;
  readonly withdrawalId: string;
  readonly status: string;
  readonly currency: string;
  readonly amount: string;
  readonly address: string;
  readonly uniqueExternalId: string | null;
}

export interface NowPaymentsPayoutAddressValidation {
  readonly valid: true;
  readonly address: string;
  readonly currency: string;
}

export interface NowPaymentsPayoutFeeEstimate {
  readonly currency: string;
  readonly amount: string;
  readonly fee: string;
}

export interface NowPaymentsPayoutMinimum {
  readonly currency: string;
  readonly minimumAmount: string;
}

function nonEmpty(value: string, code: string, max = 512): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function payoutCurrency(value: string): string {
  const normalized = nonEmpty(value, "nowpayments.payout.currency.invalid", 32).toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new Error("nowpayments.payout.currency.invalid");
  }
  return normalized;
}

function numberToPlainDecimal(value: number): string {
  const text = String(value);
  if (!/[eE]/u.test(text)) return text;
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(text);
  if (!match) throw new Error("nowpayments.payout.amount.invalid");
  const sign = match[1] ?? "";
  const integer = match[2] ?? "";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isSafeInteger(exponent)) throw new Error("nowpayments.payout.amount.invalid");
  const digits = integer + fraction;
  const decimalAt = integer.length + exponent;
  if (decimalAt <= 0) return sign + "0." + "0".repeat(-decimalAt) + digits;
  if (decimalAt >= digits.length) return sign + digits + "0".repeat(decimalAt - digits.length);
  return sign + digits.slice(0, decimalAt) + "." + digits.slice(decimalAt);
}

function decimal(
  value: unknown,
  code: string,
  options: { readonly allowZero?: boolean; readonly maxDecimals?: number } = {},
): string {
  let text: string;
  if (typeof value === "string") text = value.trim();
  else if (typeof value === "number" && Number.isFinite(value)) text = numberToPlainDecimal(value);
  else throw new Error(code);

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(text) || text.length > 80) throw new Error(code);
  const normalized = text.replace(/\.0+$/u, "").replace(/(\.\d*?[1-9])0+$/u, "$1");
  if (normalized === "0" && options.allowZero !== true) throw new Error(code);
  const places = normalized.includes(".") ? normalized.length - normalized.indexOf(".") - 1 : 0;
  if (options.maxDecimals !== undefined && places > options.maxDecimals) throw new Error(code);
  return normalized;
}

function numericWireAmount(value: string, maxDecimals?: number): number {
  const exact = decimal(value, "nowpayments.payout.amount.invalid", {
    ...(maxDecimals === undefined ? {} : { maxDecimals }),
  });
  const numeric = Number(exact);
  if (!Number.isFinite(numeric) || numeric <= 0 || numberToPlainDecimal(numeric) !== exact) {
    throw new Error("nowpayments.payout.amount.invalid");
  }
  return numeric;
}

function payoutIdFrom(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("nowpayments.payout.invalid_response");
  }
  const record = body as Record<string, unknown>;
  const candidate = record.id ?? record.batch_withdrawal_id ?? record.batch_id;
  const normalized = String(candidate ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw new Error("nowpayments.payout.invalid_response");
  }
  return normalized;
}

const payoutStatuses = new Set([
  "new", "creating", "waiting", "processing", "sending", "finished",
  "failed", "rejected", "rejected_not_checked", "cancelled", "canceled",
]);

function statusFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const nested = Array.isArray(record.withdrawals) && record.withdrawals.length === 1
    ? record.withdrawals[0]
    : null;
  const value = record.payout_status ?? record.status ??
    (nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>).payout_status ?? (nested as Record<string, unknown>).status
      : undefined);
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  return payoutStatuses.has(normalized) ? normalized : null;
}

function withdrawalIdFrom(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const withdrawals = (body as Record<string, unknown>).withdrawals;
  if (!Array.isArray(withdrawals) || withdrawals.length !== 1) return null;
  const row = withdrawals[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const candidate = (row as Record<string, unknown>).id ?? (row as Record<string, unknown>).payout_id;
  const normalized = String(candidate ?? "").trim();
  return /^[A-Za-z0-9_-]{1,128}$/u.test(normalized) ? normalized : null;
}

function exactPayoutEvidence(row: Record<string, unknown>, expectedBatchId: string): NowPaymentsPayoutEvidence {
  const batchId = String(row.batch_withdrawal_id ?? row.batch_id ?? "").trim();
  if (batchId !== expectedBatchId) throw new Error("nowpayments.payout.evidence_mismatch");
  const withdrawalId = String(row.id ?? row.payout_id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(withdrawalId)) {
    throw new Error("nowpayments.payout.evidence_unavailable");
  }
  const status = statusFrom(row);
  if (status === null) throw new Error("nowpayments.payout.evidence_unavailable");
  const currency = payoutCurrency(String(row.currency ?? ""));
  const amount = decimal(row.amount, "nowpayments.payout.evidence_unavailable");
  const address = nonEmpty(String(row.address ?? ""), "nowpayments.payout.evidence_unavailable", 512);
  const externalRaw = row.unique_external_id;
  const uniqueExternalId =
    externalRaw === undefined || externalRaw === null || externalRaw === ""
      ? null
      : nonEmpty(String(externalRaw), "nowpayments.payout.evidence_unavailable", 256);
  return Object.freeze({ batchId, withdrawalId, status, currency, amount, address, uniqueExternalId });
}

function payoutRows(body: unknown): readonly Record<string, unknown>[] {
  const source =
    Array.isArray(body) ? body :
    body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).payouts)
      ? (body as Record<string, unknown>).payouts as unknown[] :
    body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).data)
      ? (body as Record<string, unknown>).data as unknown[] :
    [];
  return source.filter((entry): entry is Record<string, unknown> =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry));
}

export class NowPaymentsPayoutClient {
  readonly #apiKey: string;
  readonly #email: string;
  readonly #password: string;
  readonly #baseUrl: string;
  readonly #relayToken: string | null;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: NowPaymentsPayoutClientOptions) {
    this.#apiKey = nonEmpty(options.apiKey, "nowpayments.api_key.required", 256);
    this.#email = nonEmpty(options.email, "nowpayments.payout.email.required", 320);
    this.#password = nonEmpty(options.password, "nowpayments.payout.password.required", 512);
    this.#baseUrl = (options.baseUrl ?? "https://api.nowpayments.io/v1").replace(/\/+$/u, "");
    const relayToken = options.relayToken?.trim() ?? "";
    if (relayToken.length > 1024) throw new Error("nowpayments.relay_token.invalid");
    this.#relayToken = relayToken || null;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async authenticate(signal?: AbortSignal): Promise<string> {
    const response = await this.#request("/auth", {
      method: "POST",
      body: JSON.stringify({ email: this.#email, password: this.#password }),
      ...(signal === undefined ? {} : { signal }),
      authenticated: false,
    });
    const body = (await response.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() :
      typeof body.jwt === "string" ? body.jwt.trim() : "";
    if (!token || token.length > 8192) throw new Error("nowpayments.payout.auth.invalid_response");
    return token;
  }

  async validateAddress(input: {
    readonly currency: string;
    readonly address: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsPayoutAddressValidation> {
    const currency = payoutCurrency(input.currency);
    const address = nonEmpty(input.address, "nowpayments.payout.address.invalid", 512);
    await this.#request("/payout/validate-address", {
      method: "POST",
      body: JSON.stringify({ address, currency: currency.toLowerCase() }),
      authenticated: false,
      badRequestCode: "nowpayments.payout.address.invalid",
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    return Object.freeze({ valid: true as const, address, currency });
  }

  async getPayoutFeeEstimate(input: {
    readonly currency: string;
    readonly amount: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsPayoutFeeEstimate> {
    const currency = payoutCurrency(input.currency);
    const exactAmount = decimal(input.amount, "nowpayments.payout.amount.invalid", { maxDecimals: 6 });
    const wireAmount = numericWireAmount(exactAmount, 6);
    const search = new URLSearchParams({
      currency: currency.toLowerCase(),
      amount: String(wireAmount),
    });
    const response = await this.#request(`/payout/fee?${search.toString()}`, {
      method: "GET",
      authenticated: false,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("nowpayments.payout.fee.invalid_response");
    }
    const record = body as Record<string, unknown>;
    if (record.currency !== undefined && payoutCurrency(String(record.currency)) !== currency) {
      throw new Error("nowpayments.payout.fee.evidence_mismatch");
    }
    return Object.freeze({
      currency,
      amount: exactAmount,
      fee: decimal(record.fee, "nowpayments.payout.fee.invalid_response", { allowZero: true }),
    });
  }

  async getMinimumPayoutAmount(input: {
    readonly currency: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsPayoutMinimum> {
    const currency = payoutCurrency(input.currency);
    const response = await this.#request(
      `/payout-withdrawal/min-amount/${encodeURIComponent(currency.toLowerCase())}`,
      {
        method: "GET",
        authenticated: false,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      },
    );
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("nowpayments.payout.minimum.invalid_response");
    }
    const record = body as Record<string, unknown>;
    if (record.success === false) throw new Error("nowpayments.payout.minimum.unavailable");
    return Object.freeze({
      currency,
      minimumAmount: decimal(
        record.result ?? record.min_amount,
        "nowpayments.payout.minimum.invalid_response",
      ),
    });
  }

  async createPayout(input: {
    readonly amount: string;
    readonly currency: string;
    readonly address: string;
    readonly ipnCallbackUrl?: string;
    readonly uniqueExternalId?: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsCreatedPayout> {
    const exactAmount = decimal(input.amount, "nowpayments.payout.amount.invalid", { maxDecimals: 6 });
    const amount = numericWireAmount(exactAmount, 6);
    const currency = payoutCurrency(input.currency).toLowerCase();
    const address = nonEmpty(input.address, "nowpayments.payout.address.invalid", 512);

    const withdrawal: Record<string, unknown> = { address, currency, amount };
    if (input.uniqueExternalId !== undefined) {
      withdrawal.unique_external_id = nonEmpty(
        input.uniqueExternalId,
        "nowpayments.payout.external_id.invalid",
        256,
      );
    }
    if (input.ipnCallbackUrl !== undefined) {
      const callback = new URL(input.ipnCallbackUrl);
      if (callback.protocol !== "https:") throw new Error("nowpayments.payout.ipn_callback.insecure");
      withdrawal.ipn_callback_url = callback.toString();
    }

    let token: string;
    try {
      token = await this.authenticate(input.signal);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (
        code === "nowpayments.payout.credential.unavailable" ||
        code === "nowpayments.payout.transport.unavailable" ||
        code === "nowpayments.payout.provider.unavailable"
      ) {
        throw new Error("nowpayments.payout.authentication_unavailable");
      }
      throw error;
    }

    let response: Response;
    try {
      response = await this.#request("/payout", {
        method: "POST",
        body: JSON.stringify({
          ...(input.ipnCallbackUrl === undefined ? {} : { ipn_callback_url: input.ipnCallbackUrl }),
          withdrawals: [withdrawal],
        }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        token,
        authenticated: true,
        badRequestCode: "nowpayments.payout.request_rejected",
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (
        code === "nowpayments.payout.request_rejected" ||
        code === "nowpayments.payout.credential.unavailable"
      ) {
        throw new Error("nowpayments.payout.dispatch_rejected");
      }
      throw error;
    }
    const body = await response.json();
    return Object.freeze({
      payoutId: payoutIdFrom(body),
      withdrawalId: withdrawalIdFrom(body),
      status: statusFrom(body),
    });
  }

  async verifyPayout(input: {
    readonly payoutId: string;
    readonly verificationCode: string;
    readonly signal?: AbortSignal;
  }): Promise<{ readonly status: string | null }> {
    const payoutId = nonEmpty(input.payoutId, "nowpayments.payout_id.invalid", 128);
    if (!/^[A-Za-z0-9_-]+$/u.test(payoutId)) throw new Error("nowpayments.payout_id.invalid");
    const verificationCode = nonEmpty(
      input.verificationCode,
      "nowpayments.payout.verification_code.invalid",
      16,
    );
    if (!/^[0-9]{6}$/u.test(verificationCode)) {
      throw new Error("nowpayments.payout.verification_code.invalid");
    }
    const token = await this.authenticate(input.signal);
    const response = await this.#request(`/payout/${encodeURIComponent(payoutId)}/verify`, {
      method: "POST",
      body: JSON.stringify({ verification_code: verificationCode }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      token,
      authenticated: true,
    });
    return Object.freeze({ status: statusFrom(await response.json()) });
  }

  /**
   * providerPayoutId is the single-withdrawal batch id stored by Commerce. Query by batch_id
   * so refresh does not confuse that id with the individual withdrawal id.
   */
  async getPayoutEvidence(input: {
    readonly payoutId: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsPayoutEvidence> {
    const payoutId = nonEmpty(input.payoutId, "nowpayments.payout_id.invalid", 128);
    if (!/^[A-Za-z0-9_-]+$/u.test(payoutId)) throw new Error("nowpayments.payout_id.invalid");
    const token = await this.authenticate(input.signal);
    const search = new URLSearchParams({ batch_id: payoutId, limit: "2", page: "0" });
    const response = await this.#request(`/payout?${search.toString()}`, {
      method: "GET",
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      token,
      authenticated: true,
    });
    const rows = payoutRows(await response.json()).filter((row) =>
      String(row.batch_withdrawal_id ?? row.batch_id ?? "") === payoutId);
    if (rows.length !== 1) throw new Error("nowpayments.payout.evidence_unavailable");
    return exactPayoutEvidence(rows[0]!, payoutId);
  }

  async getPayoutStatus(input: {
    readonly payoutId: string;
    readonly signal?: AbortSignal;
  }): Promise<string | null> {
    return (await this.getPayoutEvidence(input)).status;
  }

  async #request(
    path: string,
    input: {
      readonly method: "GET" | "POST";
      readonly body?: string;
      readonly signal?: AbortSignal;
      readonly token?: string;
      readonly authenticated: boolean;
      readonly badRequestCode?: string;
    },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "x-api-key": this.#apiKey,
      accept: "application/json",
      ...(this.#relayToken === null
        ? {}
        : { "x-masanawa-relay-token": this.#relayToken }),
    };
    if (input.body !== undefined) headers["content-type"] = "application/json";
    if (input.authenticated && input.token) headers.authorization = `Bearer ${input.token}`;
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: input.method,
        headers,
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
    } catch {
      throw new Error("nowpayments.payout.transport.unavailable");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("nowpayments.payout.credential.unavailable");
      }
      if (
        input.badRequestCode !== undefined &&
        (response.status === 400 || response.status === 422)
      ) {
        throw new Error(input.badRequestCode);
      }
      throw new Error("nowpayments.payout.provider.unavailable");
    }
    return response;
  }
}

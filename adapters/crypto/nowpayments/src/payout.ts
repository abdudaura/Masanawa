export interface NowPaymentsPayoutClientOptions {
  readonly apiKey: string;
  readonly email: string;
  readonly password: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

export interface NowPaymentsCreatedPayout {
  readonly payoutId: string;
  readonly status: string | null;
}

function nonEmpty(value: string, code: string, max = 512): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function payoutIdFrom(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("nowpayments.payout.invalid_response");
  }
  const record = body as Record<string, unknown>;
  const candidate =
    record.id ??
    record.payout_id ??
    (Array.isArray(record.withdrawals) && record.withdrawals.length > 0
      ? (record.withdrawals[0] as Record<string, unknown> | undefined)?.id
      : undefined);
  const normalized = String(candidate ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw new Error("nowpayments.payout.invalid_response");
  }
  return normalized;
}

function statusFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).status;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export class NowPaymentsPayoutClient {
  readonly #apiKey: string;
  readonly #email: string;
  readonly #password: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: NowPaymentsPayoutClientOptions) {
    this.#apiKey = nonEmpty(options.apiKey, "nowpayments.api_key.required", 256);
    this.#email = nonEmpty(options.email, "nowpayments.payout.email.required", 320);
    this.#password = nonEmpty(options.password, "nowpayments.payout.password.required", 512);
    this.#baseUrl = (options.baseUrl ?? "https://api.nowpayments.io/v1").replace(/\/+$/u, "");
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

  async createPayout(input: {
    readonly amount: string;
    readonly currency: string;
    readonly address: string;
    readonly ipnCallbackUrl?: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsCreatedPayout> {
    const token = await this.authenticate(input.signal);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("nowpayments.payout.amount.invalid");
    const currency = nonEmpty(input.currency, "nowpayments.payout.currency.invalid", 32).toLowerCase();
    const address = nonEmpty(input.address, "nowpayments.payout.address.invalid", 512);

    const withdrawal: Record<string, unknown> = { address, currency, amount };
    if (input.ipnCallbackUrl !== undefined) {
      const callback = new URL(input.ipnCallbackUrl);
      if (callback.protocol !== "https:") throw new Error("nowpayments.payout.ipn_callback.insecure");
      withdrawal.ipn_callback_url = callback.toString();
    }

    const response = await this.#request("/payout", {
      method: "POST",
      body: JSON.stringify({
        ...(input.ipnCallbackUrl === undefined ? {} : { ipn_callback_url: input.ipnCallbackUrl }),
        withdrawals: [withdrawal],
      }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      token,
      authenticated: true,
    });
    const body = await response.json();
    return Object.freeze({
      payoutId: payoutIdFrom(body),
      status: statusFrom(body),
    });
  }

  async verifyPayout(input: {
    readonly payoutId: string;
    readonly verificationCode: string;
    readonly signal?: AbortSignal;
  }): Promise<{ readonly status: string | null }> {
    const token = await this.authenticate(input.signal);
    const payoutId = nonEmpty(input.payoutId, "nowpayments.payout_id.invalid", 128);
    if (!/^[A-Za-z0-9_-]+$/u.test(payoutId)) throw new Error("nowpayments.payout_id.invalid");
    const verificationCode = nonEmpty(
      input.verificationCode,
      "nowpayments.payout.verification_code.invalid",
      16,
    );
    if (!/^[0-9]{4,10}$/u.test(verificationCode)) {
      throw new Error("nowpayments.payout.verification_code.invalid");
    }
    const response = await this.#request(`/payout/${encodeURIComponent(payoutId)}/verify`, {
      method: "POST",
      body: JSON.stringify({ verification_code: verificationCode }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      token,
      authenticated: true,
    });
    return Object.freeze({ status: statusFrom(await response.json()) });
  }

  async getPayoutStatus(input: {
    readonly payoutId: string;
    readonly signal?: AbortSignal;
  }): Promise<string | null> {
    const token = await this.authenticate(input.signal);
    const payoutId = nonEmpty(input.payoutId, "nowpayments.payout_id.invalid", 128);
    const response = await this.#request(`/payout/${encodeURIComponent(payoutId)}`, {
      method: "GET",
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      token,
      authenticated: true,
    });
    return statusFrom(await response.json());
  }

  async #request(
    path: string,
    input: {
      readonly method: "GET" | "POST";
      readonly body?: string;
      readonly signal?: AbortSignal;
      readonly token?: string;
      readonly authenticated: boolean;
    },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "x-api-key": this.#apiKey,
      accept: "application/json",
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
      throw new Error("nowpayments.payout.provider.unavailable");
    }
    return response;
  }
}

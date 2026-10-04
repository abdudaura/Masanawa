import {
  normalizeAvailableCurrencies,
  qualifyRoute,
  type CryptoOperation,
  type NowPaymentsCurrencyEvidence,
  type RouteQualification,
} from "./catalog.js";

export interface NowPaymentsClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

interface CurrenciesResponse {
  readonly currencies?: unknown;
}

export class NowPaymentsClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: NowPaymentsClientOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new Error("nowpayments.api_key.required");
    }
    this.#apiKey = apiKey;
    this.#baseUrl = (options.baseUrl ?? "https://api.nowpayments.io/v1").replace(/\/+$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async listPaymentCurrencies(signal?: AbortSignal): Promise<readonly NowPaymentsCurrencyEvidence[]> {
    const response = await this.#request("/currencies", signal);
    const body = (await response.json()) as CurrenciesResponse;
    if (!Array.isArray(body.currencies) || !body.currencies.every((value) => typeof value === "string")) {
      throw new Error("nowpayments.currencies.invalid_response");
    }
    return normalizeAvailableCurrencies(body.currencies);
  }

  async listEligiblePaymentRoutes(options: {
    readonly operation?: CryptoOperation;
    readonly excludedNetworks?: readonly string[];
    readonly requireKnownNetwork?: boolean;
    readonly signal?: AbortSignal;
  } = {}): Promise<readonly RouteQualification[]> {
    const routes = await this.listPaymentCurrencies(options.signal);
    const operation = options.operation ?? "deposit";
    return Object.freeze(
      routes
        .map((route) =>
          qualifyRoute(route, operation, {
            excludedNetworks: options.excludedNetworks,
            requireKnownNetwork: options.requireKnownNetwork,
          }),
        )
        .filter((result) => result.eligible),
    );
  }

  async #request(path: string, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: "GET",
        headers: { "x-api-key": this.#apiKey, accept: "application/json" },
        signal,
      });
    } catch {
      throw new Error("nowpayments.transport.unavailable");
    }
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "nowpayments.credential.unavailable"
          : "nowpayments.provider.unavailable",
      );
    }
    return response;
  }
}

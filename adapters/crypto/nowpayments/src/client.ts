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

interface CurrenciesResponse { readonly currencies?: unknown; }

export class NowPaymentsClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: NowPaymentsClientOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) throw new Error("nowpayments.api_key.required");
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
    readonly maxEstimatedNetworkFeeUsd?: number;
    readonly signal?: AbortSignal;
  } = {}): Promise<readonly RouteQualification[]> {
    const routes = await this.listPaymentCurrencies(options.signal);
    const qualificationOptions: {
      excludedNetworks?: readonly string[];
      requireKnownNetwork?: boolean;
      maxEstimatedNetworkFeeUsd?: number;
    } = {};
    if (options.excludedNetworks !== undefined) qualificationOptions.excludedNetworks = options.excludedNetworks;
    if (options.requireKnownNetwork !== undefined) qualificationOptions.requireKnownNetwork = options.requireKnownNetwork;
    if (options.maxEstimatedNetworkFeeUsd !== undefined) {
      qualificationOptions.maxEstimatedNetworkFeeUsd = options.maxEstimatedNetworkFeeUsd;
    }
    return Object.freeze(
      routes
        .map((route) => qualifyRoute(route, options.operation ?? "deposit", qualificationOptions))
        .filter((result) => result.eligible),
    );
  }

  async #request(path: string, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      const init: RequestInit = {
        method: "GET",
        headers: { "x-api-key": this.#apiKey, accept: "application/json" },
      };
      if (signal !== undefined) init.signal = signal;
      response = await this.#fetch(`${this.#baseUrl}${path}`, init);
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

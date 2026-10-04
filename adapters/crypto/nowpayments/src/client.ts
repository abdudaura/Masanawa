import {
  normalizeAvailableCurrencies,
  qualifyRoute,
  type CryptoOperation,
  type NowPaymentsCurrencyEvidence,
  type RouteQualification,
} from "./catalog.js";
import {
  assertAboveMinimum,
  parseEstimate,
  parseMinimumAmount,
  type NowPaymentsEstimate,
  type NowPaymentsMinimumAmount,
} from "./quotes.js";

export interface NowPaymentsClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

interface CurrenciesResponse { readonly currencies?: unknown; }

function query(params: Readonly<Record<string, string | number>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return search.toString();
}

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

  async getMinimumAmount(input: {
    readonly currencyFrom: string;
    readonly currencyTo: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsMinimumAmount> {
    const response = await this.#request(
      `/min-amount?${query({
        currency_from: input.currencyFrom,
        currency_to: input.currencyTo,
      })}`,
      input.signal,
    );
    return parseMinimumAmount(await response.json(), {
      currencyFrom: input.currencyFrom,
      currencyTo: input.currencyTo,
    });
  }

  async estimate(input: {
    readonly amount: number;
    readonly currencyFrom: string;
    readonly currencyTo: string;
    readonly signal?: AbortSignal;
  }): Promise<NowPaymentsEstimate> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("nowpayments.amount.invalid");
    }
    const response = await this.#request(
      `/estimate?${query({
        amount: input.amount,
        currency_from: input.currencyFrom,
        currency_to: input.currencyTo,
      })}`,
      input.signal,
    );
    return parseEstimate(await response.json(), input);
  }

  async quotePayment(input: {
    readonly amount: number;
    readonly currencyFrom: string;
    readonly currencyTo: string;
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly minimum: NowPaymentsMinimumAmount;
    readonly estimate: NowPaymentsEstimate;
  }> {
    const minimum = await this.getMinimumAmount(input);
    assertAboveMinimum(input.amount, minimum);
    const estimate = await this.estimate(input);
    return Object.freeze({ minimum, estimate });
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

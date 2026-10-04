import type { FlutterwaveBillsTransport } from "./client.js";

export class FlutterwaveHttpTransport implements FlutterwaveBillsTransport {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(input?: Readonly<{
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }>) {
    this.#baseUrl = (input?.baseUrl ?? "https://api.flutterwave.com").replace(/\/+$/u, "");
    this.#fetch = input?.fetchImpl ?? fetch;
    this.#timeoutMs = input?.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > 120_000) {
      throw new TypeError("Flutterwave HTTP timeout is invalid");
    }
  }

  async request(input: Parameters<FlutterwaveBillsTransport["request"]>[0]) {
    const url = new URL(`${this.#baseUrl}${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const signal = input.signal
      ? AbortSignal.any([input.signal, timeout])
      : timeout;

    const response = await this.#fetch(url, {
      method: input.method,
      headers: input.headers,
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal,
    });

    let body: unknown = null;
    const text = await response.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    return Object.freeze({ status: response.status, body });
  }
}

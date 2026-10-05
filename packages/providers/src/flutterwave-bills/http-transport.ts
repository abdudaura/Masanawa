import type { FlutterwaveBillsTransport } from "./client.js";

export class FlutterwaveHttpTransport implements FlutterwaveBillsTransport {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #relayToken: string | null;
  readonly #relayProtocol: "bearer" | "dual-header";

  constructor(input?: Readonly<{
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    relayToken?: string;
    relayProtocol?: "bearer" | "dual-header";
  }>) {
    const baseUrl = (input?.baseUrl ?? "https://api.flutterwave.com").replace(/\/+$/u, "");
    const parsedBase = new URL(baseUrl);
    if (parsedBase.protocol !== "https:") {
      throw new TypeError("Flutterwave HTTP base URL must use HTTPS");
    }
    this.#baseUrl = parsedBase.toString().replace(/\/+$/u, "");
    this.#fetch = input?.fetchImpl ?? fetch;
    this.#timeoutMs = input?.timeoutMs ?? 15_000;
    const relayToken = input?.relayToken?.trim() ?? "";
    if (relayToken.length > 1024) {
      throw new TypeError("Flutterwave relay token is invalid");
    }
    this.#relayToken = relayToken || null;
    this.#relayProtocol = input?.relayProtocol ?? "bearer";
    if (!["bearer", "dual-header"].includes(this.#relayProtocol) ||
        (this.#relayProtocol === "dual-header" && this.#relayToken === null)) {
      throw new TypeError("Flutterwave relay protocol is invalid");
    }
    if (parsedBase.username || parsedBase.password || parsedBase.search || parsedBase.hash) {
      throw new TypeError("Flutterwave HTTP base URL must not contain credentials, query or fragment");
    }
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

    const headers =
      this.#relayToken === null
        ? input.headers
        : Object.freeze({
            ...input.headers,
            ...(this.#relayProtocol === "dual-header"
              ? { "x-masanawa-relay-token": this.#relayToken }
              : { authorization: `Bearer ${this.#relayToken}` }),
          });

    const response = await this.#fetch(url, {
      method: input.method,
      redirect: "error",
      headers,
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


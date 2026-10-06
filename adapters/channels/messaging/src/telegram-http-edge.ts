import type { TelegramBotApiEdge } from "./telegram-outbound.js";
import type {
  ChannelHttpResponse,
  ChannelHttpTransport,
  RedactedCredentialSecret,
} from "./whatsapp-http-edge.js";

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function baseUrl(value: string): string {
  const normalized = bounded(value, "botApiBaseUrl", 512).replace(/\/+$/u, "");
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/.*)?$/u.test(normalized)) {
    throw new TypeError("Telegram Bot API base URL is invalid");
  }
  return normalized;
}

function safeTelegramCode(body: unknown, statusCode: number): string {
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    const code = (body as Record<string, unknown>).error_code;
    if (typeof code === "number" && Number.isSafeInteger(code) && code >= 0) {
      return `telegram_${code}`;
    }
  }
  return `http_${statusCode}`;
}

function botRejected(body: unknown): boolean {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).ok === false
  );
}

export function createTelegramBotApiHttpEdge(input: {
  readonly botToken: RedactedCredentialSecret;
  readonly transport: ChannelHttpTransport;
  readonly botApiBaseUrl?: string;
}): TelegramBotApiEdge {
  const api = baseUrl(input.botApiBaseUrl ?? "https://api.telegram.org");

  return Object.freeze({
    async call(request) {
      const body = JSON.stringify(request.body);
      if (body.length > 256_000) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "request_too_large",
        });
      }

      let response: ChannelHttpResponse;
      try {
        response = await input.botToken.use((token) =>
          input.transport.request({
            url: `${api}/bot${token}/${request.method}`,
            method: "POST",
            headers: Object.freeze({
              "content-type": "application/json",
            }),
            body,
          }),
        );
      } catch {
        throw new Error("Telegram Bot API request failed");
      }

      if (
        !Number.isSafeInteger(response.statusCode) ||
        response.statusCode < 100 ||
        response.statusCode > 599
      ) {
        throw new Error("Telegram Bot API returned an invalid HTTP status");
      }

      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        botRejected(response.body)
      ) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: safeTelegramCode(response.body, response.statusCode),
        });
      }

      return Object.freeze({
        status: "accepted" as const,
        body: response.body,
      });
    },
  });
}

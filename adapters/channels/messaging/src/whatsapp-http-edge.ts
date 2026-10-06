import type { WhatsAppCloudApiEdge } from "./whatsapp-outbound.js";

export interface RedactedCredentialSecret {
  use<T>(callback: (value: string) => T): T;
}

export interface ChannelHttpRequest {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface ChannelHttpResponse {
  readonly statusCode: number;
  readonly body: unknown;
}

export interface ChannelHttpTransport {
  request(input: ChannelHttpRequest): Promise<ChannelHttpResponse>;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function apiVersion(value: string): string {
  const normalized = bounded(value, "apiVersion", 32);
  if (!/^v[0-9]{1,3}\.[0-9]{1,3}$/u.test(normalized)) {
    throw new TypeError("WhatsApp Graph API version is invalid");
  }
  return normalized;
}

function baseUrl(value: string): string {
  const normalized = bounded(value, "graphBaseUrl", 512).replace(/\/+$/u, "");
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/.*)?$/u.test(normalized)) {
    throw new TypeError("WhatsApp Graph base URL is invalid");
  }
  return normalized;
}

function safeGraphCode(body: unknown, statusCode: number): string {
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    const error = (body as Record<string, unknown>).error;
    if (error !== null && typeof error === "object" && !Array.isArray(error)) {
      const code = (error as Record<string, unknown>).code;
      if (typeof code === "number" && Number.isSafeInteger(code) && code >= 0) {
        return `graph_${code}`;
      }
    }
  }
  return `http_${statusCode}`;
}

export function createWhatsAppCloudApiHttpEdge(input: {
  readonly accessToken: RedactedCredentialSecret;
  readonly transport: ChannelHttpTransport;
  readonly apiVersion: string;
  readonly graphBaseUrl?: string;
}): WhatsAppCloudApiEdge {
  const version = apiVersion(input.apiVersion);
  const graph = baseUrl(input.graphBaseUrl ?? "https://graph.facebook.com");

  return Object.freeze({
    async call(request) {
      const phoneNumberId = bounded(request.phoneNumberId, "phoneNumberId", 128);
      const body = JSON.stringify(request.body);
      if (body.length > 256_000) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "request_too_large",
        });
      }

      let response: ChannelHttpResponse;
      try {
        response = await input.accessToken.use((token) =>
          input.transport.request({
            url: `${graph}/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
            method: "POST",
            headers: Object.freeze({
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            }),
            body,
          }),
        );
      } catch {
        throw new Error("WhatsApp Cloud API request failed");
      }

      if (
        !Number.isSafeInteger(response.statusCode) ||
        response.statusCode < 100 ||
        response.statusCode > 599
      ) {
        throw new Error("WhatsApp Cloud API returned an invalid HTTP status");
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: safeGraphCode(response.body, response.statusCode),
        });
      }

      return Object.freeze({
        status: "accepted" as const,
        body: response.body,
      });
    },
  });
}

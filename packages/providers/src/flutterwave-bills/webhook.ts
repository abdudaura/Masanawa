import { createHash, timingSafeEqual } from "node:crypto";

export type FlutterwaveWebhookEvidence = Readonly<{
  version: "v3-secret-hash";
  event: string;
  fingerprint: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export class FlutterwaveWebhookError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FlutterwaveWebhookError";
    this.code = code;
  }
}

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") {
    throw new FlutterwaveWebhookError("invalid_webhook", `${label} is invalid`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new FlutterwaveWebhookError("invalid_webhook", `${label} is invalid`);
  }
  return normalized;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyFlutterwaveV3Webhook(input: Readonly<{
  rawBody: Uint8Array;
  verifHash: string | null | undefined;
  expectedSecretHash: string;
}>): FlutterwaveWebhookEvidence {
  const expected = bounded(input.expectedSecretHash, "webhook secret hash", 1024);
  const provided =
    input.verifHash === null || input.verifHash === undefined
      ? ""
      : input.verifHash.trim();

  if (!provided || !safeEqual(provided, expected)) {
    throw new FlutterwaveWebhookError(
      "invalid_signature",
      "Flutterwave webhook signature is invalid",
    );
  }

  if (!(input.rawBody instanceof Uint8Array) || input.rawBody.byteLength < 2) {
    throw new FlutterwaveWebhookError(
      "invalid_webhook",
      "Flutterwave webhook body is invalid",
    );
  }
  if (input.rawBody.byteLength > 1_048_576) {
    throw new FlutterwaveWebhookError(
      "payload_too_large",
      "Flutterwave webhook body is too large",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input.rawBody).toString("utf8")) as unknown;
  } catch {
    throw new FlutterwaveWebhookError(
      "invalid_webhook",
      "Flutterwave webhook body is invalid",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new FlutterwaveWebhookError(
      "invalid_webhook",
      "Flutterwave webhook payload is invalid",
    );
  }

  const payload = parsed as Record<string, unknown>;
  const eventValue = payload.event ?? "bill.updated";
  if (typeof eventValue !== "string") {
    throw new FlutterwaveWebhookError(
      "invalid_webhook",
      "Flutterwave webhook event is invalid",
    );
  }
  const event = bounded(eventValue, "webhook event", 200);
  const fingerprint = `sha256:${createHash("sha256").update(input.rawBody).digest("hex")}`;

  return Object.freeze({
    version: "v3-secret-hash",
    event,
    fingerprint,
    payload: Object.freeze({ ...payload }),
  });
}

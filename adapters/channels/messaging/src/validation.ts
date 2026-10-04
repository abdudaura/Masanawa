import { createHash, timingSafeEqual } from "node:crypto";
import { PlatformError, toInstant, type Instant } from "@masanawa/contracts";
import type { ChannelIngressRecord, InboundDelivery, InboundMessage, MessagingChannel } from "./model.js";
import type { ChannelAccountId } from "@masanawa/contracts";

export function fail(code: string, category: "validation" | "authentication" | "unavailable" = "validation"): never {
  throw new PlatformError({
    code: `channels.${code}`, category, retryable: category === "unavailable",
    message: category === "authentication" ? "Channel webhook verification failed" :
      category === "unavailable" ? "Channel ingress persistence is unavailable" : "Invalid channel webhook",
  });
}

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid_payload");
  return value as Record<string, unknown>;
}

export function list(value: unknown, max = 128): readonly unknown[] {
  if (!Array.isArray(value) || value.length > max) fail("invalid_payload");
  return value;
}

export function string(value: unknown, max = 2048): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value.includes("\u0000")) {
    fail("invalid_payload");
  }
  return value;
}

export function integer(value: unknown, allowZero = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    fail("invalid_payload");
  }
  return value;
}

export function timestamp(value: unknown, numeric = false): Instant {
  let seconds: number;
  if (numeric) seconds = integer(value);
  else {
    const text = string(value, 16);
    if (!/^[1-9][0-9]*$/u.test(text)) fail("invalid_payload");
    seconds = Number(text);
  }
  if (!Number.isSafeInteger(seconds) || seconds > 8_640_000_000_000) fail("invalid_payload");
  return toInstant(new Date(seconds * 1000));
}

export function secretEquals(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string" || actual.length > 1024) return false;
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

/** Called before parsing/auth hashing. The copy also fences caller mutation. */
export function snapshotBody(body: Uint8Array): Buffer {
  if (!(body instanceof Uint8Array) || body.byteLength === 0 || body.byteLength > 1_048_576) {
    fail("body_limit");
  }
  return Buffer.from(body);
}

export function parseBody(body: Buffer): Record<string, unknown> {
  try {
    return object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
  } catch {
    fail("invalid_payload");
  }
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function record(
  channel: MessagingChannel, accountId: ChannelAccountId, externalEventId: string,
  receivedAt: Instant, event: InboundMessage | InboundDelivery,
): ChannelIngressRecord {
  // Subject/conversation observedAt are local observations, excluded from replay evidence.
  const evidence = event.kind === "message" ? {
    ...event,
    subject: { ...event.subject, observedAt: undefined },
    conversation: { ...event.conversation, observedAt: undefined },
  } : event;
  return freeze({
    schemaVersion: 1, channel, accountId, externalEventId, receivedAt,
    dedupeKey: hash([channel, accountId, externalEventId]),
    evidenceHash: hash([channel, accountId, externalEventId, evidence]),
    event,
  });
}

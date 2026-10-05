import { toInstant, type Instant } from "@masanawa/contracts";

export const twinEconomyEventTypes = [
  "twin.visited",
  "twin.conversation.observed",
  "twin.purchase.completed",
  "twin.purchase.refunded",
  "twin.gift.completed",
  "twin.voice.completed",
  "twin.voice.refunded",
  "twin.owner-access.requested",
  "twin.owner-access.accepted",
  "twin.owner-access.scheduled",
  "twin.owner-access.completed",
  "twin.owner-access.refunded",
  "twin.earning.settled",
  "twin.earning.reversed",
] as const;

export type TwinEconomyEventType = (typeof twinEconomyEventTypes)[number];

export type TwinEconomyVisibility =
  | "owner"
  | "participant"
  | "internal";

export interface TwinEconomyEventPayload {
  readonly schemaVersion: 1;
  readonly eventType: TwinEconomyEventType;
  readonly ownerUserId: string;
  readonly characterId: string;
  readonly customerUserId: string | null;
  readonly referenceId: string;
  readonly visibility: TwinEconomyVisibility;
  readonly occurredAt: Instant;
  readonly amountCredits: number | null;
  readonly status:
    | "observed"
    | "pending"
    | "completed"
    | "refunded"
    | "reversed";
  readonly summaryCode: string;
}

const summaryCodes: Readonly<Record<TwinEconomyEventType, string>> = Object.freeze({
  "twin.visited": "twin_visit",
  "twin.conversation.observed": "twin_conversation",
  "twin.purchase.completed": "purchase_completed",
  "twin.purchase.refunded": "purchase_refunded",
  "twin.gift.completed": "gift_received",
  "twin.voice.completed": "voice_completed",
  "twin.voice.refunded": "voice_refunded",
  "twin.owner-access.requested": "owner_access_requested",
  "twin.owner-access.accepted": "owner_access_accepted",
  "twin.owner-access.scheduled": "owner_access_scheduled",
  "twin.owner-access.completed": "owner_access_completed",
  "twin.owner-access.refunded": "owner_access_refunded",
  "twin.earning.settled": "earning_settled",
  "twin.earning.reversed": "earning_reversed",
});

function bounded(value: string, name: string, max = 256): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function amount(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError("amountCredits is invalid");
  }
  return value;
}

export function normalizeTwinEconomyEvent(
  input: TwinEconomyEventPayload,
): TwinEconomyEventPayload {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported twin economy event schema");
  }
  if (!twinEconomyEventTypes.includes(input.eventType)) {
    throw new TypeError("Unknown twin economy event type");
  }
  if (
    input.visibility !== "owner" &&
    input.visibility !== "participant" &&
    input.visibility !== "internal"
  ) {
    throw new TypeError("Invalid twin economy visibility");
  }

  const ownerUserId = bounded(input.ownerUserId, "ownerUserId");
  const characterId = bounded(input.characterId, "characterId");
  const customerUserId =
    input.customerUserId === null
      ? null
      : bounded(input.customerUserId, "customerUserId");
  const referenceId = bounded(input.referenceId, "referenceId", 512);
  const summaryCode = bounded(input.summaryCode, "summaryCode", 100);

  if (summaryCode !== summaryCodes[input.eventType]) {
    throw new Error(
      `summaryCode does not match ${input.eventType}`,
    );
  }

  const normalizedAmount = amount(input.amountCredits);

  const amountRequired =
    input.eventType === "twin.purchase.completed" ||
    input.eventType === "twin.purchase.refunded" ||
    input.eventType === "twin.gift.completed" ||
    input.eventType === "twin.voice.completed" ||
    input.eventType === "twin.voice.refunded" ||
    input.eventType === "twin.owner-access.completed" ||
    input.eventType === "twin.owner-access.refunded" ||
    input.eventType === "twin.earning.settled" ||
    input.eventType === "twin.earning.reversed";

  if (amountRequired && normalizedAmount === null) {
    throw new Error("amountCredits is required for this twin economy event");
  }

  if (
    (input.eventType === "twin.visited" ||
      input.eventType === "twin.conversation.observed") &&
    normalizedAmount !== null
  ) {
    throw new Error("social observation events must not contain money");
  }

  return Object.freeze({
    schemaVersion: 1,
    eventType: input.eventType,
    ownerUserId,
    characterId,
    customerUserId,
    referenceId,
    visibility: input.visibility,
    occurredAt: toInstant(input.occurredAt),
    amountCredits: normalizedAmount,
    status: input.status,
    summaryCode,
  });
}

export function createTwinEconomyEvent(input: Omit<
  TwinEconomyEventPayload,
  "schemaVersion" | "summaryCode"
>): TwinEconomyEventPayload {
  return normalizeTwinEconomyEvent({
    ...input,
    schemaVersion: 1,
    summaryCode: summaryCodes[input.eventType],
  });
}

export function assertNoTwinTranscriptFields(
  value: Record<string, unknown>,
): void {
  const forbidden = [
    "message",
    "messageText",
    "text",
    "transcript",
    "prompt",
    "response",
    "content",
  ];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(
        `Twin economy events must not contain raw conversation field "${key}"`,
      );
    }
  }
}

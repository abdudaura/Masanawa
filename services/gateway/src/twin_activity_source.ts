import type {
  TwinActivityRecord,
  TwinActivitySource,
} from "./twin_activity.js";

export type TwinEconomyActivityEventType =
  | "twin.visited"
  | "twin.conversation.observed"
  | "twin.purchase.completed"
  | "twin.purchase.refunded"
  | "twin.gift.completed"
  | "twin.voice.completed"
  | "twin.voice.refunded"
  | "twin.owner-access.requested"
  | "twin.owner-access.accepted"
  | "twin.owner-access.scheduled"
  | "twin.owner-access.completed"
  | "twin.owner-access.refunded"
  | "twin.earning.settled"
  | "twin.earning.reversed";

export interface TwinEconomyActivityEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly characterId: string;
  readonly eventType: TwinEconomyActivityEventType;
  readonly occurredAt: string;
  readonly amountCredits: number | null;
  readonly status:
    | "observed"
    | "pending"
    | "completed"
    | "refunded"
    | "reversed";
}

export interface TwinEconomyActivityEventReader {
  listForCharacter(input: {
    readonly tenantId: string;
    readonly characterId: string;
    readonly limit: number;
  }): Promise<readonly TwinEconomyActivityEvent[]>;
}

function mapEvent(event: TwinEconomyActivityEvent): TwinActivityRecord | null {
  switch (event.eventType) {
    case "twin.visited":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "visit",
        status: "observed",
        occurredAt: event.occurredAt,
        amountCredits: null,
      };

    case "twin.conversation.observed":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "conversation",
        status: "completed",
        occurredAt: event.occurredAt,
        amountCredits: null,
      };

    case "twin.purchase.completed":
    case "twin.purchase.refunded":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "purchase",
        status:
          event.eventType === "twin.purchase.refunded"
            ? "refunded"
            : "completed",
        occurredAt: event.occurredAt,
        amountCredits: event.amountCredits,
      };

    case "twin.gift.completed":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "gift",
        status: "completed",
        occurredAt: event.occurredAt,
        amountCredits: event.amountCredits,
      };

    case "twin.voice.completed":
    case "twin.voice.refunded":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "voice",
        status:
          event.eventType === "twin.voice.refunded"
            ? "refunded"
            : "completed",
        occurredAt: event.occurredAt,
        amountCredits: event.amountCredits,
      };

    case "twin.owner-access.requested":
    case "twin.owner-access.accepted":
    case "twin.owner-access.scheduled":
    case "twin.owner-access.completed":
    case "twin.owner-access.refunded":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "owner-request",
        status:
          event.eventType === "twin.owner-access.requested" ||
          event.eventType === "twin.owner-access.accepted" ||
          event.eventType === "twin.owner-access.scheduled"
            ? "pending"
            : event.eventType === "twin.owner-access.refunded"
              ? "refunded"
              : "completed",
        occurredAt: event.occurredAt,
        amountCredits: event.amountCredits,
      };

    case "twin.earning.settled":
    case "twin.earning.reversed":
      return {
        eventId: event.eventId,
        tenantId: event.tenantId as never,
        characterId: event.characterId as never,
        kind: "earning",
        status:
          event.eventType === "twin.earning.reversed"
            ? "refunded"
            : "completed",
        occurredAt: event.occurredAt,
        amountCredits: event.amountCredits,
      };
  }
}

export function createTwinEconomyActivitySource(input: {
  readonly events: TwinEconomyActivityEventReader;
}): TwinActivitySource {
  return Object.freeze({
    async listForTwin(request) {
      const events = await input.events.listForCharacter({
        tenantId: request.tenantId,
        characterId: request.characterId,
        limit: request.limit,
      });

      const records: TwinActivityRecord[] = [];
      for (const event of events) {
        if (
          event.tenantId !== request.tenantId ||
          event.characterId !== request.characterId
        ) {
          throw new Error("Twin economy event reader returned out-of-scope event");
        }
        const mapped = mapEvent(event);
        if (mapped) records.push(mapped);
      }
      return Object.freeze(records.slice(0, request.limit));
    },
  });
}

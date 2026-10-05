import type {
  MyTwinActivitySummaryReader,
} from "./my_twin_projection_sources.js";

export type MyTwinEconomySummaryEventType =
  | "twin.visited"
  | "twin.conversation.observed"
  | "twin.owner-access.requested"
  | "twin.owner-access.accepted"
  | "twin.owner-access.scheduled"
  | "twin.owner-access.completed"
  | "twin.owner-access.refunded"
  | "twin.earning.settled"
  | "twin.earning.reversed";

export interface MyTwinEconomySummaryEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly ownerUserId: string;
  readonly characterId: string;
  readonly eventType: MyTwinEconomySummaryEventType;
  readonly amountCredits: number | null;
}

export interface MyTwinEconomySummaryEventReader {
  listForOwnerTwin(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly limit: number;
  }): Promise<readonly MyTwinEconomySummaryEvent[]>;
}

function amount(value: number | null): number {
  if (value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError("My Twin event amount is invalid");
  }
  return value;
}

export function createMyTwinEconomyPerformanceReader(input: {
  readonly events: MyTwinEconomySummaryEventReader;
  readonly limit?: number;
}): MyTwinActivitySummaryReader {
  const limit = input.limit ?? 1000;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new RangeError("My Twin summary event limit is invalid");
  }

  return Object.freeze({
    async readSummary(request) {
      const events = await input.events.listForOwnerTwin({
        ...request,
        limit,
      });

      let visitors = 0;
      let conversations = 0;
      let earningsCredits = 0;
      const pendingOwnerRequestIds = new Set<string>();

      for (const event of events) {
        if (
          event.tenantId !== request.tenantId ||
          event.ownerUserId !== request.ownerUserId ||
          event.characterId !== request.characterId
        ) {
          throw new Error("My Twin event source returned an out-of-scope event");
        }

        switch (event.eventType) {
          case "twin.visited":
            visitors += 1;
            break;
          case "twin.conversation.observed":
            conversations += 1;
            break;
          case "twin.earning.settled":
            earningsCredits += amount(event.amountCredits);
            break;
          case "twin.earning.reversed":
            earningsCredits = Math.max(
              0,
              earningsCredits - amount(event.amountCredits),
            );
            break;
          case "twin.owner-access.requested":
            pendingOwnerRequestIds.add(event.eventId);
            break;
          case "twin.owner-access.accepted":
          case "twin.owner-access.scheduled":
          case "twin.owner-access.completed":
          case "twin.owner-access.refunded":
            // These event IDs are operation-specific. A durable projection may
            // later carry a shared request reference; until then, only the
            // requested event contributes to the simple pending count.
            break;
        }
      }

      return Object.freeze({
        visitors,
        conversations,
        earningsCredits,
        pendingOwnerRequests: pendingOwnerRequestIds.size,
      });
    },
  });
}

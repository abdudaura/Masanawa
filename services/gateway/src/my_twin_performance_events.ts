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
  readonly referenceId: string;
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
      let settledEarningsCredits = 0;
      let reversedEarningsCredits = 0;
      const requestedOwnerRequestIds = new Set<string>();
      const resolvedOwnerRequestIds = new Set<string>();

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
            settledEarningsCredits += amount(event.amountCredits);
            break;
          case "twin.earning.reversed":
            reversedEarningsCredits += amount(event.amountCredits);
            break;
          case "twin.owner-access.requested":
            requestedOwnerRequestIds.add(event.referenceId);
            break;
          case "twin.owner-access.accepted":
          case "twin.owner-access.scheduled":
          case "twin.owner-access.completed":
          case "twin.owner-access.refunded":
            resolvedOwnerRequestIds.add(event.referenceId);
            break;
        }
      }

      let pendingOwnerRequests = 0;
      for (const referenceId of requestedOwnerRequestIds) {
        if (!resolvedOwnerRequestIds.has(referenceId)) {
          pendingOwnerRequests += 1;
        }
      }

      return Object.freeze({
        visitors,
        conversations,
        earningsCredits: Math.max(
          0,
          settledEarningsCredits - reversedEarningsCredits,
        ),
        pendingOwnerRequests,
      });
    },
  });
}

import type { WalletHistoryRecord } from "./wallet_projection.js";
import type { WalletHistorySubsource } from "./wallet_projection_sources.js";

export type TwinEconomyWalletEventType =
  | "twin.purchase.completed"
  | "twin.purchase.refunded"
  | "twin.gift.completed"
  | "twin.voice.completed"
  | "twin.voice.refunded"
  | "twin.owner-access.completed"
  | "twin.owner-access.refunded"
  | "twin.earning.settled"
  | "twin.earning.reversed";

export interface TwinEconomyWalletEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly ownerUserId: string;
  readonly eventType: TwinEconomyWalletEventType;
  readonly occurredAt: string;
  readonly amountCredits: number;
}

export interface TwinEconomyWalletEventReader {
  listForOwner(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly limit: number;
  }): Promise<readonly TwinEconomyWalletEvent[]>;
}

function mapEvent(event: TwinEconomyWalletEvent): WalletHistoryRecord {
  switch (event.eventType) {
    case "twin.purchase.completed":
      return {
        id: event.eventId,
        kind: "purchase",
        title: "Purchase through your twin",
        amountCredits: event.amountCredits,
        incoming: true,
        createdAt: event.occurredAt,
      };

    case "twin.purchase.refunded":
      return {
        id: event.eventId,
        kind: "refund",
        title: "Purchase commission reversed",
        amountCredits: event.amountCredits,
        incoming: false,
        createdAt: event.occurredAt,
      };

    case "twin.gift.completed":
      return {
        id: event.eventId,
        kind: "gift",
        title: "Gift received",
        amountCredits: event.amountCredits,
        incoming: true,
        createdAt: event.occurredAt,
      };

    case "twin.voice.completed":
      return {
        id: event.eventId,
        kind: "voice",
        title: "Twin voice earnings",
        amountCredits: event.amountCredits,
        incoming: true,
        createdAt: event.occurredAt,
      };

    case "twin.voice.refunded":
      return {
        id: event.eventId,
        kind: "refund",
        title: "Voice earnings reversed",
        amountCredits: event.amountCredits,
        incoming: false,
        createdAt: event.occurredAt,
      };

    case "twin.owner-access.completed":
      return {
        id: event.eventId,
        kind: "owner-session",
        title: "Owner session earnings",
        amountCredits: event.amountCredits,
        incoming: true,
        createdAt: event.occurredAt,
      };

    case "twin.owner-access.refunded":
      return {
        id: event.eventId,
        kind: "refund",
        title: "Owner session refunded",
        amountCredits: event.amountCredits,
        incoming: false,
        createdAt: event.occurredAt,
      };

    case "twin.earning.settled":
      return {
        id: event.eventId,
        kind: "commission",
        title: "Earning settled",
        amountCredits: event.amountCredits,
        incoming: true,
        createdAt: event.occurredAt,
      };

    case "twin.earning.reversed":
      return {
        id: event.eventId,
        kind: "refund",
        title: "Earning reversed",
        amountCredits: event.amountCredits,
        incoming: false,
        createdAt: event.occurredAt,
      };
  }
}

export function createTwinEconomyWalletHistorySource(input: {
  readonly events: TwinEconomyWalletEventReader;
}): WalletHistorySubsource {
  return Object.freeze<WalletHistorySubsource>({
    async list(request) {
      const events = await input.events.listForOwner({
        tenantId: request.tenantId,
        userId: request.userId,
        limit: request.limit,
      });

      const records: WalletHistoryRecord[] = [];
      for (const event of events) {
        if (
          event.tenantId !== request.tenantId ||
          event.ownerUserId !== request.userId
        ) {
          throw new Error("Twin economy Wallet event is out of owner scope");
        }
        records.push(mapEvent(event));
      }
      return Object.freeze(records.slice(0, request.limit));
    },
  });
}

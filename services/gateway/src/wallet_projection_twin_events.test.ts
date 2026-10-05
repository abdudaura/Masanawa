import { describe, expect, it } from "vitest";
import {
  createTwinEconomyWalletHistorySource,
  type TwinEconomyWalletEventReader,
} from "./wallet_projection_twin_events.js";

describe("twin economy Wallet history source", () => {
  it("maps shared economy events into the unified Wallet history", async () => {
    const events: TwinEconomyWalletEventReader = {
      async listForOwner() {
        return [
          {
            eventId: "event-gift",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            eventType: "twin.gift.completed",
            occurredAt: "2026-10-05T09:00:00Z",
            amountCredits: 100,
          },
          {
            eventId: "event-owner",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            eventType: "twin.owner-access.completed",
            occurredAt: "2026-10-05T10:00:00Z",
            amountCredits: 900,
          },
        ];
      },
    };

    const records = await createTwinEconomyWalletHistorySource({ events }).list({
      tenantId: "tenant-1",
      userId: "user-owner",
      limit: 50,
    });

    expect(records.map((record) => record.kind)).toEqual([
      "gift",
      "owner-session",
    ]);
    expect(records[1]?.incoming).toBe(true);
  });

  it("rejects another owner's events", async () => {
    const events: TwinEconomyWalletEventReader = {
      async listForOwner() {
        return [
          {
            eventId: "event-bad",
            tenantId: "tenant-1",
            ownerUserId: "user-other",
            eventType: "twin.earning.settled",
            occurredAt: "2026-10-05T09:00:00Z",
            amountCredits: 100,
          },
        ];
      },
    };

    await expect(
      createTwinEconomyWalletHistorySource({ events }).list({
        tenantId: "tenant-1",
        userId: "user-owner",
        limit: 50,
      }),
    ).rejects.toThrow("owner scope");
  });
});

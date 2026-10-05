import { describe, expect, it } from "vitest";
import {
  createMyTwinEconomyPerformanceReader,
  type MyTwinEconomySummaryEventReader,
} from "./my_twin_performance_events.js";

describe("My Twin economy performance reader", () => {
  it("derives the compact summary from privacy-safe economy events", async () => {
    const events: MyTwinEconomySummaryEventReader = {
      async listForOwnerTwin() {
        return [
          {
            eventId: "visit-1",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.visited",
            referenceId: "visit-1",
            amountCredits: null,
          },
          {
            eventId: "chat-1",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.conversation.observed",
            referenceId: "chat-1",
            amountCredits: null,
          },
          {
            eventId: "earning-1",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.earning.settled",
            referenceId: "earning-1",
            amountCredits: 500,
          },
          {
            eventId: "owner-request-1",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.owner-access.requested",
            referenceId: "owner-request-1",
            amountCredits: 1000,
          },
        ];
      },
    };

    const summary = await createMyTwinEconomyPerformanceReader({ events }).readSummary({
      tenantId: "tenant-1",
      ownerUserId: "user-owner",
      characterId: "character-1",
    });

    expect(summary).toEqual({
      visitors: 1,
      conversations: 1,
      earningsCredits: 500,
      pendingOwnerRequests: 1,
    });
  });

  it("fails closed on another owner/twin event", async () => {
    const events: MyTwinEconomySummaryEventReader = {
      async listForOwnerTwin() {
        return [
          {
            eventId: "visit-bad",
            tenantId: "tenant-1",
            ownerUserId: "user-other",
            characterId: "character-1",
            eventType: "twin.visited",
            referenceId: "visit-1",
            amountCredits: null,
          },
        ];
      },
    };

    await expect(
      createMyTwinEconomyPerformanceReader({ events }).readSummary({
        tenantId: "tenant-1",
        ownerUserId: "user-owner",
        characterId: "character-1",
      }),
    ).rejects.toThrow("out-of-scope");
  });

  it("removes accepted owner requests from the pending count by shared reference", async () => {
    const events: MyTwinEconomySummaryEventReader = {
      async listForOwnerTwin() {
        return [
          {
            eventId: "event-request",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.owner-access.requested",
            referenceId: "owner-request-42",
            amountCredits: 1000,
          },
          {
            eventId: "event-accepted",
            tenantId: "tenant-1",
            ownerUserId: "user-owner",
            characterId: "character-1",
            eventType: "twin.owner-access.accepted",
            referenceId: "owner-request-42",
            amountCredits: null,
          },
        ];
      },
    };

    const summary = await createMyTwinEconomyPerformanceReader({ events }).readSummary({
      tenantId: "tenant-1",
      ownerUserId: "user-owner",
      characterId: "character-1",
    });

    expect(summary.pendingOwnerRequests).toBe(0);
  });

});

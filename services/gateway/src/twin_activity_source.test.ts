import { describe, expect, it } from "vitest";
import {
  createTwinEconomyActivitySource,
  type TwinEconomyActivityEventReader,
} from "./twin_activity_source.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

describe("twin economy Activity source", () => {
  it("maps shared economic events into the privacy-safe Activity vocabulary", async () => {
    const events: TwinEconomyActivityEventReader = {
      async listForCharacter() {
        return [
          {
            eventId: "event-visit",
            tenantId,
            characterId,
            eventType: "twin.visited",
            occurredAt: "2026-10-05T09:00:00Z",
            amountCredits: null,
            status: "observed",
          },
          {
            eventId: "event-gift",
            tenantId,
            characterId,
            eventType: "twin.gift.completed",
            occurredAt: "2026-10-05T09:01:00Z",
            amountCredits: 100,
            status: "completed",
          },
          {
            eventId: "event-owner",
            tenantId,
            characterId,
            eventType: "twin.owner-access.requested",
            occurredAt: "2026-10-05T09:02:00Z",
            amountCredits: 500,
            status: "pending",
          },
        ];
      },
    };

    const records = await createTwinEconomyActivitySource({ events }).listForTwin({
      tenantId,
      characterId,
      limit: 50,
    });

    expect(records.map((record) => record.kind)).toEqual([
      "visit",
      "gift",
      "owner-request",
    ]);
    expect(records[1]?.amountCredits).toBe(100);
    expect(records[2]?.status).toBe("pending");
    expect(JSON.stringify(records)).not.toContain("transcript");
  });

  it("rejects cross-twin events instead of leaking them", async () => {
    const events: TwinEconomyActivityEventReader = {
      async listForCharacter() {
        return [
          {
            eventId: "event-bad",
            tenantId,
            characterId:
              "character_00000000-0000-4000-8000-000000000099",
            eventType: "twin.visited",
            occurredAt: "2026-10-05T09:00:00Z",
            amountCredits: null,
            status: "observed",
          },
        ];
      },
    };

    await expect(
      createTwinEconomyActivitySource({ events }).listForTwin({
        tenantId,
        characterId,
        limit: 50,
      }),
    ).rejects.toThrow("out-of-scope");
  });

  it("keeps accepted and scheduled owner access pending in Activity", async () => {
    const events: TwinEconomyActivityEventReader = {
      async listForCharacter() {
        return [
          {
            eventId: "event-accepted",
            tenantId,
            characterId,
            eventType: "twin.owner-access.accepted",
            occurredAt: "2026-10-05T09:02:00Z",
            amountCredits: null,
            status: "pending",
          },
          {
            eventId: "event-scheduled",
            tenantId,
            characterId,
            eventType: "twin.owner-access.scheduled",
            occurredAt: "2026-10-05T09:03:00Z",
            amountCredits: null,
            status: "pending",
          },
        ];
      },
    };

    const records = await createTwinEconomyActivitySource({ events }).listForTwin({
      tenantId,
      characterId,
      limit: 50,
    });

    expect(records.map((record) => record.status)).toEqual([
      "pending",
      "pending",
    ]);
  });

});

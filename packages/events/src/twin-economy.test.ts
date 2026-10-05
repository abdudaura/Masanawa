import { describe, expect, it } from "vitest";
import {
  assertNoTwinTranscriptFields,
  createTwinEconomyEvent,
  normalizeTwinEconomyEvent,
} from "./twin-economy.js";

describe("twin economy events", () => {
  it("creates a privacy-safe gift event", () => {
    const event = createTwinEconomyEvent({
      eventType: "twin.gift.completed",
      ownerUserId: "user-owner",
      characterId: "character-owner",
      customerUserId: "user-customer",
      referenceId: "gift-1",
      visibility: "owner",
      occurredAt: "2026-10-05T09:00:00Z" as never,
      amountCredits: 100,
      status: "completed",
    });

    expect(event.summaryCode).toBe("gift_received");
    expect(event.amountCredits).toBe(100);
    expect(JSON.stringify(event)).not.toContain("transcript");
  });

  it("keeps visit events money-free", () => {
    expect(() =>
      createTwinEconomyEvent({
        eventType: "twin.visited",
        ownerUserId: "user-owner",
        characterId: "character-owner",
        customerUserId: "user-customer",
        referenceId: "visit-1",
        visibility: "owner",
        occurredAt: "2026-10-05T09:00:00Z" as never,
        amountCredits: 1,
        status: "observed",
      }),
    ).toThrow("must not contain money");
  });

  it("requires money on economic completion/refund events", () => {
    expect(() =>
      createTwinEconomyEvent({
        eventType: "twin.earning.settled",
        ownerUserId: "user-owner",
        characterId: "character-owner",
        customerUserId: null,
        referenceId: "earning-1",
        visibility: "owner",
        occurredAt: "2026-10-05T09:00:00Z" as never,
        amountCredits: null,
        status: "completed",
      }),
    ).toThrow("amountCredits is required");
  });

  it("rejects a mismatched stable summary code", () => {
    expect(() =>
      normalizeTwinEconomyEvent({
        schemaVersion: 1,
        eventType: "twin.gift.completed",
        ownerUserId: "user-owner",
        characterId: "character-owner",
        customerUserId: "user-customer",
        referenceId: "gift-1",
        visibility: "owner",
        occurredAt: "2026-10-05T09:00:00Z" as never,
        amountCredits: 100,
        status: "completed",
        summaryCode: "raw_message",
      }),
    ).toThrow("summaryCode");
  });

  it("explicitly rejects raw conversation-shaped fields", () => {
    expect(() =>
      assertNoTwinTranscriptFields({
        eventType: "twin.conversation.observed",
        transcript: "private conversation",
      }),
    ).toThrow("raw conversation");
  });
  it("rejects contradictory event status", () => {
    expect(() =>
      createTwinEconomyEvent({
        eventType: "twin.gift.completed",
        ownerUserId: "user-owner",
        characterId: "character-owner",
        customerUserId: "user-customer",
        referenceId: "gift-2",
        visibility: "owner",
        occurredAt: "2026-10-05T09:00:00Z" as never,
        amountCredits: 100,
        status: "refunded",
      }),
    ).toThrow("status does not match");
  });

});

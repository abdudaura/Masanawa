import { describe, expect, it } from "vitest";
import { normalizeOwnerAccessOffering, priceOwnerAccessOffering } from "./owner-access-offering.js";
import { verifyOwnerAccessCompletion } from "./owner-access-evidence.js";

const policy = {
  schemaVersion: 1 as const,
  revision: 1,
  enabled: true,
  minDurationMinutes: 10,
  maxDurationMinutes: 60,
  minPriceCredits: 100,
  maxPriceCredits: 10000,
  platformFeeBasisPoints: 1000,
  acceptWithinMinutes: 60,
  startGraceMinutes: 10,
};

describe("owner access offering and evidence", () => {
  it("lets the owner choose simple bounded chat options", () => {
    const offering = normalizeOwnerAccessOffering({
      policy,
      offering: {
        schemaVersion: 1,
        ownerUserId: "user-owner",
        characterId: "character-owner",
        revision: 1,
        enabled: true,
        modalities: ["text", "voice"],
        durationOptionsMinutes: [15, 30],
        priceCreditsPerMinute: 20,
      },
    });
    expect(
      priceOwnerAccessOffering({
        offering,
        modality: "voice",
        durationMinutes: 30,
      }),
    ).toBe(600);
  });

  it("rejects owner pricing outside platform bounds", () => {
    expect(() =>
      normalizeOwnerAccessOffering({
        policy,
        offering: {
          schemaVersion: 1,
          ownerUserId: "user-owner",
          characterId: "character-owner",
          revision: 1,
          enabled: true,
          modalities: ["voice"],
          durationOptionsMinutes: [15],
          priceCreditsPerMinute: 1000,
        },
      }),
    ).toThrow("outside platform bounds");
  });

  it("requires both people and enough verified conversation time", () => {
    expect(
      verifyOwnerAccessCompletion({
        evidence: {
          source: "in-app-session",
          sessionReference: "session-12345",
          requesterPresent: true,
          ownerPresent: true,
          verifiedSeconds: 180,
          capturedAt: "2026-10-05T10:30:00Z",
        },
        minimumVerifiedSeconds: 120,
      }),
    ).toBe(true);

    expect(
      verifyOwnerAccessCompletion({
        evidence: {
          source: "in-app-session",
          sessionReference: "session-12345",
          requesterPresent: true,
          ownerPresent: false,
          verifiedSeconds: 180,
          capturedAt: "2026-10-05T10:30:00Z",
        },
        minimumVerifiedSeconds: 120,
      }),
    ).toBe(false);
  });
});

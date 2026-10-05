import { describe, expect, it } from "vitest";
import {
  evaluateTwinSafetyRelationship,
  normalizeTwinReport,
} from "./twin-economy-social-safety.js";
import { evaluateTwinEconomyLaunchEligibility } from "./twin-economy-eligibility.js";

describe("twin social/economy launch safety", () => {
  it("block state removes discovery, chat and owner access", () => {
    expect(
      evaluateTwinSafetyRelationship({
        viewerUserId: "user-a",
        ownerUserId: "user-b",
        viewerBlockedOwner: true,
        ownerBlockedViewer: false,
        ownerSuspended: false,
        twinDiscoverable: true,
        ownerAccessEnabled: true,
      }),
    ).toEqual({
      canDiscover: false,
      canChat: false,
      canRequestOwner: false,
      reason: "blocked",
    });
  });

  it("private twin is hidden from Explore without making direct authorized chat impossible", () => {
    const decision = evaluateTwinSafetyRelationship({
      viewerUserId: "user-a",
      ownerUserId: "user-b",
      viewerBlockedOwner: false,
      ownerBlockedViewer: false,
      ownerSuspended: false,
      twinDiscoverable: false,
      ownerAccessEnabled: true,
    });
    expect(decision.canDiscover).toBe(false);
    expect(decision.canChat).toBe(true);
  });

  it("normalizes a bounded report without inventing moderation outcome", () => {
    const report = normalizeTwinReport({
      reporterUserId: "user-a",
      characterId: "character-b",
      reason: "impersonation",
      detail: "This twin is pretending to be someone else.",
      createdAt: "2026-10-05T10:00:00Z",
    });
    expect(report.reason).toBe("impersonation");
  });

  it("allows basic product use while gating sensitive earning actions", () => {
    const decision = evaluateTwinEconomyLaunchEligibility({
      userId: "user-a",
      ageDeclaredAdult: false,
      identityTier: "unverified",
      accountRestricted: false,
      canReceiveEarnings: true,
      canWithdrawEarnings: true,
      canOfferOwnerAccess: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.canWithdrawEarnings).toBe(false);
    expect(decision.canOfferOwnerAccess).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  decideOwnerAccessSettlement,
  quoteOwnerAccess,
  transitionOwnerAccess,
} from "./owner-access.js";

const policy = {
  schemaVersion: 1 as const,
  revision: 2,
  enabled: true,
  minDurationMinutes: 10,
  maxDurationMinutes: 60,
  minPriceCredits: 100,
  maxPriceCredits: 10000,
  platformFeeBasisPoints: 1000,
  acceptWithinMinutes: 60,
  startGraceMinutes: 10,
};

describe("owner access", () => {
  it("quotes zero during an eligible seven-day trial", () => {
    const quote = quoteOwnerAccess({
      policy,
      requestId: "owner-request-1",
      ownerUserId: "user-owner",
      originatingCharacterId: "character-1",
      modality: "voice",
      durationMinutes: 20,
      requestedPriceCredits: 1000,
      chargeMode: "trial",
      trialDurationDays: 7,
      trialPolicyRevision: 1,
      quoteExpiresAt: "2026-10-05T10:00:00Z",
    });
    expect(quote.priceCredits).toBe(0);
    expect(quote.ownerEarningCredits).toBe(0);
    expect(quote.trialDurationDays).toBe(7);
  });

  it("splits paid owner access by configured platform fee", () => {
    const quote = quoteOwnerAccess({
      policy,
      requestId: "owner-request-2",
      ownerUserId: "user-owner",
      originatingCharacterId: "character-1",
      modality: "text",
      durationMinutes: 30,
      requestedPriceCredits: 1000,
      chargeMode: "paid",
      trialDurationDays: 7,
      trialPolicyRevision: 1,
      quoteExpiresAt: "2026-10-05T10:00:00Z",
    });
    expect(quote.platformFeeCredits).toBe(100);
    expect(quote.ownerEarningCredits).toBe(900);
  });

  it("rejects illegal state jumps", () => {
    expect(() => transitionOwnerAccess("requested", "completed")).toThrow(
      "Invalid owner access transition",
    );
  });

  it("settles only after verified completion", () => {
    expect(
      decideOwnerAccessSettlement({
        state: "completed",
        chargeMode: "paid",
        reservedCredits: 1000,
        ownerEarningCredits: 900,
        platformFeeCredits: 100,
        attendanceVerified: true,
        completionVerified: true,
      }),
    ).toEqual({
      disposition: "settle",
      customerChargeCredits: 1000,
      ownerEarningCredits: 900,
      platformRevenueCredits: 100,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  });

  it("refunds paid reservation when owner declines", () => {
    const decision = decideOwnerAccessSettlement({
      state: "declined",
      chargeMode: "paid",
      reservedCredits: 1000,
      ownerEarningCredits: 900,
      platformFeeCredits: 100,
      attendanceVerified: false,
      completionVerified: false,
    });
    expect(decision.disposition).toBe("refund");
    expect(decision.refundCredits).toBe(1000);
  });

  it("does not pay anyone for a trial session", () => {
    const decision = decideOwnerAccessSettlement({
      state: "completed",
      chargeMode: "trial",
      reservedCredits: 0,
      ownerEarningCredits: 0,
      platformFeeCredits: 0,
      attendanceVerified: true,
      completionVerified: true,
    });
    expect(decision.customerChargeCredits).toBe(0);
    expect(decision.ownerEarningCredits).toBe(0);
    expect(decision.trialUnitsConsumed).toBe(1);
  });
});

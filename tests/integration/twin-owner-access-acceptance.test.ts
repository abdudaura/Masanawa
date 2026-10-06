import { describe, expect, it } from "vitest";
import {
  decideOwnerAccessSettlement,
  quoteOwnerAccess,
  transitionOwnerAccess,
  type OwnerAccessPolicy,
} from "../../packages/commerce/src/owner-access.js";

const policy: OwnerAccessPolicy = {
  schemaVersion: 1,
  revision: 5,
  enabled: true,
  minDurationMinutes: 10,
  maxDurationMinutes: 60,
  minPriceCredits: 20,
  maxPriceCredits: 500,
  platformFeeBasisPoints: 2000,
  acceptWithinMinutes: 30,
  startGraceMinutes: 10,
};

describe("TWIN-105 paid owner-access acceptance", () => {
  it("quotes paid owner access from bounded server policy and settles only verified completion", () => {
    const quote = quoteOwnerAccess({
      policy,
      requestId: "owner-request-paid-001",
      ownerUserId: "user-owner",
      originatingCharacterId: "character-owner-twin",
      modality: "voice",
      durationMinutes: 30,
      requestedPriceCredits: 100,
      chargeMode: "paid",
      trialDurationDays: 7,
      trialPolicyRevision: 3,
      quoteExpiresAt: "2026-10-06T10:10:00.000Z",
    });

    expect(quote).toMatchObject({
      priceCredits: 100,
      platformFeeCredits: 20,
      ownerEarningCredits: 80,
      chargeMode: "paid",
      policyRevision: 5,
      trialPolicyRevision: 3,
    });

    let state = transitionOwnerAccess("requested", "accepted");
    state = transitionOwnerAccess(state, "scheduled");
    state = transitionOwnerAccess(state, "active");
    state = transitionOwnerAccess(state, "completed");

    const settlement = decideOwnerAccessSettlement({
      state,
      chargeMode: quote.chargeMode,
      reservedCredits: quote.priceCredits,
      ownerEarningCredits: quote.ownerEarningCredits,
      platformFeeCredits: quote.platformFeeCredits,
      attendanceVerified: true,
      completionVerified: true,
    });

    expect(settlement).toEqual({
      disposition: "settle",
      customerChargeCredits: 100,
      ownerEarningCredits: 80,
      platformRevenueCredits: 20,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  });

  it("does not settle a completed request without attendance and completion evidence", () => {
    const settlement = decideOwnerAccessSettlement({
      state: "completed",
      chargeMode: "paid",
      reservedCredits: 100,
      ownerEarningCredits: 80,
      platformFeeCredits: 20,
      attendanceVerified: false,
      completionVerified: true,
    });

    expect(settlement).toEqual({
      disposition: "none",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  });

  it.each(["declined", "expired", "cancelled", "no-show"] as const)(
    "refunds the full paid reservation when the request is %s",
    (state) => {
      const settlement = decideOwnerAccessSettlement({
        state,
        chargeMode: "paid",
        reservedCredits: 100,
        ownerEarningCredits: 80,
        platformFeeCredits: 20,
        attendanceVerified: false,
        completionVerified: false,
      });

      expect(settlement).toEqual({
        disposition: "refund",
        customerChargeCredits: 0,
        ownerEarningCredits: 0,
        platformRevenueCredits: 0,
        refundCredits: 100,
        trialUnitsConsumed: 0,
      });
    },
  );

  it("keeps disputed completion in reconciliation with no premature charge", () => {
    const settlement = decideOwnerAccessSettlement({
      state: "disputed",
      chargeMode: "paid",
      reservedCredits: 100,
      ownerEarningCredits: 80,
      platformFeeCredits: 20,
      attendanceVerified: true,
      completionVerified: true,
    });

    expect(settlement).toEqual({
      disposition: "reconcile",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  });

  it("consumes exactly one owner-access trial unit only after verified completion", () => {
    const quote = quoteOwnerAccess({
      policy,
      requestId: "owner-request-trial-001",
      ownerUserId: "user-owner",
      originatingCharacterId: "character-owner-twin",
      modality: "text",
      durationMinutes: 15,
      requestedPriceCredits: 50,
      chargeMode: "trial",
      trialDurationDays: 7,
      trialPolicyRevision: 4,
      quoteExpiresAt: "2026-10-06T10:10:00.000Z",
    });

    expect(quote.priceCredits).toBe(0);
    expect(quote.ownerEarningCredits).toBe(0);
    expect(quote.platformFeeCredits).toBe(0);

    const settlement = decideOwnerAccessSettlement({
      state: "completed",
      chargeMode: "trial",
      reservedCredits: 0,
      ownerEarningCredits: 0,
      platformFeeCredits: 0,
      attendanceVerified: true,
      completionVerified: true,
    });

    expect(settlement).toEqual({
      disposition: "settle",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
      trialUnitsConsumed: 1,
    });
  });

  it("rejects invalid lifecycle shortcuts and mismatched paid settlement totals", () => {
    expect(() =>
      transitionOwnerAccess("requested", "completed"),
    ).toThrow("Invalid owner access transition");

    expect(() =>
      decideOwnerAccessSettlement({
        state: "completed",
        chargeMode: "paid",
        reservedCredits: 100,
        ownerEarningCredits: 70,
        platformFeeCredits: 20,
        attendanceVerified: true,
        completionVerified: true,
      }),
    ).toThrow("does not match reserved amount");
  });
});

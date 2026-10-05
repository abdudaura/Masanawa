import { describe, expect, it } from "vitest";
import { settleVerifiedTwinVoiceUsage } from "./voice-settlement.js";

describe("verified twin voice settlement", () => {
  it("never charges trial-covered usage", () => {
    expect(
      settleVerifiedTwinVoiceUsage({
        admissionId: "voice-admission-1",
        outcome: "completed",
        verifiedSeconds: 125,
        trialCovered: true,
        unitSeconds: 60,
        priceCreditsPerUnit: 3,
        ownerShareBasisPoints: 3000,
      }),
    ).toEqual({
      disposition: "settle",
      usageUnits: 3,
      trialUnitsConsumed: 3,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  });

  it("charges only verified units and splits paid revenue deterministically", () => {
    expect(
      settleVerifiedTwinVoiceUsage({
        admissionId: "voice-admission-2",
        outcome: "interrupted",
        verifiedSeconds: 125,
        trialCovered: false,
        unitSeconds: 60,
        priceCreditsPerUnit: 10,
        ownerShareBasisPoints: 3000,
      }),
    ).toEqual({
      disposition: "settle",
      usageUnits: 3,
      trialUnitsConsumed: 0,
      customerChargeCredits: 30,
      ownerEarningCredits: 9,
      platformRevenueCredits: 21,
      refundCredits: 0,
    });
  });

  it("requires reconciliation instead of guessing ambiguous usage", () => {
    const decision = settleVerifiedTwinVoiceUsage({
      admissionId: "voice-admission-3",
      outcome: "ambiguous",
      verifiedSeconds: 120,
      trialCovered: false,
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 3000,
    });
    expect(decision.disposition).toBe("reconcile");
    expect(decision.customerChargeCredits).toBe(0);
  });

  it("does not consume trial or charge if media never started", () => {
    const decision = settleVerifiedTwinVoiceUsage({
      admissionId: "voice-admission-4",
      outcome: "failed-before-media",
      verifiedSeconds: 0,
      trialCovered: true,
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 3000,
    });
    expect(decision.usageUnits).toBe(0);
    expect(decision.trialUnitsConsumed).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultPaidFeatureTrialPolicy,
} from "../../packages/commerce/src/trial.js";
import {
  quoteTwinVoice,
  type TwinVoicePricingPolicy,
} from "../../packages/commerce/src/voice-product.js";
import {
  settleVerifiedTwinVoiceUsage,
} from "../../packages/commerce/src/voice-settlement.js";
import {
  admitTwinInteraction,
} from "../../services/gateway/src/twin_chat_admission.js";

const userId = "user_00000000-0000-4000-8000-000000000001";
const characterId = "character_00000000-0000-4000-8000-000000000002";
const now = "2026-10-06T10:00:00.000Z";

function policy(): TwinVoicePricingPolicy {
  return {
    schemaVersion: 1,
    revision: 7,
    active: true,
    unitSeconds: 60,
    priceCreditsPerUnit: 4,
    ownerShareBasisPoints: 2500,
    trial: defaultPaidFeatureTrialPolicy(
      "twin-voice",
      "2026-10-01T00:00:00.000Z",
    ),
  };
}

describe("TWIN-104 paid Twin voice acceptance", () => {
  it("quotes and settles eligible trial voice at zero charge", () => {
    const quote = quoteTwinVoice({
      policy: policy(),
      usage: { trialStartedAt: null, trialConsumedUnits: 0 },
      expectedSeconds: 125,
      now,
    });

    expect(quote).toMatchObject({
      chargeMode: "trial",
      estimatedUnits: 3,
      estimatedPriceCredits: 0,
      trialDurationDays: 7,
      policyRevision: 7,
    });

    const admission = admitTwinInteraction({
      interaction: "live-voice",
      userId,
      characterId,
      now: "2026-10-06T10:00:05.000Z",
      paidAdmission: {
        admissionId: "voice-admission-trial-001",
        userId,
        characterId,
        chargeMode: "trial",
        admittedAt: "2026-10-06T10:00:01.000Z",
        expiresAt: "2026-10-06T10:15:00.000Z",
      },
    });

    expect(admission.chargeMode).toBe("trial");

    const settlement = settleVerifiedTwinVoiceUsage({
      admissionId: admission.paidAdmissionId!,
      outcome: "completed",
      verifiedSeconds: 121,
      trialCovered: true,
      unitSeconds: 60,
      priceCreditsPerUnit: 4,
      ownerShareBasisPoints: 2500,
      reservedCredits: 0,
    });

    expect(settlement).toEqual({
      disposition: "settle",
      usageUnits: 3,
      trialUnitsConsumed: 3,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  });

  it("settles paid verified usage from the reservation and refunds unused reserve", () => {
    const quote = quoteTwinVoice({
      policy: policy(),
      usage: {
        trialStartedAt: "2026-09-20T10:00:00.000Z",
        trialConsumedUnits: 0,
      },
      expectedSeconds: 180,
      now,
    });

    expect(quote.chargeMode).toBe("paid");
    expect(quote.estimatedUnits).toBe(3);
    expect(quote.estimatedPriceCredits).toBe(12);

    const admission = admitTwinInteraction({
      interaction: "voice-note",
      userId,
      characterId,
      now: "2026-10-06T10:00:05.000Z",
      paidAdmission: {
        admissionId: "voice-admission-paid-001",
        userId,
        characterId,
        chargeMode: "paid",
        admittedAt: "2026-10-06T10:00:01.000Z",
        expiresAt: "2026-10-06T10:15:00.000Z",
      },
    });

    const settlement = settleVerifiedTwinVoiceUsage({
      admissionId: admission.paidAdmissionId!,
      outcome: "completed",
      verifiedSeconds: 61,
      trialCovered: false,
      unitSeconds: 60,
      priceCreditsPerUnit: 4,
      ownerShareBasisPoints: 2500,
      reservedCredits: quote.estimatedPriceCredits,
    });

    expect(settlement).toEqual({
      disposition: "settle",
      usageUnits: 2,
      trialUnitsConsumed: 0,
      customerChargeCredits: 8,
      ownerEarningCredits: 2,
      platformRevenueCredits: 6,
      refundCredits: 4,
    });
  });

  it("requires reconciliation for ambiguous provider usage instead of charging", () => {
    const settlement = settleVerifiedTwinVoiceUsage({
      admissionId: "voice-admission-ambiguous-001",
      outcome: "ambiguous",
      verifiedSeconds: 90,
      trialCovered: false,
      unitSeconds: 60,
      priceCreditsPerUnit: 4,
      ownerShareBasisPoints: 2500,
      reservedCredits: 12,
    });

    expect(settlement).toEqual({
      disposition: "reconcile",
      usageUnits: 0,
      trialUnitsConsumed: 0,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  });

  it("requires reconciliation when verified paid usage exceeds the reserved spend cap", () => {
    const settlement = settleVerifiedTwinVoiceUsage({
      admissionId: "voice-admission-overage-001",
      outcome: "completed",
      verifiedSeconds: 181,
      trialCovered: false,
      unitSeconds: 60,
      priceCreditsPerUnit: 4,
      ownerShareBasisPoints: 2500,
      reservedCredits: 12,
    });

    expect(settlement.disposition).toBe("reconcile");
    expect(settlement.customerChargeCredits).toBe(0);
    expect(settlement.ownerEarningCredits).toBe(0);
    expect(settlement.platformRevenueCredits).toBe(0);
  });

  it("does not let a paid voice admission change the free-text charging rule", () => {
    const textAdmission = admitTwinInteraction({
      interaction: "text-message",
      userId,
      characterId,
      now,
      paidAdmission: {
        admissionId: "voice-admission-paid-ignored-for-text",
        userId,
        characterId,
        chargeMode: "paid",
        admittedAt: "2026-10-06T09:59:00.000Z",
        expiresAt: "2026-10-06T10:15:00.000Z",
      },
    });

    expect(textAdmission).toEqual({
      interaction: "text-message",
      chargeMode: "free",
      chargeCredits: 0,
      paidAdmissionId: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  settleVerifiedTwinVoiceUsage,
  type TwinVoiceSettlementDecision,
  type TwinVoiceVerifiedUsage,
} from "../../packages/commerce/src/voice-settlement.js";

interface EconomicTotals {
  customerChargeCredits: number;
  ownerEarningCredits: number;
  platformRevenueCredits: number;
  refundCredits: number;
  trialUnitsConsumed: number;
}

class ReplaySafeVoiceSettlementPort {
  readonly #receipts = new Map<
    string,
    { fingerprint: string; decision: TwinVoiceSettlementDecision }
  >();

  readonly totals: EconomicTotals = {
    customerChargeCredits: 0,
    ownerEarningCredits: 0,
    platformRevenueCredits: 0,
    refundCredits: 0,
    trialUnitsConsumed: 0,
  };

  apply(input: {
    admissionId: string;
    decision: TwinVoiceSettlementDecision;
  }): { duplicate: boolean } {
    const fingerprint = JSON.stringify(input.decision);
    const existing = this.#receipts.get(input.admissionId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("voice settlement replay fingerprint conflict");
      }
      return { duplicate: true };
    }

    if (input.decision.disposition !== "settle") {
      throw new Error("reconciliation decisions cannot post economic effects");
    }

    this.totals.customerChargeCredits += input.decision.customerChargeCredits;
    this.totals.ownerEarningCredits += input.decision.ownerEarningCredits;
    this.totals.platformRevenueCredits += input.decision.platformRevenueCredits;
    this.totals.refundCredits += input.decision.refundCredits;
    this.totals.trialUnitsConsumed += input.decision.trialUnitsConsumed;

    this.#receipts.set(input.admissionId, { fingerprint, decision: input.decision });
    return { duplicate: false };
  }
}

function paidUsage(
  overrides: Partial<TwinVoiceVerifiedUsage> = {},
): TwinVoiceVerifiedUsage {
  return {
    admissionId: "voice-admission-0001",
    outcome: "completed",
    verifiedSeconds: 75,
    trialCovered: false,
    unitSeconds: 60,
    priceCreditsPerUnit: 10,
    ownerShareBasisPoints: 7000,
    reservedCredits: 30,
    ...overrides,
  };
}

describe("TWIN-106 paid-voice retry recovery acceptance", () => {
  it("does not duplicate economic effects when the caller crashes after settlement", () => {
    const port = new ReplaySafeVoiceSettlementPort();
    const usage = paidUsage();
    const decision = settleVerifiedTwinVoiceUsage(usage);

    expect(decision).toEqual({
      disposition: "settle",
      usageUnits: 2,
      trialUnitsConsumed: 0,
      customerChargeCredits: 20,
      ownerEarningCredits: 14,
      platformRevenueCredits: 6,
      refundCredits: 10,
    });

    expect(port.apply({ admissionId: usage.admissionId, decision })).toEqual({
      duplicate: false,
    });

    const retryDecision = settleVerifiedTwinVoiceUsage(usage);
    expect(
      port.apply({
        admissionId: usage.admissionId,
        decision: retryDecision,
      }),
    ).toEqual({ duplicate: true });

    expect(port.totals).toEqual({
      customerChargeCredits: 20,
      ownerEarningCredits: 14,
      platformRevenueCredits: 6,
      refundCredits: 10,
      trialUnitsConsumed: 0,
    });
  });

  it("fails closed when the same admission is retried with changed usage", () => {
    const port = new ReplaySafeVoiceSettlementPort();
    const first = paidUsage();

    port.apply({
      admissionId: first.admissionId,
      decision: settleVerifiedTwinVoiceUsage(first),
    });

    const changed = paidUsage({ verifiedSeconds: 130 });
    expect(() =>
      port.apply({
        admissionId: changed.admissionId,
        decision: settleVerifiedTwinVoiceUsage(changed),
      }),
    ).toThrow("fingerprint conflict");

    expect(port.totals.customerChargeCredits).toBe(20);
  });

  it("never posts money for ambiguous provider usage", () => {
    const port = new ReplaySafeVoiceSettlementPort();
    const usage = paidUsage({
      admissionId: "voice-admission-ambiguous",
      outcome: "ambiguous",
    });
    const decision = settleVerifiedTwinVoiceUsage(usage);

    expect(decision).toMatchObject({
      disposition: "reconcile",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });

    expect(() =>
      port.apply({ admissionId: usage.admissionId, decision }),
    ).toThrow("reconciliation decisions cannot post");
    expect(port.totals).toEqual({
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  });

  it("consumes trial usage once across the same crash/retry boundary", () => {
    const port = new ReplaySafeVoiceSettlementPort();
    const usage = paidUsage({
      admissionId: "voice-admission-trial",
      trialCovered: true,
      reservedCredits: 0,
    });
    const decision = settleVerifiedTwinVoiceUsage(usage);

    expect(decision).toMatchObject({
      disposition: "settle",
      usageUnits: 2,
      trialUnitsConsumed: 2,
      customerChargeCredits: 0,
    });

    expect(port.apply({ admissionId: usage.admissionId, decision })).toEqual({
      duplicate: false,
    });
    expect(
      port.apply({
        admissionId: usage.admissionId,
        decision: settleVerifiedTwinVoiceUsage(usage),
      }),
    ).toEqual({ duplicate: true });

    expect(port.totals.trialUnitsConsumed).toBe(2);
    expect(port.totals.customerChargeCredits).toBe(0);
  });

  it("does not charge or consume trial units when media never started", () => {
    const usage = paidUsage({
      admissionId: "voice-admission-no-media",
      outcome: "failed-before-media",
      verifiedSeconds: 0,
      trialCovered: true,
      reservedCredits: 20,
    });

    expect(settleVerifiedTwinVoiceUsage(usage)).toEqual({
      disposition: "settle",
      usageUnits: 0,
      trialUnitsConsumed: 0,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  });
});

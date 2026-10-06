import { describe, expect, it } from "vitest";
import {
  applyFutureEarningsOffset,
  decideTwinEconomyRecovery,
  normalizeTwinEconomyRecoveryPolicy,
  type TwinEconomyRecoveryPolicy,
} from "./twin-economy-recovery.js";

const policy: TwinEconomyRecoveryPolicy = {
  revision: 1,
  maxNegativeBalanceCredits: 5_000,
  offsetFutureEarnings: true,
  manualReviewThresholdCredits: 2_500,
};

describe("Twin economy negative-balance recovery", () => {
  it("does nothing when there is no reversal exposure", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 0,
          availableEarningsCredits: 1_000,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toEqual({
      disposition: "clear",
      reason: "no-reversal-exposure",
      consumeAvailableCredits: 0,
      holdPendingCredits: 0,
      newNegativeBalanceCredits: 0,
      futureEarningsOffsetRequired: false,
      restrictAccount: false,
      manualReviewRequired: false,
    });
  });

  it("covers a reversal from available earnings before touching pending earnings", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 700,
          availableEarningsCredits: 1_000,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toEqual({
      disposition: "hold-earnings",
      reason: "covered-by-current-earnings",
      consumeAvailableCredits: 700,
      holdPendingCredits: 0,
      newNegativeBalanceCredits: 0,
      futureEarningsOffsetRequired: false,
      restrictAccount: false,
      manualReviewRequired: false,
    });
  });

  it("uses pending earnings only after available earnings are exhausted", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 1_300,
          availableEarningsCredits: 1_000,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toEqual({
      disposition: "hold-earnings",
      reason: "covered-by-current-earnings",
      consumeAvailableCredits: 1_000,
      holdPendingCredits: 300,
      newNegativeBalanceCredits: 0,
      futureEarningsOffsetRequired: false,
      restrictAccount: false,
      manualReviewRequired: false,
    });
  });

  it("creates a recoverable negative balance when reversal exposure exceeds earnings", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 2_000,
          availableEarningsCredits: 500,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toEqual({
      disposition: "offset-future-earnings",
      reason: "negative-balance-created",
      consumeAvailableCredits: 500,
      holdPendingCredits: 500,
      newNegativeBalanceCredits: 1_000,
      futureEarningsOffsetRequired: true,
      restrictAccount: false,
      manualReviewRequired: false,
    });
  });

  it("forces manual review at the configured threshold before hard restriction", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 3_500,
          availableEarningsCredits: 500,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toMatchObject({
      disposition: "manual-review",
      reason: "negative-balance-created",
      newNegativeBalanceCredits: 2_500,
      futureEarningsOffsetRequired: true,
      restrictAccount: false,
      manualReviewRequired: true,
    });
  });

  it("restricts the account when negative recovery exposure exceeds the hard threshold", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 7_000,
          availableEarningsCredits: 500,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toMatchObject({
      disposition: "restrict-account",
      reason: "negative-balance-threshold",
      newNegativeBalanceCredits: 6_000,
      futureEarningsOffsetRequired: true,
      restrictAccount: true,
      manualReviewRequired: true,
    });
  });

  it("carries an existing negative balance into the next confirmed reversal", () => {
    expect(
      decideTwinEconomyRecovery({
        policy,
        context: {
          confirmedReversalCredits: 500,
          availableEarningsCredits: 250,
          pendingEarningsCredits: 0,
          existingNegativeBalanceCredits: 750,
          accountAlreadyRestricted: false,
        },
      }),
    ).toMatchObject({
      newNegativeBalanceCredits: 1_000,
      disposition: "offset-future-earnings",
      futureEarningsOffsetRequired: true,
    });
  });

  it("fails closed if policy forbids future offsets but uncovered exposure exists", () => {
    expect(
      decideTwinEconomyRecovery({
        policy: { ...policy, offsetFutureEarnings: false },
        context: {
          confirmedReversalCredits: 2_000,
          availableEarningsCredits: 500,
          pendingEarningsCredits: 500,
          existingNegativeBalanceCredits: 0,
          accountAlreadyRestricted: false,
        },
      }),
    ).toMatchObject({
      disposition: "manual-review",
      reason: "invalid-recovery-state",
      newNegativeBalanceCredits: 1_000,
      restrictAccount: true,
      manualReviewRequired: true,
    });
  });

  it("offsets future earnings deterministically without producing negative values", () => {
    expect(
      applyFutureEarningsOffset({
        outstandingNegativeBalanceCredits: 1_000,
        newlyEarnedCredits: 600,
      }),
    ).toEqual({
      offsetCredits: 600,
      remainingNegativeBalanceCredits: 400,
      releasableCredits: 0,
    });

    expect(
      applyFutureEarningsOffset({
        outstandingNegativeBalanceCredits: 400,
        newlyEarnedCredits: 1_000,
      }),
    ).toEqual({
      offsetCredits: 400,
      remainingNegativeBalanceCredits: 0,
      releasableCredits: 600,
    });
  });

  it("rejects incoherent policy thresholds", () => {
    expect(() =>
      normalizeTwinEconomyRecoveryPolicy({
        ...policy,
        manualReviewThresholdCredits: 5_001,
      }),
    ).toThrow("cannot exceed");
  });
});

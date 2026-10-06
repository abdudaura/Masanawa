export type TwinEconomyRecoveryDisposition =
  | "clear"
  | "hold-earnings"
  | "offset-future-earnings"
  | "restrict-account"
  | "manual-review";

export type TwinEconomyRecoveryReason =
  | "no-reversal-exposure"
  | "covered-by-current-earnings"
  | "negative-balance-created"
  | "negative-balance-threshold"
  | "existing-negative-balance"
  | "invalid-recovery-state";

export interface TwinEconomyRecoveryPolicy {
  readonly revision: number;
  /**
   * Maximum outstanding recovery balance allowed before the creator account must
   * be restricted from new withdrawals/owner-paid earning release.
   */
  readonly maxNegativeBalanceCredits: number;
  /**
   * When true, all future eligible creator earnings are offset against the
   * negative recovery balance before becoming withdrawable.
   */
  readonly offsetFutureEarnings: boolean;
  /**
   * Optional lower threshold that forces operator review even before the hard
   * account-restriction threshold is reached.
   */
  readonly manualReviewThresholdCredits: number;
}

export interface TwinEconomyRecoveryContext {
  readonly confirmedReversalCredits: number;
  readonly availableEarningsCredits: number;
  readonly pendingEarningsCredits: number;
  readonly existingNegativeBalanceCredits: number;
  readonly accountAlreadyRestricted: boolean;
}

export interface TwinEconomyRecoveryDecision {
  readonly disposition: TwinEconomyRecoveryDisposition;
  readonly reason: TwinEconomyRecoveryReason;
  readonly consumeAvailableCredits: number;
  readonly holdPendingCredits: number;
  readonly newNegativeBalanceCredits: number;
  readonly futureEarningsOffsetRequired: boolean;
  readonly restrictAccount: boolean;
  readonly manualReviewRequired: boolean;
}

function nonnegative(
  value: number,
  name: string,
  max = 1_000_000_000_000,
): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeTwinEconomyRecoveryPolicy(
  input: TwinEconomyRecoveryPolicy,
): TwinEconomyRecoveryPolicy {
  const revision = nonnegative(input.revision, "revision", 2_147_483_647);
  if (revision < 1) throw new RangeError("revision is invalid");

  const maxNegativeBalanceCredits = nonnegative(
    input.maxNegativeBalanceCredits,
    "maxNegativeBalanceCredits",
  );
  const manualReviewThresholdCredits = nonnegative(
    input.manualReviewThresholdCredits,
    "manualReviewThresholdCredits",
  );

  if (manualReviewThresholdCredits > maxNegativeBalanceCredits) {
    throw new RangeError(
      "manualReviewThresholdCredits cannot exceed maxNegativeBalanceCredits",
    );
  }
  if (typeof input.offsetFutureEarnings !== "boolean") {
    throw new TypeError("offsetFutureEarnings must be boolean");
  }

  return Object.freeze({
    revision,
    maxNegativeBalanceCredits,
    offsetFutureEarnings: input.offsetFutureEarnings,
    manualReviewThresholdCredits,
  });
}

export function decideTwinEconomyRecovery(input: {
  readonly policy: TwinEconomyRecoveryPolicy;
  readonly context: TwinEconomyRecoveryContext;
}): TwinEconomyRecoveryDecision {
  const policy = normalizeTwinEconomyRecoveryPolicy(input.policy);
  const confirmedReversalCredits = nonnegative(
    input.context.confirmedReversalCredits,
    "confirmedReversalCredits",
  );
  const availableEarningsCredits = nonnegative(
    input.context.availableEarningsCredits,
    "availableEarningsCredits",
  );
  const pendingEarningsCredits = nonnegative(
    input.context.pendingEarningsCredits,
    "pendingEarningsCredits",
  );
  const existingNegativeBalanceCredits = nonnegative(
    input.context.existingNegativeBalanceCredits,
    "existingNegativeBalanceCredits",
  );
  if (typeof input.context.accountAlreadyRestricted !== "boolean") {
    throw new TypeError("accountAlreadyRestricted must be boolean");
  }

  if (
    confirmedReversalCredits === 0 &&
    existingNegativeBalanceCredits === 0
  ) {
    return Object.freeze({
      disposition: "clear",
      reason: "no-reversal-exposure",
      consumeAvailableCredits: 0,
      holdPendingCredits: 0,
      newNegativeBalanceCredits: 0,
      futureEarningsOffsetRequired: false,
      restrictAccount: input.context.accountAlreadyRestricted,
      manualReviewRequired: input.context.accountAlreadyRestricted,
    });
  }

  const totalExposure =
    confirmedReversalCredits + existingNegativeBalanceCredits;
  if (!Number.isSafeInteger(totalExposure)) {
    throw new RangeError("total recovery exposure is invalid");
  }

  const consumeAvailableCredits = Math.min(
    availableEarningsCredits,
    totalExposure,
  );
  const exposureAfterAvailable =
    totalExposure - consumeAvailableCredits;

  const holdPendingCredits = Math.min(
    pendingEarningsCredits,
    exposureAfterAvailable,
  );
  const newNegativeBalanceCredits =
    exposureAfterAvailable - holdPendingCredits;

  const restrictAccount =
    input.context.accountAlreadyRestricted ||
    newNegativeBalanceCredits > policy.maxNegativeBalanceCredits;

  const manualReviewRequired =
    restrictAccount ||
    newNegativeBalanceCredits >= policy.manualReviewThresholdCredits;

  if (
    newNegativeBalanceCredits > 0 &&
    !policy.offsetFutureEarnings
  ) {
    return Object.freeze({
      disposition: "manual-review",
      reason: "invalid-recovery-state",
      consumeAvailableCredits,
      holdPendingCredits,
      newNegativeBalanceCredits,
      futureEarningsOffsetRequired: false,
      restrictAccount: true,
      manualReviewRequired: true,
    });
  }

  if (restrictAccount) {
    return Object.freeze({
      disposition: "restrict-account",
      reason:
        newNegativeBalanceCredits > policy.maxNegativeBalanceCredits
          ? "negative-balance-threshold"
          : "existing-negative-balance",
      consumeAvailableCredits,
      holdPendingCredits,
      newNegativeBalanceCredits,
      futureEarningsOffsetRequired:
        newNegativeBalanceCredits > 0 && policy.offsetFutureEarnings,
      restrictAccount: true,
      manualReviewRequired: true,
    });
  }

  if (newNegativeBalanceCredits > 0) {
    return Object.freeze({
      disposition: manualReviewRequired
        ? "manual-review"
        : "offset-future-earnings",
      reason: "negative-balance-created",
      consumeAvailableCredits,
      holdPendingCredits,
      newNegativeBalanceCredits,
      futureEarningsOffsetRequired: true,
      restrictAccount: false,
      manualReviewRequired,
    });
  }

  return Object.freeze({
    disposition: "hold-earnings",
    reason: "covered-by-current-earnings",
    consumeAvailableCredits,
    holdPendingCredits,
    newNegativeBalanceCredits: 0,
    futureEarningsOffsetRequired: false,
    restrictAccount: input.context.accountAlreadyRestricted,
    manualReviewRequired: input.context.accountAlreadyRestricted,
  });
}

export function applyFutureEarningsOffset(input: {
  readonly outstandingNegativeBalanceCredits: number;
  readonly newlyEarnedCredits: number;
}): {
  readonly offsetCredits: number;
  readonly remainingNegativeBalanceCredits: number;
  readonly releasableCredits: number;
} {
  const outstanding = nonnegative(
    input.outstandingNegativeBalanceCredits,
    "outstandingNegativeBalanceCredits",
  );
  const newlyEarned = nonnegative(
    input.newlyEarnedCredits,
    "newlyEarnedCredits",
  );

  const offsetCredits = Math.min(outstanding, newlyEarned);
  return Object.freeze({
    offsetCredits,
    remainingNegativeBalanceCredits: outstanding - offsetCredits,
    releasableCredits: newlyEarned - offsetCredits,
  });
}

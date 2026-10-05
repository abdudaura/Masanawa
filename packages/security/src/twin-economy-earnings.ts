export interface EarningReleaseContext {
  readonly pendingCredits: number;
  readonly availableCredits: number;
  readonly unresolvedChargebackCredits: number;
  readonly unresolvedRefundCredits: number;
  readonly accountRestricted: boolean;
}

export interface EarningReleaseDecision {
  readonly withdrawableCredits: number;
  readonly heldCredits: number;
  readonly blocked: boolean;
  readonly reason:
    | "available"
    | "restricted"
    | "chargeback-hold"
    | "refund-hold"
    | "pending-only";
}

function nonnegative(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function decideWithdrawableTwinEarnings(
  input: EarningReleaseContext,
): EarningReleaseDecision {
  const pending = nonnegative(input.pendingCredits, "pendingCredits");
  const available = nonnegative(input.availableCredits, "availableCredits");
  const chargebacks = nonnegative(
    input.unresolvedChargebackCredits,
    "unresolvedChargebackCredits",
  );
  const refunds = nonnegative(
    input.unresolvedRefundCredits,
    "unresolvedRefundCredits",
  );

  if (input.accountRestricted) {
    return {
      withdrawableCredits: 0,
      heldCredits: available + pending,
      blocked: true,
      reason: "restricted",
    };
  }

  const hold = Math.min(available, chargebacks + refunds);
  const withdrawable = Math.max(0, available - hold);

  if (chargebacks > 0) {
    return {
      withdrawableCredits: withdrawable,
      heldCredits: pending + hold,
      blocked: withdrawable === 0,
      reason: "chargeback-hold",
    };
  }
  if (refunds > 0) {
    return {
      withdrawableCredits: withdrawable,
      heldCredits: pending + hold,
      blocked: withdrawable === 0,
      reason: "refund-hold",
    };
  }
  if (available === 0 && pending > 0) {
    return {
      withdrawableCredits: 0,
      heldCredits: pending,
      blocked: true,
      reason: "pending-only",
    };
  }

  return {
    withdrawableCredits: available,
    heldCredits: pending,
    blocked: false,
    reason: "available",
  };
}

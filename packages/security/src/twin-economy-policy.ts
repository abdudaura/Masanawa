export type TwinEconomyOperation =
  | "external-funding-attribution"
  | "purchase-attribution"
  | "credit-transfer"
  | "gift"
  | "paid-voice"
  | "owner-access"
  | "withdraw-earnings";

export interface TwinEconomyLimitPolicy {
  readonly revision: number;
  readonly operation: TwinEconomyOperation;
  readonly enabled: boolean;
  readonly minAmountCredits: number;
  readonly maxAmountCredits: number;
  readonly maxOperationsPerHour: number;
  readonly maxOperationsPerDay: number;
}

export interface TwinEconomyActorContext {
  readonly actorUserId: string;
  readonly recipientUserId?: string | null;
  readonly attributedOwnerUserId?: string | null;
}

export interface TwinEconomyOperationAttempt {
  readonly operation: TwinEconomyOperation;
  readonly amountCredits: number;
  readonly actor: TwinEconomyActorContext;
  readonly operationsLastHour: number;
  readonly operationsLastDay: number;
}

export interface TwinEconomyGuardDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "disabled"
    | "self-transfer"
    | "self-gift"
    | "self-attribution"
    | "amount-below-min"
    | "amount-above-max"
    | "hourly-limit"
    | "daily-limit";
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeTwinEconomyLimitPolicy(
  input: TwinEconomyLimitPolicy,
): TwinEconomyLimitPolicy {
  return Object.freeze({
    revision: integer(input.revision, "revision", 1, 2_147_483_647),
    operation: input.operation,
    enabled: input.enabled === true,
    minAmountCredits: integer(
      input.minAmountCredits,
      "minAmountCredits",
      0,
      1_000_000_000_000,
    ),
    maxAmountCredits: integer(
      input.maxAmountCredits,
      "maxAmountCredits",
      input.minAmountCredits,
      1_000_000_000_000,
    ),
    maxOperationsPerHour: integer(
      input.maxOperationsPerHour,
      "maxOperationsPerHour",
      1,
      1_000_000,
    ),
    maxOperationsPerDay: integer(
      input.maxOperationsPerDay,
      "maxOperationsPerDay",
      input.maxOperationsPerHour,
      10_000_000,
    ),
  });
}

export function guardTwinEconomyOperation(input: {
  readonly policy: TwinEconomyLimitPolicy;
  readonly attempt: TwinEconomyOperationAttempt;
}): TwinEconomyGuardDecision {
  const policy = normalizeTwinEconomyLimitPolicy(input.policy);
  const attempt = input.attempt;
  const amountCredits = integer(
    attempt.amountCredits,
    "amountCredits",
    0,
    1_000_000_000_000,
  );
  integer(attempt.operationsLastHour, "operationsLastHour", 0, 1_000_000_000);
  integer(attempt.operationsLastDay, "operationsLastDay", 0, 1_000_000_000);

  if (!policy.enabled) return { allowed: false, reason: "disabled" };

  if (
    attempt.operation === "credit-transfer" &&
    attempt.actor.recipientUserId === attempt.actor.actorUserId
  ) {
    return { allowed: false, reason: "self-transfer" };
  }

  if (
    attempt.operation === "gift" &&
    attempt.actor.recipientUserId === attempt.actor.actorUserId
  ) {
    return { allowed: false, reason: "self-gift" };
  }

  if (
    (attempt.operation === "external-funding-attribution" ||
      attempt.operation === "purchase-attribution") &&
    attempt.actor.attributedOwnerUserId === attempt.actor.actorUserId
  ) {
    return { allowed: false, reason: "self-attribution" };
  }

  if (amountCredits < policy.minAmountCredits) {
    return { allowed: false, reason: "amount-below-min" };
  }
  if (amountCredits > policy.maxAmountCredits) {
    return { allowed: false, reason: "amount-above-max" };
  }
  if (attempt.operationsLastHour >= policy.maxOperationsPerHour) {
    return { allowed: false, reason: "hourly-limit" };
  }
  if (attempt.operationsLastDay >= policy.maxOperationsPerDay) {
    return { allowed: false, reason: "daily-limit" };
  }

  return { allowed: true, reason: "allowed" };
}

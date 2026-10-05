export type OwnerAccessModality = "text" | "voice" | "video";

export type OwnerAccessState =
  | "requested"
  | "accepted"
  | "scheduled"
  | "active"
  | "completed"
  | "settled"
  | "declined"
  | "expired"
  | "cancelled"
  | "no-show"
  | "refunded"
  | "disputed";

export interface OwnerAccessPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly enabled: boolean;
  readonly minDurationMinutes: number;
  readonly maxDurationMinutes: number;
  readonly minPriceCredits: number;
  readonly maxPriceCredits: number;
  readonly platformFeeBasisPoints: number;
  readonly acceptWithinMinutes: number;
  readonly startGraceMinutes: number;
}

export interface OwnerAccessQuote {
  readonly requestId: string;
  readonly ownerUserId: string;
  readonly originatingCharacterId: string;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly platformFeeCredits: number;
  readonly ownerEarningCredits: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialDurationDays: number;
  readonly policyRevision: number;
  readonly trialPolicyRevision: number;
  readonly quoteExpiresAt: string;
}

export interface OwnerAccessRequest {
  readonly requestId: string;
  readonly requesterUserId: string;
  readonly ownerUserId: string;
  readonly originatingCharacterId: string;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly platformFeeCredits: number;
  readonly ownerEarningCredits: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialPolicyRevision: number;
  readonly state: OwnerAccessState;
  readonly requestedAt: string;
  readonly acceptBy: string;
  readonly scheduledFor: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface OwnerAccessSettlementDecision {
  readonly disposition: "settle" | "refund" | "reconcile" | "none";
  readonly customerChargeCredits: number;
  readonly ownerEarningCredits: number;
  readonly platformRevenueCredits: number;
  readonly refundCredits: number;
  readonly trialUnitsConsumed: number;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function time(value: string, name: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

export function normalizeOwnerAccessPolicy(
  input: OwnerAccessPolicy,
): OwnerAccessPolicy {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported owner access policy");
  const revision = integer(input.revision, "revision", 1, 2_147_483_647);
  const minDurationMinutes = integer(input.minDurationMinutes, "minDurationMinutes", 5, 240);
  const maxDurationMinutes = integer(input.maxDurationMinutes, "maxDurationMinutes", minDurationMinutes, 480);
  const minPriceCredits = integer(input.minPriceCredits, "minPriceCredits", 0, 1_000_000_000);
  const maxPriceCredits = integer(input.maxPriceCredits, "maxPriceCredits", minPriceCredits, 1_000_000_000);
  const platformFeeBasisPoints = integer(input.platformFeeBasisPoints, "platformFeeBasisPoints", 0, 10_000);
  const acceptWithinMinutes = integer(input.acceptWithinMinutes, "acceptWithinMinutes", 5, 7 * 24 * 60);
  const startGraceMinutes = integer(input.startGraceMinutes, "startGraceMinutes", 1, 180);
  return Object.freeze({
    schemaVersion: 1,
    revision,
    enabled: input.enabled === true,
    minDurationMinutes,
    maxDurationMinutes,
    minPriceCredits,
    maxPriceCredits,
    platformFeeBasisPoints,
    acceptWithinMinutes,
    startGraceMinutes,
  });
}

export function quoteOwnerAccess(input: {
  readonly policy: OwnerAccessPolicy;
  readonly requestId: string;
  readonly ownerUserId: string;
  readonly originatingCharacterId: string;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
  readonly requestedPriceCredits: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialDurationDays: number;
  readonly trialPolicyRevision: number;
  readonly quoteExpiresAt: string;
}): OwnerAccessQuote {
  const policy = normalizeOwnerAccessPolicy(input.policy);
  if (!policy.enabled) throw new Error("Owner access is unavailable");
  if (!["text", "voice", "video"].includes(input.modality)) {
    throw new TypeError("Unsupported owner access modality");
  }
  const durationMinutes = integer(
    input.durationMinutes,
    "durationMinutes",
    policy.minDurationMinutes,
    policy.maxDurationMinutes,
  );
  const paidPrice = integer(
    input.requestedPriceCredits,
    "requestedPriceCredits",
    policy.minPriceCredits,
    policy.maxPriceCredits,
  );
  const priceCredits = input.chargeMode === "trial" ? 0 : paidPrice;
  const platformFeeCredits =
    input.chargeMode === "trial"
      ? 0
      : Math.floor((priceCredits * policy.platformFeeBasisPoints) / 10_000);
  const ownerEarningCredits = priceCredits - platformFeeCredits;
  return Object.freeze({
    requestId: input.requestId,
    ownerUserId: input.ownerUserId,
    originatingCharacterId: input.originatingCharacterId,
    modality: input.modality,
    durationMinutes,
    priceCredits,
    platformFeeCredits,
    ownerEarningCredits,
    chargeMode: input.chargeMode,
    trialDurationDays: integer(input.trialDurationDays, "trialDurationDays", 1, 365),
    policyRevision: policy.revision,
    trialPolicyRevision: integer(input.trialPolicyRevision, "trialPolicyRevision", 0, 2_147_483_647),
    quoteExpiresAt: time(input.quoteExpiresAt, "quoteExpiresAt"),
  });
}

const transitions: Readonly<Record<OwnerAccessState, readonly OwnerAccessState[]>> = Object.freeze({
  requested: ["accepted", "declined", "expired", "cancelled"],
  accepted: ["scheduled", "cancelled", "expired"],
  scheduled: ["active", "cancelled", "no-show", "expired"],
  active: ["completed", "disputed"],
  completed: ["settled", "disputed"],
  settled: [],
  declined: ["refunded"],
  expired: ["refunded"],
  cancelled: ["refunded"],
  "no-show": ["refunded", "disputed"],
  refunded: [],
  disputed: ["settled", "refunded"],
});

export function transitionOwnerAccess(
  current: OwnerAccessState,
  next: OwnerAccessState,
): OwnerAccessState {
  if (!transitions[current]?.includes(next)) {
    throw new Error(`Invalid owner access transition: ${current} -> ${next}`);
  }
  return next;
}

export function decideOwnerAccessSettlement(input: {
  readonly state: OwnerAccessState;
  readonly chargeMode: "trial" | "paid";
  readonly reservedCredits: number;
  readonly ownerEarningCredits: number;
  readonly platformFeeCredits: number;
  readonly attendanceVerified: boolean;
  readonly completionVerified: boolean;
}): OwnerAccessSettlementDecision {
  const reservedCredits = integer(input.reservedCredits, "reservedCredits", 0, 1_000_000_000);
  const ownerEarningCredits = integer(input.ownerEarningCredits, "ownerEarningCredits", 0, 1_000_000_000);
  const platformFeeCredits = integer(input.platformFeeCredits, "platformFeeCredits", 0, 1_000_000_000);

  if (input.state === "disputed") {
    return Object.freeze({
      disposition: "reconcile",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  }

  if (
    ["declined", "expired", "cancelled", "no-show", "refunded"].includes(input.state)
  ) {
    return Object.freeze({
      disposition: reservedCredits > 0 ? "refund" : "none",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: reservedCredits,
      trialUnitsConsumed: 0,
    });
  }

  if (
    input.state === "completed" &&
    input.attendanceVerified &&
    input.completionVerified
  ) {
    if (input.chargeMode === "trial") {
      return Object.freeze({
        disposition: "settle",
        customerChargeCredits: 0,
        ownerEarningCredits: 0,
        platformRevenueCredits: 0,
        refundCredits: 0,
        trialUnitsConsumed: 1,
      });
    }
    if (ownerEarningCredits + platformFeeCredits !== reservedCredits) {
      throw new Error("Owner access settlement does not match reserved amount");
    }
    return Object.freeze({
      disposition: "settle",
      customerChargeCredits: reservedCredits,
      ownerEarningCredits,
      platformRevenueCredits: platformFeeCredits,
      refundCredits: 0,
      trialUnitsConsumed: 0,
    });
  }

  return Object.freeze({
    disposition: "none",
    customerChargeCredits: 0,
    ownerEarningCredits: 0,
    platformRevenueCredits: 0,
    refundCredits: 0,
    trialUnitsConsumed: 0,
  });
}

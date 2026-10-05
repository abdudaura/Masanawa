export type AttributionEventType =
  | "external-funding"
  | "commerce-purchase"
  | "internal-transfer"
  | "gift"
  | "refund"
  | "reversal"
  | "test"
  | "admin";

export interface TwinAttributionRecord {
  readonly attributionId: string;
  readonly ownerUserId: string;
  readonly characterId: string;
  readonly customerUserId: string | null;
  readonly eventType: AttributionEventType;
  readonly operationId: string;
  readonly policyRevision: number;
  readonly attributedAt: string;
  readonly expiresAt: string | null;
  readonly selfAttribution: boolean;
}

export interface CommissionPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly enabled: boolean;
  readonly eventType: "external-funding" | "commerce-purchase";
  readonly rateBasisPoints: number;
  readonly minimumCommissionCredits: number;
  readonly maximumCommissionCredits: number | null;
  readonly effectiveAt: string;
}

export interface CommissionDecision {
  readonly eligible: boolean;
  readonly reason:
    | "eligible"
    | "disabled"
    | "event-not-eligible"
    | "self-attribution"
    | "expired"
    | "zero-base";
  readonly policyRevision: number;
  readonly baseCredits: number;
  readonly commissionCredits: number;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function timestamp(value: string, name: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

export function normalizeCommissionPolicy(
  input: CommissionPolicy,
): CommissionPolicy {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported commission policy");
  const revision = integer(input.revision, "revision", 1, 2_147_483_647);
  if (
    input.eventType !== "external-funding" &&
    input.eventType !== "commerce-purchase"
  ) {
    throw new TypeError("eventType is invalid");
  }
  const rateBasisPoints = integer(
    input.rateBasisPoints,
    "rateBasisPoints",
    0,
    10_000,
  );
  const minimumCommissionCredits = integer(
    input.minimumCommissionCredits,
    "minimumCommissionCredits",
    0,
    1_000_000_000_000,
  );
  let maximumCommissionCredits: number | null = null;
  if (input.maximumCommissionCredits !== null) {
    maximumCommissionCredits = integer(
      input.maximumCommissionCredits,
      "maximumCommissionCredits",
      minimumCommissionCredits,
      1_000_000_000_000,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    revision,
    enabled: input.enabled === true,
    eventType: input.eventType,
    rateBasisPoints,
    minimumCommissionCredits,
    maximumCommissionCredits,
    effectiveAt: timestamp(input.effectiveAt, "effectiveAt"),
  });
}

export function defaultCommissionPolicy(input: {
  readonly eventType: "external-funding" | "commerce-purchase";
  readonly effectiveAt: string;
}): CommissionPolicy {
  return normalizeCommissionPolicy({
    schemaVersion: 1,
    revision: 1,
    enabled: true,
    eventType: input.eventType,
    rateBasisPoints: 100,
    minimumCommissionCredits: 0,
    maximumCommissionCredits: null,
    effectiveAt: input.effectiveAt,
  });
}

export function decideTwinCommission(input: {
  readonly attribution: TwinAttributionRecord;
  readonly policy: CommissionPolicy;
  readonly baseCredits: number;
  readonly now: string;
}): CommissionDecision {
  const policy = normalizeCommissionPolicy(input.policy);
  const baseCredits = integer(input.baseCredits, "baseCredits", 0, 1_000_000_000_000);
  const now = new Date(timestamp(input.now, "now"));

  if (!policy.enabled) {
    return Object.freeze({
      eligible: false,
      reason: "disabled",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  if (
    input.attribution.eventType !== "external-funding" &&
    input.attribution.eventType !== "commerce-purchase"
  ) {
    return Object.freeze({
      eligible: false,
      reason: "event-not-eligible",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  if (input.attribution.eventType !== policy.eventType) {
    return Object.freeze({
      eligible: false,
      reason: "event-not-eligible",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  if (input.attribution.selfAttribution) {
    return Object.freeze({
      eligible: false,
      reason: "self-attribution",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  if (
    input.attribution.expiresAt !== null &&
    now.getTime() >= new Date(timestamp(input.attribution.expiresAt, "expiresAt")).getTime()
  ) {
    return Object.freeze({
      eligible: false,
      reason: "expired",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  if (baseCredits === 0) {
    return Object.freeze({
      eligible: false,
      reason: "zero-base",
      policyRevision: policy.revision,
      baseCredits,
      commissionCredits: 0,
    });
  }

  const raw = Math.floor((baseCredits * policy.rateBasisPoints) / 10_000);
  const withMinimum = Math.max(raw, policy.minimumCommissionCredits);
  const commissionCredits =
    policy.maximumCommissionCredits === null
      ? withMinimum
      : Math.min(withMinimum, policy.maximumCommissionCredits);

  return Object.freeze({
    eligible: commissionCredits > 0,
    reason: commissionCredits > 0 ? "eligible" : "zero-base",
    policyRevision: policy.revision,
    baseCredits,
    commissionCredits,
  });
}

export function reverseCommission(input: {
  readonly originalBaseCredits: number;
  readonly originalCommissionCredits: number;
  readonly reversalBaseCredits: number;
}): number {
  const originalBase = integer(
    input.originalBaseCredits,
    "originalBaseCredits",
    0,
    1_000_000_000_000,
  );
  const originalCommission = integer(
    input.originalCommissionCredits,
    "originalCommissionCredits",
    0,
    1_000_000_000_000,
  );
  const reversalBase = integer(
    input.reversalBaseCredits,
    "reversalBaseCredits",
    0,
    1_000_000_000_000,
  );

  if (originalBase === 0 || originalCommission === 0 || reversalBase === 0) {
    return 0;
  }

  const boundedReversalBase = Math.min(originalBase, reversalBase);
  if (boundedReversalBase === originalBase) {
    return -originalCommission;
  }

  // Reverse the same fraction of the original settled commission. Floor keeps
  // partial reversals from clawing back more than was economically attributed;
  // a later full reversal still removes the entire remainder.
  const proportional = Math.floor(
    (originalCommission * boundedReversalBase) / originalBase,
  );
  return -Math.min(originalCommission, proportional);
}

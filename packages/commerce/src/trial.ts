export type PaidFeatureKey =
  | "twin-voice"
  | "owner-access"
  | "premium-twin";

export interface PaidFeatureTrialPolicy {
  readonly schemaVersion: 1;
  readonly feature: PaidFeatureKey;
  readonly revision: number;
  readonly enabled: boolean;
  readonly durationDays: number;
  readonly maxUnits: number | null;
  readonly createdAt: string;
}

export interface PaidFeatureTrialUsage {
  readonly startedAt: string | null;
  readonly consumedUnits: number;
}

export interface PaidFeatureTrialDecision {
  readonly eligible: boolean;
  readonly policyRevision: number;
  readonly startsAt: string | null;
  readonly expiresAt: string | null;
  readonly remainingUnits: number | null;
  readonly reason:
    | "eligible"
    | "disabled"
    | "expired"
    | "usage-exhausted"
    | "request-exceeds-remaining";
}

function iso(value: string, name: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${name} must be an ISO timestamp`);
  }
  return parsed.toISOString();
}

function positiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizePaidFeatureTrialPolicy(
  input: PaidFeatureTrialPolicy,
): PaidFeatureTrialPolicy {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported trial policy schema");
  if (!["twin-voice", "owner-access", "premium-twin"].includes(input.feature)) {
    throw new TypeError("Unknown paid feature");
  }
  const durationDays = positiveInteger(input.durationDays, "durationDays", 365);
  const revision = positiveInteger(input.revision, "revision", 2_147_483_647);
  let maxUnits: number | null = null;
  if (input.maxUnits !== null) {
    maxUnits = positiveInteger(input.maxUnits, "maxUnits", 1_000_000_000);
  }
  return Object.freeze({
    schemaVersion: 1,
    feature: input.feature,
    revision,
    enabled: input.enabled === true,
    durationDays,
    maxUnits,
    createdAt: iso(input.createdAt, "createdAt"),
  });
}

export function defaultPaidFeatureTrialPolicy(
  feature: PaidFeatureKey,
  createdAt: string,
): PaidFeatureTrialPolicy {
  return normalizePaidFeatureTrialPolicy({
    schemaVersion: 1,
    feature,
    revision: 1,
    enabled: true,
    durationDays: 7,
    maxUnits: null,
    createdAt,
  });
}

export function evaluatePaidFeatureTrial(input: {
  readonly policy: PaidFeatureTrialPolicy;
  readonly usage: PaidFeatureTrialUsage;
  readonly requestedUnits: number;
  readonly now: string;
}): PaidFeatureTrialDecision {
  const policy = normalizePaidFeatureTrialPolicy(input.policy);
  const requestedUnits = positiveInteger(input.requestedUnits, "requestedUnits", 1_000_000_000);
  if (!Number.isSafeInteger(input.usage.consumedUnits) || input.usage.consumedUnits < 0) {
    throw new RangeError("consumedUnits is invalid");
  }
  const now = new Date(iso(input.now, "now"));

  if (!policy.enabled) {
    return Object.freeze({
      eligible: false,
      policyRevision: policy.revision,
      startsAt: null,
      expiresAt: null,
      remainingUnits: policy.maxUnits,
      reason: "disabled",
    });
  }

  const startsAt =
    input.usage.startedAt === null ? now.toISOString() : iso(input.usage.startedAt, "startedAt");
  const start = new Date(startsAt);
  const expiresAt = new Date(
    start.getTime() + policy.durationDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  if (now.getTime() >= new Date(expiresAt).getTime()) {
    return Object.freeze({
      eligible: false,
      policyRevision: policy.revision,
      startsAt,
      expiresAt,
      remainingUnits:
        policy.maxUnits === null
          ? null
          : Math.max(0, policy.maxUnits - input.usage.consumedUnits),
      reason: "expired",
    });
  }

  const remainingUnits =
    policy.maxUnits === null ? null : Math.max(0, policy.maxUnits - input.usage.consumedUnits);

  if (remainingUnits !== null && remainingUnits === 0) {
    return Object.freeze({
      eligible: false,
      policyRevision: policy.revision,
      startsAt,
      expiresAt,
      remainingUnits,
      reason: "usage-exhausted",
    });
  }

  if (remainingUnits !== null && requestedUnits > remainingUnits) {
    return Object.freeze({
      eligible: false,
      policyRevision: policy.revision,
      startsAt,
      expiresAt,
      remainingUnits,
      reason: "request-exceeds-remaining",
    });
  }

  return Object.freeze({
    eligible: true,
    policyRevision: policy.revision,
    startsAt,
    expiresAt,
    remainingUnits:
      remainingUnits === null ? null : remainingUnits - requestedUnits,
    reason: "eligible",
  });
}

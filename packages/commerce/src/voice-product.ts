import type { PaidFeatureTrialDecision, PaidFeatureTrialPolicy } from "./trial.js";
import { evaluatePaidFeatureTrial, normalizePaidFeatureTrialPolicy } from "./trial.js";

export interface TwinVoicePricingPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly active: boolean;
  readonly unitSeconds: number;
  readonly priceCreditsPerUnit: number;
  readonly ownerShareBasisPoints: number;
  readonly trial: PaidFeatureTrialPolicy;
}

export interface TwinVoiceUsageState {
  readonly trialStartedAt: string | null;
  readonly trialConsumedUnits: number;
}

export interface TwinVoiceQuote {
  readonly policyRevision: number;
  readonly unitSeconds: number;
  readonly estimatedUnits: number;
  readonly estimatedPriceCredits: number;
  readonly trialDurationDays: number;
  readonly trial: PaidFeatureTrialDecision;
  readonly chargeMode: "trial" | "paid";
  readonly ownerShareBasisPoints: number;
}

function positive(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeTwinVoicePricingPolicy(
  input: TwinVoicePricingPolicy,
): TwinVoicePricingPolicy {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported twin voice policy schema");
  const revision = positive(input.revision, "revision", 2_147_483_647);
  const unitSeconds = positive(input.unitSeconds, "unitSeconds", 3600);
  const priceCreditsPerUnit = positive(
    input.priceCreditsPerUnit,
    "priceCreditsPerUnit",
    1_000_000_000,
  );
  if (
    !Number.isSafeInteger(input.ownerShareBasisPoints) ||
    input.ownerShareBasisPoints < 0 ||
    input.ownerShareBasisPoints > 10_000
  ) {
    throw new RangeError("ownerShareBasisPoints is invalid");
  }
  const trial = normalizePaidFeatureTrialPolicy(input.trial);
  if (trial.feature !== "twin-voice") {
    throw new TypeError("Twin voice policy requires a twin-voice trial policy");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision,
    active: input.active === true,
    unitSeconds,
    priceCreditsPerUnit,
    ownerShareBasisPoints: input.ownerShareBasisPoints,
    trial,
  });
}

export function quoteTwinVoice(input: {
  readonly policy: TwinVoicePricingPolicy;
  readonly usage: TwinVoiceUsageState;
  readonly expectedSeconds: number;
  readonly now: string;
}): TwinVoiceQuote {
  const policy = normalizeTwinVoicePricingPolicy(input.policy);
  if (!policy.active) throw new Error("Twin voice is unavailable");
  const expectedSeconds = positive(input.expectedSeconds, "expectedSeconds", 24 * 60 * 60);
  if (
    !Number.isSafeInteger(input.usage.trialConsumedUnits) ||
    input.usage.trialConsumedUnits < 0
  ) {
    throw new RangeError("trialConsumedUnits is invalid");
  }
  const estimatedUnits = Math.ceil(expectedSeconds / policy.unitSeconds);
  const trial = evaluatePaidFeatureTrial({
    policy: policy.trial,
    usage: {
      startedAt: input.usage.trialStartedAt,
      consumedUnits: input.usage.trialConsumedUnits,
    },
    requestedUnits: estimatedUnits,
    now: input.now,
  });
  return Object.freeze({
    policyRevision: policy.revision,
    unitSeconds: policy.unitSeconds,
    estimatedUnits,
    estimatedPriceCredits: trial.eligible
      ? 0
      : estimatedUnits * policy.priceCreditsPerUnit,
    trialDurationDays: policy.trial.durationDays,
    trial,
    chargeMode: trial.eligible ? "trial" : "paid",
    ownerShareBasisPoints: policy.ownerShareBasisPoints,
  });
}

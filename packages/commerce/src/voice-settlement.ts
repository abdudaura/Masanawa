export type TwinVoiceUsageOutcome =
  | "completed"
  | "interrupted"
  | "ambiguous"
  | "failed-before-media";

export interface TwinVoiceVerifiedUsage {
  readonly admissionId: string;
  readonly outcome: TwinVoiceUsageOutcome;
  readonly verifiedSeconds: number;
  readonly trialCovered: boolean;
  readonly unitSeconds: number;
  readonly priceCreditsPerUnit: number;
  readonly ownerShareBasisPoints: number;
}

export interface TwinVoiceSettlementDecision {
  readonly disposition: "settle" | "reconcile";
  readonly usageUnits: number;
  readonly trialUnitsConsumed: number;
  readonly customerChargeCredits: number;
  readonly ownerEarningCredits: number;
  readonly platformRevenueCredits: number;
  readonly refundCredits: number;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function settleVerifiedTwinVoiceUsage(
  input: TwinVoiceVerifiedUsage,
): TwinVoiceSettlementDecision {
  const seconds = integer(input.verifiedSeconds, "verifiedSeconds", 0, 24 * 60 * 60);
  const unitSeconds = integer(input.unitSeconds, "unitSeconds", 1, 3600);
  const priceCreditsPerUnit = integer(
    input.priceCreditsPerUnit,
    "priceCreditsPerUnit",
    1,
    1_000_000_000,
  );
  const ownerShareBasisPoints = integer(
    input.ownerShareBasisPoints,
    "ownerShareBasisPoints",
    0,
    10_000,
  );

  if (input.outcome === "ambiguous") {
    return Object.freeze({
      disposition: "reconcile",
      usageUnits: 0,
      trialUnitsConsumed: 0,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  }

  if (input.outcome === "failed-before-media" || seconds === 0) {
    return Object.freeze({
      disposition: "settle",
      usageUnits: 0,
      trialUnitsConsumed: 0,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  }

  const usageUnits = Math.ceil(seconds / unitSeconds);
  if (input.trialCovered) {
    return Object.freeze({
      disposition: "settle",
      usageUnits,
      trialUnitsConsumed: usageUnits,
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      refundCredits: 0,
    });
  }

  const customerChargeCredits = usageUnits * priceCreditsPerUnit;
  const ownerEarningCredits = Math.floor(
    (customerChargeCredits * ownerShareBasisPoints) / 10_000,
  );
  const platformRevenueCredits = customerChargeCredits - ownerEarningCredits;

  return Object.freeze({
    disposition: "settle",
    usageUnits,
    trialUnitsConsumed: 0,
    customerChargeCredits,
    ownerEarningCredits,
    platformRevenueCredits,
    refundCredits: 0,
  });
}

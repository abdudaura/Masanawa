import type { OfferRevision } from "./model.js";

export type FulfillmentFundingSource = "agent-float" | "platform";

export interface FulfillmentFundingPlan {
  readonly source: FulfillmentFundingSource;
  readonly reserveCredits: number;
  readonly creatorCommissionCredits: number;
  readonly platformRevenueCredits: number;
  readonly usedFallback: boolean;
}

export function planFulfillmentFunding(input: {
  readonly offer: OfferRevision;
  readonly availableAgentFloatCredits: number;
}): FulfillmentFundingPlan {
  if (
    !Number.isSafeInteger(input.availableAgentFloatCredits) ||
    input.availableAgentFloatCredits < 0
  ) {
    throw new RangeError("availableAgentFloatCredits is invalid");
  }

  const funded =
    input.availableAgentFloatCredits >= input.offer.fulfillmentReserveCredits;
  const creatorCommissionCredits = funded
    ? input.offer.creatorCommissionCredits
    : input.offer.fallbackCommissionCredits;
  const platformRevenueCredits =
    input.offer.priceCredits -
    input.offer.fulfillmentReserveCredits -
    creatorCommissionCredits;

  return Object.freeze({
    source: funded ? "agent-float" : "platform",
    reserveCredits: input.offer.fulfillmentReserveCredits,
    creatorCommissionCredits,
    platformRevenueCredits,
    usedFallback: !funded,
  });
}

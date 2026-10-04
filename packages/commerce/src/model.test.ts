import { describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import { normalizeOfferRevision } from "./model.js";
import { planFulfillmentFunding } from "./funding.js";

describe("commerce offer economics", () => {
  const offer = normalizeOfferRevision({
    schemaVersion: 1,
    tenantId: createCanonicalId("tenant"),
    offerId: createCanonicalId("offer"),
    revision: 1,
    key: "research.web",
    title: "Web research",
    description: "Research and synthesize current information.",
    skillVersionId: createCanonicalId("skill-version"),
    priceCredits: 100,
    fulfillmentReserveCredits: 50,
    creatorCommissionCredits: 30,
    fallbackCommissionCredits: 10,
    platformMarginCredits: 20,
    active: true,
    regions: [],
    createdAt: nowInstant(),
  });

  it("uses creator Float when the reserve is covered", () => {
    expect(planFulfillmentFunding({ offer, availableAgentFloatCredits: 50 })).toEqual({
      source: "agent-float",
      reserveCredits: 50,
      creatorCommissionCredits: 30,
      platformRevenueCredits: 20,
      usedFallback: false,
    });
  });

  it("preserves acquisition commission but increases platform share on fallback", () => {
    expect(planFulfillmentFunding({ offer, availableAgentFloatCredits: 49 })).toEqual({
      source: "platform",
      reserveCredits: 50,
      creatorCommissionCredits: 10,
      platformRevenueCredits: 40,
      usedFallback: true,
    });
  });
});

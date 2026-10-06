import { describe, expect, it } from "vitest";
import {
  decideTwinCommission,
  normalizeCommissionPolicy,
  reverseCommission,
  type CommissionPolicy,
  type TwinAttributionRecord,
} from "../../packages/commerce/src/attribution.js";

const baseAttribution: TwinAttributionRecord = {
  attributionId: "attribution-acceptance-001",
  ownerUserId: "user-owner",
  characterId: "character-originating-twin",
  customerUserId: "user-customer",
  eventType: "commerce-purchase",
  operationId: "purchase-provider-success-001",
  policyRevision: 12,
  attributedAt: "2026-10-06T10:00:00.000Z",
  expiresAt: null,
  selfAttribution: false,
};

function policy(
  eventType: CommissionPolicy["eventType"],
  rateBasisPoints = 175,
): CommissionPolicy {
  return normalizeCommissionPolicy({
    schemaVersion: 1,
    revision: 12,
    enabled: true,
    eventType,
    rateBasisPoints,
    minimumCommissionCredits: 0,
    maximumCommissionCredits: null,
    effectiveAt: "2026-10-06T09:00:00.000Z",
  });
}

describe("TWIN-101 funding/purchase attribution acceptance", () => {
  it("awards only the configured commission for an eligible commerce purchase through the originating Twin", () => {
    const decision = decideTwinCommission({
      attribution: baseAttribution,
      policy: policy("commerce-purchase"),
      baseCredits: 20_000,
      now: "2026-10-06T10:01:00.000Z",
    });

    expect(baseAttribution).toMatchObject({
      ownerUserId: "user-owner",
      characterId: "character-originating-twin",
      customerUserId: "user-customer",
      operationId: "purchase-provider-success-001",
      eventType: "commerce-purchase",
    });
    expect(decision).toEqual({
      eligible: true,
      reason: "eligible",
      policyRevision: 12,
      baseCredits: 20_000,
      commissionCredits: 350,
    });
  });

  it("applies the separately configured external-funding policy instead of reusing purchase policy", () => {
    const funding: TwinAttributionRecord = {
      ...baseAttribution,
      attributionId: "attribution-funding-001",
      eventType: "external-funding",
      operationId: "funding-provider-success-001",
      policyRevision: 13,
    };

    const decision = decideTwinCommission({
      attribution: funding,
      policy: policy("external-funding", 100),
      baseCredits: 50_000,
      now: "2026-10-06T10:02:00.000Z",
    });

    expect(decision.commissionCredits).toBe(500);
    expect(decision.eligible).toBe(true);

    const wrongPolicy = decideTwinCommission({
      attribution: funding,
      policy: policy("commerce-purchase", 175),
      baseCredits: 50_000,
      now: "2026-10-06T10:02:00.000Z",
    });
    expect(wrongPolicy).toMatchObject({
      eligible: false,
      reason: "event-not-eligible",
      commissionCredits: 0,
    });
  });

  it("never manufactures commission for self-attribution or internal value movement", () => {
    const purchasePolicy = policy("commerce-purchase");

    const self = decideTwinCommission({
      attribution: {
        ...baseAttribution,
        customerUserId: "user-owner",
        selfAttribution: true,
      },
      policy: purchasePolicy,
      baseCredits: 20_000,
      now: "2026-10-06T10:03:00.000Z",
    });
    expect(self).toMatchObject({
      eligible: false,
      reason: "self-attribution",
      commissionCredits: 0,
    });

    for (const eventType of ["internal-transfer", "gift"] as const) {
      const internal = decideTwinCommission({
        attribution: { ...baseAttribution, eventType },
        policy: purchasePolicy,
        baseCredits: 20_000,
        now: "2026-10-06T10:03:00.000Z",
      });
      expect(internal).toMatchObject({
        eligible: false,
        reason: "event-not-eligible",
        commissionCredits: 0,
      });
    }
  });

  it("creates a proportional negative reversal when part of an attributed purchase is refunded", () => {
    const original = decideTwinCommission({
      attribution: baseAttribution,
      policy: policy("commerce-purchase"),
      baseCredits: 20_000,
      now: "2026-10-06T10:04:00.000Z",
    });
    expect(original.commissionCredits).toBe(350);

    const reversal = reverseCommission({
      originalBaseCredits: original.baseCredits,
      originalCommissionCredits: original.commissionCredits,
      reversalBaseCredits: 5_000,
    });

    expect(reversal).toBe(-87);
    expect(original.commissionCredits).toBe(350);
  });

  it("never reverses more than the original commission and fully offsets a full refund", () => {
    expect(
      reverseCommission({
        originalBaseCredits: 20_000,
        originalCommissionCredits: 350,
        reversalBaseCredits: 20_000,
      }),
    ).toBe(-350);

    expect(
      reverseCommission({
        originalBaseCredits: 20_000,
        originalCommissionCredits: 350,
        reversalBaseCredits: 100_000,
      }),
    ).toBe(-350);
  });

  it("does not pay commission after attribution expiry", () => {
    const decision = decideTwinCommission({
      attribution: {
        ...baseAttribution,
        expiresAt: "2026-10-06T10:05:00.000Z",
      },
      policy: policy("commerce-purchase"),
      baseCredits: 20_000,
      now: "2026-10-06T10:05:00.000Z",
    });

    expect(decision).toMatchObject({
      eligible: false,
      reason: "expired",
      commissionCredits: 0,
    });
  });
});

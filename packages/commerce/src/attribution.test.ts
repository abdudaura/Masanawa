import { describe, expect, it } from "vitest";
import {
  decideTwinCommission,
  defaultCommissionPolicy,
  normalizeCommissionPolicy,
  reverseCommission,
} from "./attribution.js";

const attribution = {
  attributionId: "attr-1",
  ownerUserId: "user-owner",
  characterId: "character-owner",
  customerUserId: "user-customer",
  eventType: "external-funding" as const,
  operationId: "funding-1",
  policyRevision: 1,
  attributedAt: "2026-10-05T09:00:00Z",
  expiresAt: null,
  selfAttribution: false,
};

describe("twin attribution and commission", () => {
  it("starts with configurable 1 percent default, not a hard-coded calculation", () => {
    const policy = defaultCommissionPolicy({
      eventType: "external-funding",
      effectiveAt: "2026-10-05T00:00:00Z",
    });
    expect(policy.rateBasisPoints).toBe(100);
    const decision = decideTwinCommission({
      attribution,
      policy,
      baseCredits: 10000,
      now: "2026-10-05T09:00:00Z",
    });
    expect(decision.commissionCredits).toBe(100);
  });

  it("lets admin change the percentage by policy revision", () => {
    const policy = normalizeCommissionPolicy({
      schemaVersion: 1,
      revision: 8,
      enabled: true,
      eventType: "external-funding",
      rateBasisPoints: 250,
      minimumCommissionCredits: 0,
      maximumCommissionCredits: null,
      effectiveAt: "2026-10-06T00:00:00Z",
    });
    const decision = decideTwinCommission({
      attribution,
      policy,
      baseCredits: 10000,
      now: "2026-10-06T01:00:00Z",
    });
    expect(decision.policyRevision).toBe(8);
    expect(decision.commissionCredits).toBe(250);
  });

  it("rejects self-attribution", () => {
    const decision = decideTwinCommission({
      attribution: { ...attribution, selfAttribution: true },
      policy: defaultCommissionPolicy({
        eventType: "external-funding",
        effectiveAt: "2026-10-05T00:00:00Z",
      }),
      baseCredits: 10000,
      now: "2026-10-05T09:00:00Z",
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe("self-attribution");
  });

  it("never commissions internal transfers or gifts", () => {
    const policy = defaultCommissionPolicy({
      eventType: "external-funding",
      effectiveAt: "2026-10-05T00:00:00Z",
    });
    for (const eventType of ["internal-transfer", "gift"] as const) {
      const decision = decideTwinCommission({
        attribution: { ...attribution, eventType },
        policy,
        baseCredits: 10000,
        now: "2026-10-05T09:00:00Z",
      });
      expect(decision.commissionCredits).toBe(0);
    }
  });

  it("creates an offsetting reversal amount instead of mutating history", () => {
    expect(
      reverseCommission({
        originalCommissionCredits: 100,
        reversalBaseCredits: 40,
      }),
    ).toBe(-40);
  });
});

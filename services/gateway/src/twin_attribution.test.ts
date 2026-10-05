import { describe, expect, it } from "vitest";
import {
  createCommissionPolicyAdminService,
  createTwinAttributionService,
  type CommissionPolicyAdminAuthorizer,
  type CommissionPolicyStore,
  type TwinAttributionAuthorizer,
  type TwinAttributionQuotePort,
} from "./twin_attribution.js";

describe("twin attribution Gateway contracts", () => {
  it("authorizes attribution quote access", async () => {
    const authorizer: TwinAttributionAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("monetization.attribution.read");
        return { tenantId: "tenant-1", userId: "user-1" };
      },
    };
    const quotes: TwinAttributionQuotePort = {
      async quote(input) {
        expect(input.tenantId).toBe("tenant-1");
        return {
          eligible: true,
          reason: "eligible",
          policyRevision: 1,
          baseCredits: input.baseCredits,
          commissionCredits: 100,
        };
      },
    };
    const service = createTwinAttributionService({ authorizer, quotes });
    const result = await service.quote({
      authorizationHeader: "Bearer user",
      attribution: {
        attributionId: "attr-1",
        ownerUserId: "owner-1",
        characterId: "character-1",
        customerUserId: "user-1",
        eventType: "external-funding",
        operationId: "funding-1",
        attributedAt: "2026-10-05T09:00:00Z",
        expiresAt: null,
        selfAttribution: false,
      },
      baseCredits: 10000,
    });
    expect(result.commissionCredits).toBe(100);
  });

  it("returns a 1 percent default policy before admin override", async () => {
    const authorizer: CommissionPolicyAdminAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1" };
      },
    };
    const store: CommissionPolicyStore = {
      async readActive() {
        return null;
      },
      async putRevision() {
        throw new Error("not used");
      },
    };
    const service = createCommissionPolicyAdminService({
      authorizer,
      store,
      now: () => new Date("2026-10-05T09:00:00Z"),
    });
    const policy = await service.read({
      authorizationHeader: "Bearer admin",
      eventType: "external-funding",
    });
    expect(policy.rateBasisPoints).toBe(100);
  });

  it("allows admin to change commission without an app release", async () => {
    const authorizer: CommissionPolicyAdminAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("monetization.commission.write");
        return { tenantId: "tenant-1" };
      },
    };
    const store: CommissionPolicyStore = {
      async readActive() {
        return null;
      },
      async putRevision(input) {
        return {
          eventType: input.eventType,
          revision: 9,
          enabled: input.enabled,
          rateBasisPoints: input.rateBasisPoints,
          minimumCommissionCredits: input.minimumCommissionCredits,
          maximumCommissionCredits: input.maximumCommissionCredits,
          effectiveAt: input.effectiveAt,
        };
      },
    };
    const service = createCommissionPolicyAdminService({ authorizer, store });
    const policy = await service.update({
      authorizationHeader: "Bearer admin",
      eventType: "commerce-purchase",
      enabled: true,
      rateBasisPoints: 175,
      minimumCommissionCredits: 0,
      maximumCommissionCredits: null,
      effectiveAt: "2026-10-06T00:00:00Z",
    });
    expect(policy.revision).toBe(9);
    expect(policy.rateBasisPoints).toBe(175);
  });
});

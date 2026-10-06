import { describe, expect, it } from "vitest";
import {
  createProviderValuationPolicyAdminService,
  type ProviderValuationAdminAuthorizer,
  type ProviderValuationPolicyStore,
} from "./provider_valuation_admin.js";

describe("provider valuation admin", () => {
  it("returns null when no valuation has been explicitly configured", async () => {
    const authorizer: ProviderValuationAdminAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("monetization.commission.read");
        return { tenantId: "tenant-1" };
      },
    };
    const store: ProviderValuationPolicyStore = {
      async readActive() { return null; },
      async putRevision() { throw new Error("not used"); },
    };
    const service = createProviderValuationPolicyAdminService({
      authorizer,
      store,
    });
    await expect(service.read({
      authorizationHeader: "Bearer admin",
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
    })).resolves.toBeNull();
  });

  it("persists an explicit versioned mapping without inventing a default", async () => {
    const authorizer: ProviderValuationAdminAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("monetization.commission.write");
        return { tenantId: "tenant-1" };
      },
    };
    const store: ProviderValuationPolicyStore = {
      async readActive() { return null; },
      async putRevision(input) {
        expect(input.tenantId).toBe("tenant-1");
        return {
          valuationKey: input.valuationKey,
          eventType: input.eventType,
          revision: 7,
          enabled: input.enabled,
          sourceUnit: input.sourceUnit,
          sourceUnitsPerStep: input.sourceUnitsPerStep,
          creditUnitsPerStep: input.creditUnitsPerStep,
          minimumSourceUnits: input.minimumSourceUnits,
          maximumBaseCredits: input.maximumBaseCredits,
          effectiveAt: input.effectiveAt,
        };
      },
    };
    const service = createProviderValuationPolicyAdminService({
      authorizer,
      store,
    });
    const saved = await service.update({
      authorizationHeader: "Bearer admin",
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      enabled: false,
      sourceUnit: "NGN_KOBO",
      sourceUnitsPerStep: 1000,
      creditUnitsPerStep: 1,
      minimumSourceUnits: 1000,
      maximumBaseCredits: 500,
      effectiveAt: "2026-10-06T00:00:00Z",
    });
    expect(saved).toMatchObject({
      revision: 7,
      enabled: false,
      sourceUnitsPerStep: 1000,
      creditUnitsPerStep: 1,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  createOwnerAccessOfferingService,
  type OwnerAccessOfferingAuthorizer,
  type OwnerAccessOfferingStore,
} from "./owner_access_offering.js";

describe("owner access offering service", () => {
  it("returns a disabled simple default before the owner configures access", async () => {
    const authorizer: OwnerAccessOfferingAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1", userId: "owner-1" };
      },
    };
    const store: OwnerAccessOfferingStore = {
      async read() {
        return null;
      },
      async putRevision() {
        throw new Error("not used");
      },
    };
    const service = createOwnerAccessOfferingService({
      authorizer,
      store,
      bounds: {
        allowedDurationsMinutes: [15, 30, 60],
        minPriceCreditsPerMinute: 5,
        maxPriceCreditsPerMinute: 500,
      },
    });

    const offering = await service.read({
      authorizationHeader: "Bearer owner",
    });

    expect(offering.enabled).toBe(false);
    expect(offering.durationOptionsMinutes).toEqual([15]);
    expect(offering.priceCreditsPerMinute).toBe(5);
  });

  it("enforces platform bounds when the owner updates pricing", async () => {
    const service = createOwnerAccessOfferingService({
      authorizer: {
        async authorize() {
          return { tenantId: "tenant-1", userId: "owner-1" };
        },
      },
      store: {
        async read() {
          return null;
        },
        async putRevision(input) {
          return {
            enabled: input.enabled,
            modalities: input.modalities,
            durationOptionsMinutes: input.durationOptionsMinutes,
            priceCreditsPerMinute: input.priceCreditsPerMinute,
            revision: 2,
          };
        },
      },
      bounds: {
        allowedDurationsMinutes: [15, 30, 60],
        minPriceCreditsPerMinute: 5,
        maxPriceCreditsPerMinute: 500,
      },
    });

    await expect(
      service.update({
        authorizationHeader: "Bearer owner",
        enabled: true,
        modalities: ["voice"],
        durationOptionsMinutes: [15],
        priceCreditsPerMinute: 1000,
      }),
    ).rejects.toThrow("platform bounds");

    const updated = await service.update({
      authorizationHeader: "Bearer owner",
      enabled: true,
      modalities: ["text", "voice"],
      durationOptionsMinutes: [30, 15],
      priceCreditsPerMinute: 25,
    });

    expect(updated.revision).toBe(2);
    expect(updated.durationOptionsMinutes).toEqual([15, 30]);
  });
});

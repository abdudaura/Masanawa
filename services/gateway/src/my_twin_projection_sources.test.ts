import { describe, expect, it } from "vitest";
import {
  createMyTwinFeatureSource,
  createMyTwinPerformanceSource,
} from "./my_twin_projection_sources.js";

describe("My Twin projection source adapters", () => {
  it("maps Activity summary into the compact My Twin performance summary", async () => {
    const source = createMyTwinPerformanceSource({
      activity: {
        async readSummary(input) {
          expect(input.characterId).toBe("character-1");
          return {
            visitors: 8,
            conversations: 5,
            earningsCredits: 700,
            pendingOwnerRequests: 2,
          };
        },
      },
    });

    await expect(
      source.read({
        tenantId: "tenant-1",
        ownerUserId: "user-owner",
        characterId: "character-1",
      }),
    ).resolves.toEqual({
      visitors: 8,
      conversations: 5,
      earningsCredits: 700,
      pendingOwnerRequests: 2,
    });
  });

  it("composes voice and real-owner availability independently", async () => {
    const source = createMyTwinFeatureSource({
      voice: {
        async isEnabled() {
          return true;
        },
      },
      ownerAccess: {
        async readOffering() {
          return { enabled: false };
        },
      },
    });

    await expect(
      source.read({
        tenantId: "tenant-1",
        ownerUserId: "user-owner",
        characterId: "character-1",
      }),
    ).resolves.toEqual({
      voiceEnabled: true,
      ownerAccessEnabled: false,
    });
  });

  it("treats a missing owner-access offering as disabled", async () => {
    const source = createMyTwinFeatureSource({
      voice: {
        async isEnabled() {
          return false;
        },
      },
      ownerAccess: {
        async readOffering() {
          return null;
        },
      },
    });

    const value = await source.read({
      tenantId: "tenant-1",
      ownerUserId: "user-owner",
      characterId: "character-1",
    });

    expect(value.voiceEnabled).toBe(false);
    expect(value.ownerAccessEnabled).toBe(false);
  });
});

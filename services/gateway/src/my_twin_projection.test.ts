import { describe, expect, it } from "vitest";
import {
  createMyTwinProjectionService,
  type MyTwinAuthorizer,
  type MyTwinFeatureSource,
  type MyTwinPerformanceSource,
  type MyTwinProfileSource,
} from "./my_twin_projection.js";

function build(options?: { hasTwin?: boolean }) {
  const authorizer: MyTwinAuthorizer = {
    async authorize() {
      return { tenantId: "tenant-1", userId: "user-owner" };
    },
  };
  const profiles: MyTwinProfileSource = {
    async read() {
      if (options?.hasTwin === false) return null;
      return {
        characterId: "character-owner",
        publicId: "abdullahi",
        displayName: "Abdullahi",
        bio: "Technology and business",
        languages: ["English", "Hausa"],
        discoverable: true,
        revision: 1,
      };
    },
    async setDiscoverable(input) {
      return {
        characterId: "character-owner",
        publicId: "abdullahi",
        displayName: "Abdullahi",
        bio: "Technology and business",
        languages: ["English", "Hausa"],
        discoverable: input.discoverable,
        revision: 2,
      };
    },
  };
  const performance: MyTwinPerformanceSource = {
    async read() {
      return {
        visitors: 12,
        conversations: 7,
        earningsCredits: 850,
        pendingOwnerRequests: 2,
      };
    },
  };
  const features: MyTwinFeatureSource = {
    async read() {
      return { voiceEnabled: true, ownerAccessEnabled: true };
    },
  };
  return createMyTwinProjectionService({
    authorizer,
    profiles,
    performance,
    features,
    publicTwinBaseUrl: "https://masanawa.com",
  });
}

describe("My Twin projection", () => {
  it("composes one simple consumer view from canonical sources", async () => {
    const view = await build().read({
      authorizationHeader: "Bearer owner",
    });

    expect(view.hasTwin).toBe(true);
    expect(view.publicUrl).toBe("https://masanawa.com/abdullahi");
    expect(view.voiceEnabled).toBe(true);
    expect(view.ownerAccessEnabled).toBe(true);
    expect(view.summary.earningsCredits).toBe(850);
    expect(JSON.stringify(view)).not.toContain("Agent Float");
    expect(JSON.stringify(view)).not.toContain("CharacterVersion");
    expect(JSON.stringify(view)).not.toContain("SkillVersion");
  });

  it("returns a stable empty state when no twin exists", async () => {
    const view = await build({ hasTwin: false }).read({
      authorizationHeader: "Bearer owner",
    });

    expect(view.hasTwin).toBe(false);
    expect(view.characterId).toBeNull();
    expect(view.summary).toEqual({
      visitors: 0,
      conversations: 0,
      earningsCredits: 0,
      pendingOwnerRequests: 0,
    });
  });

  it("updates discoverability through the canonical profile source", async () => {
    const view = await build().setDiscoverable({
      authorizationHeader: "Bearer owner",
      discoverable: false,
    });

    expect(view.discoverable).toBe(false);
    expect(view.publicUrl).toBe("https://masanawa.com/abdullahi");
  });

  it("requires HTTPS public twin links", () => {
    expect(() =>
      createMyTwinProjectionService({
        authorizer: {} as MyTwinAuthorizer,
        profiles: {} as MyTwinProfileSource,
        performance: {} as MyTwinPerformanceSource,
        features: {} as MyTwinFeatureSource,
        publicTwinBaseUrl: "http://masanawa.com",
      }),
    ).toThrow("HTTPS");
  });
});

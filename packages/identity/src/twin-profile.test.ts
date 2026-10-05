import { describe, expect, it } from "vitest";
import type { TwinPublicProfile } from "./twin-profile.js";
import {
  assertStableTwinShareIdentity,
  assertTwinProfileCustomizationConfirmed,
  planTwinProfileCustomization,
  projectPublicTwinProfile,
} from "./twin-profile.js";

const profile: TwinPublicProfile = {
  tenantId: "tenant_00000000-0000-4000-8000-000000000001" as never,
  characterId: "character_00000000-0000-4000-8000-000000000002" as never,
  ownerUserId: "user_00000000-0000-4000-8000-000000000003" as never,
  publicId: "amina-bello",
  displayName: "Amina Bello",
  bio: "Teacher and storyteller",
  interests: ["learning", "history"],
  languages: ["English", "Hausa"],
  avatarUrl: null,
  discoverable: true,
  revision: 3,
  createdAt: "2026-10-05T08:00:00.000Z" as never,
  updatedAt: "2026-10-05T08:30:00.000Z" as never,
};

describe("twin public profile", () => {
  it("projects public fields without owner identity and clearly labels AI representation", () => {
    const view = projectPublicTwinProfile(profile);
    expect(view).toMatchObject({
      publicId: "amina-bello",
      displayName: "Amina Bello",
      representationLabel: "AI twin",
      ownerPresence: "not-present",
    });
    expect(JSON.stringify(view)).not.toContain("ownerUserId");
    expect(JSON.stringify(view)).not.toContain("revision");
  });

  it("does not project a non-discoverable twin", () => {
    expect(projectPublicTwinProfile({ ...profile, discoverable: false })).toBeNull();
  });

  it("allows low-risk conversational edits without a confirmation gate", () => {
    const plan = planTwinProfileCustomization({
      current: profile,
      patch: { bio: "Teacher, storyteller and history enthusiast" },
    });
    expect(plan.requiresConfirmation).toBe(false);
    expect(() =>
      assertTwinProfileCustomizationConfirmed({ plan, confirmed: false }),
    ).not.toThrow();
  });

  it("requires explicit confirmation for standing discoverability changes", () => {
    const plan = planTwinProfileCustomization({
      current: profile,
      patch: { discoverable: false },
    });
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.standingChanges).toEqual(["hide-profile"]);
    expect(() =>
      assertTwinProfileCustomizationConfirmed({ plan, confirmed: false }),
    ).toThrow("explicit owner confirmation");
    expect(() =>
      assertTwinProfileCustomizationConfirmed({ plan, confirmed: true }),
    ).not.toThrow();
  });

  it("keeps the public share identity stable across revisions", () => {
    expect(() =>
      assertStableTwinShareIdentity({
        previous: profile,
        next: { ...profile, revision: 4, bio: "Updated" },
      }),
    ).not.toThrow();
    expect(() =>
      assertStableTwinShareIdentity({
        previous: profile,
        next: { ...profile, publicId: "different-id" },
      }),
    ).toThrow("immutable");
  });
});

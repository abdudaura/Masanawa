import { describe, expect, it } from "vitest";
import {
  assertStableTwinShareIdentity,
  projectPublicTwinProfile,
  type TwinPublicProfile,
} from "../../packages/identity/src/twin-profile.js";
import { admitTwinInteraction } from "../../services/gateway/src/twin_chat_admission.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const characterId = "character_00000000-0000-4000-8000-000000000002" as never;
const ownerUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const visitorUserId = "user_00000000-0000-4000-8000-000000000004";

const profile: TwinPublicProfile = {
  tenantId,
  characterId,
  ownerUserId,
  publicId: "amina-bello",
  displayName: "Amina Bello",
  bio: "Teacher and storyteller",
  interests: ["learning", "history"],
  languages: ["English", "Hausa"],
  avatarUrl: null,
  discoverable: true,
  revision: 4,
  createdAt: "2026-10-05T08:00:00.000Z" as never,
  updatedAt: "2026-10-06T09:00:00.000Z" as never,
};

describe("TWIN-100 public Twin share -> free text acceptance", () => {
  it("exposes a stable public share identity without owner identity", () => {
    const shared = projectPublicTwinProfile(profile);
    expect(shared).not.toBeNull();
    expect(shared).toMatchObject({
      characterId,
      publicId: "amina-bello",
      displayName: "Amina Bello",
      representationLabel: "AI twin",
      ownerPresence: "not-present",
    });

    const serialized = JSON.stringify(shared);
    expect(serialized).not.toContain(String(ownerUserId));
    expect(serialized).not.toContain("ownerUserId");
    expect(serialized).not.toContain("revision");
  });

  it("keeps the public share route identity immutable across profile revisions", () => {
    expect(() =>
      assertStableTwinShareIdentity({
        previous: profile,
        next: {
          ...profile,
          revision: profile.revision + 1,
          bio: "Teacher, storyteller and history enthusiast",
          updatedAt: "2026-10-06T10:00:00.000Z" as never,
        },
      }),
    ).not.toThrow();

    expect(() =>
      assertStableTwinShareIdentity({
        previous: profile,
        next: {
          ...profile,
          revision: profile.revision + 1,
          publicId: "different-share-id",
          updatedAt: "2026-10-06T10:00:00.000Z" as never,
        },
      }),
    ).toThrow("immutable");
  });

  it("admits another user's text interaction as free with zero financial admission", () => {
    const shared = projectPublicTwinProfile(profile);
    if (shared === null) throw new Error("Expected discoverable public Twin");

    const admission = admitTwinInteraction({
      interaction: "text-message",
      userId: visitorUserId,
      characterId: shared.characterId,
      now: "2026-10-06T10:05:00.000Z",
    });

    expect(admission).toEqual({
      interaction: "text-message",
      chargeMode: "free",
      chargeCredits: 0,
      paidAdmissionId: null,
    });
  });

  it("cannot make public text billable by attaching paid-voice evidence", () => {
    const admission = admitTwinInteraction({
      interaction: "text-message",
      userId: visitorUserId,
      characterId,
      now: "2026-10-06T10:05:00.000Z",
      paidAdmission: {
        admissionId: "voice-admission-should-not-charge-text",
        userId: visitorUserId,
        characterId,
        chargeMode: "paid",
        admittedAt: "2026-10-06T10:00:00.000Z",
        expiresAt: "2026-10-06T10:30:00.000Z",
      },
    });

    expect(admission.chargeMode).toBe("free");
    expect(admission.chargeCredits).toBe(0);
    expect(admission.paidAdmissionId).toBeNull();
  });

  it("does not expose a shareable public projection when the owner disables discoverability", () => {
    expect(
      projectPublicTwinProfile({
        ...profile,
        discoverable: false,
        revision: profile.revision + 1,
        updatedAt: "2026-10-06T10:10:00.000Z" as never,
      }),
    ).toBeNull();
  });
});

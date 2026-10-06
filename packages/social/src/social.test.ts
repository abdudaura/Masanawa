import { describe, expect, it } from "vitest";
import {
  archiveSocialContent,
  createSocialAccountBinding,
  createSocialContent,
  markSocialContentReady,
  revokeSocialAccountBinding,
} from "./social.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const characterId =
  "character_00000000-0000-7000-8000-000000000002" as never;
const linkedByUserId =
  "user_00000000-0000-7000-8000-000000000003" as never;
const socialContentId =
  "social-content_00000000-0000-7000-8000-000000000004" as never;

function binding() {
  return createSocialAccountBinding({
    tenantId,
    characterId,
    linkedByUserId,
    account: {
      system: "instagram",
      namespace: "account",
      value: "acct-123",
      subjectKind: "user",
      authenticationStrength: "linked",
      observedAt: "2026-10-06T10:00:00.000Z" as never,
    },
    linkedAt: "2026-10-06T10:01:00.000Z" as never,
  });
}

describe("social identity and content", () => {
  it("binds linked external account evidence to one canonical Character", () => {
    expect(binding()).toMatchObject({
      tenantId,
      characterId,
      accountKey: "instagram:account:acct-123",
      state: "active",
      revision: 1,
    });
  });

  it("rejects unverified transport observations as account ownership", () => {
    expect(() =>
      createSocialAccountBinding({
        tenantId,
        characterId,
        linkedByUserId,
        account: {
          system: "instagram",
          namespace: "account",
          value: "acct-123",
          subjectKind: "user",
          authenticationStrength: "transport-verified",
          observedAt: "2026-10-06T10:00:00.000Z" as never,
        },
        linkedAt: "2026-10-06T10:01:00.000Z" as never,
      }),
    ).toThrow("linked or strong");
  });

  it("creates bounded canonical draft content without provider publication state", () => {
    const content = createSocialContent({
      binding: binding(),
      socialContentId,
      text: "Hello from Masanawa",
      media: [],
      audience: "public",
      createdAt: "2026-10-06T10:02:00.000Z" as never,
    });
    expect(content).toMatchObject({
      tenantId,
      characterId,
      socialContentId,
      accountKey: "instagram:account:acct-123",
      state: "draft",
      audience: "public",
    });
    expect(content).not.toHaveProperty("providerPostId");
    expect(content).not.toHaveProperty("publicationId");
  });

  it("requires the exact active binding before content becomes ready", () => {
    const active = binding();
    const content = createSocialContent({
      binding: active,
      socialContentId,
      text: "Ready later",
      media: [],
      audience: "followers",
      createdAt: "2026-10-06T10:02:00.000Z" as never,
    });
    const revoked = revokeSocialAccountBinding({
      binding: active,
      expectedRevision: 1,
      revokedAt: "2026-10-06T10:03:00.000Z",
    });
    expect(() =>
      markSocialContentReady({
        content,
        binding: revoked,
        expectedRevision: 1,
        readyAt: "2026-10-06T10:04:00.000Z",
      }),
    ).toThrow("scope mismatch");

    expect(
      markSocialContentReady({
        content,
        binding: active,
        expectedRevision: 1,
        readyAt: "2026-10-06T10:04:00.000Z",
      }).state,
    ).toBe("ready");
  });

  it("uses revision custody for account revocation and content lifecycle", () => {
    expect(() =>
      revokeSocialAccountBinding({
        binding: binding(),
        expectedRevision: 2,
        revokedAt: "2026-10-06T10:03:00.000Z",
      }),
    ).toThrow("stale");

    const content = createSocialContent({
      binding: binding(),
      socialContentId,
      text: null,
      media: [{
        system: "object-storage",
        namespace: "media",
        value: "artifact-1",
        observedAt: "2026-10-06T10:01:00.000Z" as never,
      }],
      audience: "private",
      createdAt: "2026-10-06T10:02:00.000Z" as never,
    });
    const archived = archiveSocialContent({
      content,
      expectedRevision: 1,
      archivedAt: "2026-10-06T10:05:00.000Z",
    });
    expect(archived).toMatchObject({
      state: "archived",
      revision: 2,
      archivedAt: "2026-10-06T10:05:00.000Z",
    });
  });
});

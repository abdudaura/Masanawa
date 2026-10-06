import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type {
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
  UserAgentPreference,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import type {
  UserCharacterRelationship,
  UserRelationshipProvisioner,
} from "@masanawa/identity";
import { createDeterministicChannelRouter } from "./channel-routing.js";

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const gwaniId = createCanonicalId("character");
const gwanaId = createCanonicalId("character");
const relationshipId = createCanonicalId("relationship");
const observedAt = toInstant("2026-10-06T17:00:00.000Z");

function profile(
  characterId: typeof gwaniId,
  overrides: Partial<PlatformAgentProfile> = {},
): PlatformAgentProfile {
  return {
    schemaVersion: 1,
    tenantId,
    characterId,
    supportAgent: true,
    defaultForNewUsers: false,
    voiceProvider: "gemini",
    voiceName: "Bodi",
    revision: 1,
    ...overrides,
  };
}

function preference(
  characterId: typeof gwaniId,
  overrides: Partial<UserAgentPreference> = {},
): UserAgentPreference {
  return {
    schemaVersion: 1,
    tenantId,
    userId,
    defaultPlatformCharacterId: characterId,
    revision: 1,
    ...overrides,
  };
}

function relationship(
  characterId: typeof gwaniId,
  overrides: Partial<UserCharacterRelationship> = {},
): UserCharacterRelationship {
  return {
    tenantId,
    relationshipId,
    userId,
    characterId,
    state: "active",
    stage: null,
    tone: null,
    preferences: {},
    disclosures: {},
    permissions: {},
    revision: 1,
    createdAt: observedAt,
    updatedAt: observedAt,
    ...overrides,
  };
}

function agentRepo(input: {
  profiles?: PlatformAgentProfile[];
} = {}): PlatformAgentProfileRepository {
  const profiles =
    input.profiles ??
    [
      profile(gwaniId, { defaultForNewUsers: true }),
      profile(gwanaId, { voiceName: "Sulafat" }),
    ];
  return {
    async readForCharacter(request) {
      return (
        profiles.find(
          (item) =>
            item.tenantId === request.tenantId &&
            item.characterId === request.characterId,
        ) ?? null
      );
    },
    async listSupportAgents(request) {
      return profiles.filter(
        (item) =>
          item.tenantId === request.tenantId && item.supportAgent === true,
      );
    },
    async put(input) {
      return input.profile;
    },
  };
}

function preferenceRepo(
  value: UserAgentPreference | null,
): UserAgentPreferenceRepository {
  return {
    async readForUser() {
      return value;
    },
    async put(input) {
      return input.preference;
    },
  };
}

function relationshipRepo(
  value: UserCharacterRelationship,
): UserRelationshipProvisioner {
  return {
    async getOrCreateForUserCharacter() {
      return value;
    },
  };
}

describe("deterministic channel routing", () => {
  it("uses explicit user platform-agent preference when valid", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo(),
      userPreferences: preferenceRepo(preference(gwanaId)),
      relationships: relationshipRepo(relationship(gwanaId)),
    });

    const route = await router.resolve({
      tenantId,
      userId,
      observedAt,
    });

    expect(route).toEqual({
      tenantId,
      userId,
      characterId: gwanaId,
      relationshipId,
      source: "user-preference",
    });
  });

  it("uses exactly one tenant default support Character when no preference exists", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo(),
      userPreferences: preferenceRepo(null),
      relationships: relationshipRepo(relationship(gwaniId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).resolves.toEqual({
      tenantId,
      userId,
      characterId: gwaniId,
      relationshipId,
      source: "tenant-default",
    });
  });

  it("fails closed when no default support Character exists", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo({
        profiles: [
          profile(gwaniId),
          profile(gwanaId, { voiceName: "Sulafat" }),
        ],
      }),
      userPreferences: preferenceRepo(null),
      relationships: relationshipRepo(relationship(gwaniId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/No default support platform Character/);
  });

  it("fails closed when multiple support Characters are marked default", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo({
        profiles: [
          profile(gwaniId, { defaultForNewUsers: true }),
          profile(gwanaId, {
            defaultForNewUsers: true,
            voiceName: "Sulafat",
          }),
        ],
      }),
      userPreferences: preferenceRepo(null),
      relationships: relationshipRepo(relationship(gwaniId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/Multiple default support platform Characters/);
  });

  it("does not silently fall back when an explicit preference points to an invalid agent", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo({
        profiles: [
          profile(gwaniId, { defaultForNewUsers: true }),
          profile(gwanaId, {
            supportAgent: false,
            voiceName: "Sulafat",
          }),
        ],
      }),
      userPreferences: preferenceRepo(preference(gwanaId)),
      relationships: relationshipRepo(relationship(gwanaId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/not an admitted support platform agent/);
  });

  it("rejects preference scope substitution", async () => {
    const otherUserId = createCanonicalId("user");
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo(),
      userPreferences: preferenceRepo(
        preference(gwanaId, { userId: otherUserId }),
      ),
      relationships: relationshipRepo(relationship(gwanaId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/preference does not match channel route scope/);
  });

  it("rejects a canonical Relationship returned for another Character", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo(),
      userPreferences: preferenceRepo(preference(gwanaId)),
      relationships: relationshipRepo(relationship(gwaniId)),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/Relationship does not match deterministic channel route/);
  });

  it("rejects archived Relationships instead of routing through stale authority", async () => {
    const router = createDeterministicChannelRouter({
      platformAgents: agentRepo(),
      userPreferences: preferenceRepo(null),
      relationships: relationshipRepo(
        relationship(gwaniId, { state: "archived" }),
      ),
    });

    await expect(
      router.resolve({ tenantId, userId, observedAt }),
    ).rejects.toThrow(/Relationship does not match deterministic channel route/);
  });
});

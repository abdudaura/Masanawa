import type {
  CharacterId,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type {
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import type {
  UserCharacterRelationship,
  UserRelationshipProvisioner,
} from "@masanawa/identity";

export interface DeterministicChannelRoute {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
  readonly source: "user-preference" | "tenant-default";
}

export interface DeterministicChannelRouterPorts {
  readonly platformAgents: PlatformAgentProfileRepository;
  readonly userPreferences: UserAgentPreferenceRepository;
  readonly relationships: UserRelationshipProvisioner;
}

function assertUsableProfile(input: {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly profile: PlatformAgentProfile | null;
}): PlatformAgentProfile {
  const profile = input.profile;
  if (
    profile === null ||
    profile.tenantId !== input.tenantId ||
    profile.characterId !== input.characterId ||
    profile.supportAgent !== true
  ) {
    throw new Error(
      "Configured channel Character is not an admitted support platform agent",
    );
  }
  return profile;
}

function assertRelationship(input: {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationship: UserCharacterRelationship;
}): UserCharacterRelationship {
  if (
    input.relationship.tenantId !== input.tenantId ||
    input.relationship.userId !== input.userId ||
    input.relationship.characterId !== input.characterId ||
    input.relationship.state !== "active"
  ) {
    throw new Error(
      "Canonical Relationship does not match deterministic channel route",
    );
  }
  return input.relationship;
}

async function selectCharacter(input: {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly platformAgents: PlatformAgentProfileRepository;
  readonly userPreferences: UserAgentPreferenceRepository;
}): Promise<{
  readonly characterId: CharacterId;
  readonly source: DeterministicChannelRoute["source"];
}> {
  const preference = await input.userPreferences.readForUser({
    tenantId: input.tenantId,
    userId: input.userId,
  });

  if (preference !== null) {
    if (
      preference.tenantId !== input.tenantId ||
      preference.userId !== input.userId
    ) {
      throw new Error(
        "User platform-agent preference does not match channel route scope",
      );
    }

    const profile = await input.platformAgents.readForCharacter({
      tenantId: input.tenantId,
      characterId: preference.defaultPlatformCharacterId,
    });
    assertUsableProfile({
      tenantId: input.tenantId,
      characterId: preference.defaultPlatformCharacterId,
      profile,
    });

    return Object.freeze({
      characterId: preference.defaultPlatformCharacterId,
      source: "user-preference" as const,
    });
  }

  const supportAgents = await input.platformAgents.listSupportAgents({
    tenantId: input.tenantId,
  });
  const defaults = supportAgents.filter(
    (profile) =>
      profile.tenantId === input.tenantId &&
      profile.supportAgent === true &&
      profile.defaultForNewUsers === true,
  );

  if (defaults.length !== 1) {
    throw new Error(
      defaults.length === 0
        ? "No default support platform Character is configured for this Tenant"
        : "Multiple default support platform Characters are configured for this Tenant",
    );
  }

  const selected = defaults[0]!;
  assertUsableProfile({
    tenantId: input.tenantId,
    characterId: selected.characterId,
    profile: selected,
  });

  return Object.freeze({
    characterId: selected.characterId,
    source: "tenant-default" as const,
  });
}

export function createDeterministicChannelRouter(
  ports: DeterministicChannelRouterPorts,
) {
  return Object.freeze({
    async resolve(input: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly observedAt: Instant;
    }): Promise<DeterministicChannelRoute> {
      const selection = await selectCharacter({
        tenantId: input.tenantId,
        userId: input.userId,
        platformAgents: ports.platformAgents,
        userPreferences: ports.userPreferences,
      });

      const relationship = await ports.relationships.getOrCreateForUserCharacter({
        tenantId: input.tenantId,
        userId: input.userId,
        characterId: selection.characterId,
        createdAt: input.observedAt,
      });

      const admitted = assertRelationship({
        tenantId: input.tenantId,
        userId: input.userId,
        characterId: selection.characterId,
        relationship,
      });

      return Object.freeze({
        tenantId: input.tenantId,
        userId: input.userId,
        characterId: selection.characterId,
        relationshipId: admitted.relationshipId,
        source: selection.source,
      });
    },
  });
}

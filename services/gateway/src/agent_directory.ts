import type {
  AgentPresentationRepository,
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
  MobileAgentActivityRepository,
} from "@masanawa/agents";
import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";
import { parseCanonicalId } from "@masanawa/contracts";

export interface AgentDirectoryAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterIds?: readonly CharacterId[];
}

export interface AgentDirectoryAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "agents.directory.read" | "agents.preferences.write";
  }): Promise<AgentDirectoryAuthority>;
}

export interface MobileAgentDirectoryEntry {
  readonly characterId: string;
  readonly characterVersionId: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly about: string;
  readonly greeting: string | null;
  /** Presence is transient activity, not proof of model, voice or Seat readiness. */
  readonly presence: "available" | "listening" | "working" | "on_call" | "offline" | "unknown";
  readonly activeWorkCount: number;
  readonly supportAgent: boolean;
  readonly defaultPlatformAgent: boolean;
  readonly voiceProvider: string | null;
  readonly voiceName: string | null;
  readonly roomId?: string;
}

export interface AgentRoomDirectoryReader {
  readPublished(input:{readonly tenantId:TenantId;readonly characterIds:readonly CharacterId[]}):Promise<ReadonlyMap<CharacterId,string>>;
}
export interface AgentDirectoryService {
  list(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly MobileAgentDirectoryEntry[]>;

  setDefaultPlatformAgent(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
  }): Promise<{
    readonly characterId: CharacterId;
  }>;
}

/**
 * Authorized projection only. It never exposes Character Skill assignments:
 * runtime eligibility/authority stays server-side.
 *
 * Presence is informational activity. Missing activity is unknown rather than
 * "available": a visible Character is not necessarily provisioned or online.
 * Presence must never be used as a voice or paid-Seat admission guarantee.
 */
export function createAgentDirectoryService(input: {
  readonly presentations: AgentPresentationRepository;
  readonly authorizer: AgentDirectoryAuthorizer;
  readonly platformProfiles?: PlatformAgentProfileRepository;
  readonly userPreferences?: UserAgentPreferenceRepository;
  readonly activity?: MobileAgentActivityRepository;
  readonly rooms?: AgentRoomDirectoryReader;
}): AgentDirectoryService {
  return Object.freeze<AgentDirectoryService>({
    async list(
      request: Parameters<AgentDirectoryService["list"]>[0],
    ) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.directory.read",
      });
      const presentations = await input.presentations.listVisible({
        tenantId: authority.tenantId,
      });
      const allowed = authority.characterIds
        ? new Set(authority.characterIds)
        : null;
      const visible = presentations.filter(
        (presentation) =>
          allowed === null || allowed.has(presentation.characterId),
      );

      const characterIds = visible.map((item) => item.characterId);
      const [preference, profiles, activity, rooms] = await Promise.all([
        input.userPreferences?.readForUser({
          tenantId: authority.tenantId,
          userId: authority.userId,
        }) ?? Promise.resolve(null),
        Promise.all(
          visible.map(async (presentation) => ({
            characterId: presentation.characterId,
            profile:
              (await input.platformProfiles?.readForCharacter({
                tenantId: authority.tenantId,
                characterId: presentation.characterId,
              })) ?? null,
          })),
        ),
        input.activity
          ? input.activity.list({
              tenantId: authority.tenantId,
              userId: authority.userId,
              characterIds,
            })
          : Promise.resolve([]),
        input.rooms ? input.rooms.readPublished({tenantId:authority.tenantId,characterIds})
          : Promise.resolve(new Map<CharacterId,string>()),
      ]);
      const profileByCharacter = new Map(
        profiles.map(({ characterId, profile }) => [characterId, profile]),
      );
      const activityByCharacter = new Map(
        activity.map((item) => [item.characterId, item] as const),
      );

      return Object.freeze(
        visible.map((presentation) => {
          const profile =
            profileByCharacter.get(presentation.characterId) ?? null;
          const currentActivity =
            activityByCharacter.get(presentation.characterId) ?? null;
          const defaultPlatformAgent =
            profile?.supportAgent === true &&
            (preference
              ? preference.defaultPlatformCharacterId ===
                presentation.characterId
              : profile.defaultForNewUsers);

          return Object.freeze({
            characterId: presentation.characterId,
            characterVersionId: presentation.characterVersionId,
            displayName: presentation.displayName,
            roleLabel: presentation.roleLabel,
            about: presentation.about,
            greeting: presentation.greeting,
            presence: currentActivity?.presence ?? ("unknown" as const),
            activeWorkCount: currentActivity?.activeWorkCount ?? 0,
            supportAgent: profile?.supportAgent ?? false,
            defaultPlatformAgent,
            voiceProvider: profile?.voiceProvider ?? null,
            voiceName: profile?.voiceName ?? null,
            ...(rooms.has(presentation.characterId)
              ? {roomId:rooms.get(presentation.characterId)} : {}),
          });
        }),
      );
    },

    async setDefaultPlatformAgent(request) {
      if (!input.platformProfiles || !input.userPreferences) {
        throw new Error("Platform agent preferences are unavailable");
      }
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "agents.preferences.write",
      });
      const characterId = parseCanonicalId(
        "character",
        request.characterId,
      );
      if (
        authority.characterIds &&
        !authority.characterIds.includes(characterId)
      ) {
        throw new Error("Character is not available to this user");
      }
      const profile = await input.platformProfiles.readForCharacter({
        tenantId: authority.tenantId,
        characterId,
      });
      if (!profile?.supportAgent) {
        throw new Error("Selected Character is not a platform support agent");
      }

      const existing = await input.userPreferences.readForUser({
        tenantId: authority.tenantId,
        userId: authority.userId,
      });
      await input.userPreferences.put({
        expectedRevision: existing?.revision ?? null,
        preference: {
          schemaVersion: 1,
          tenantId: authority.tenantId,
          userId: authority.userId,
          defaultPlatformCharacterId: characterId,
          revision: existing?.revision ?? 1,
        },
      });
      return Object.freeze({ characterId });
    },
  });
}

import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import {
  createCanonicalId,
  nowInstant,
  type CharacterId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import type { CharacterConstitution } from "@masanawa/identity";
import type { SkillDistributionRepository } from "@masanawa/skills";

interface DefaultPlatformAgentSeed {
  readonly displayName: string;
  readonly voiceName: string;
  readonly defaultForNewUsers: boolean;
  readonly sortOrder: number;
}

const DEFAULT_PLATFORM_AGENTS: readonly DefaultPlatformAgentSeed[] =
  Object.freeze([
    Object.freeze({
      displayName: "Gwani",
      voiceName: "Bodi",
      defaultForNewUsers: true,
      sortOrder: 0,
    }),
    Object.freeze({
      displayName: "Gwana",
      voiceName: "Sulafat",
      defaultForNewUsers: false,
      sortOrder: 1,
    }),
  ]);

export interface PlatformAgentIdentityProvisioner {
  provision(input: Readonly<{
    tenantId: TenantId;
    characterId: CharacterId;
    characterVersionId: ReturnType<typeof createCanonicalId<"character-version">>;
    constitution: CharacterConstitution;
    createdAt: Instant;
  }>): Promise<void>;
}

export interface PlatformAgentBootstrapResult {
  readonly changed: boolean;
  readonly supportAgentCount: number;
  readonly characterIds: readonly CharacterId[];
}

/**
 * Seeds the two canonical Masanawa support Characters only for a tenant that
 * has no support-agent profiles yet.
 *
 * This is deliberately server-side and one-way: once an admin-managed support
 * roster exists, startup never modifies or replaces it. Existing visible
 * Gwani/Gwana presentations can be completed after an interrupted seed without
 * inventing duplicate Characters.
 */
export async function ensureDefaultPlatformAgents(input: Readonly<{
  tenantId: TenantId;
  identity: PlatformAgentIdentityProvisioner;
  presentations: AgentPresentationRepository;
  profiles: PlatformAgentProfileRepository;
  skillAssignments: CharacterSkillAssignmentRepository;
  skillDistribution: SkillDistributionRepository;
  now?: () => Instant;
}>): Promise<PlatformAgentBootstrapResult> {
  const existingSupport = await input.profiles.listSupportAgents({
    tenantId: input.tenantId,
  });
  if (existingSupport.length > 0) {
    return Object.freeze({
      changed: false,
      supportAgentCount: existingSupport.length,
      characterIds: Object.freeze(
        existingSupport.map((profile) => profile.characterId),
      ),
    });
  }

  const createdAt = input.now?.() ?? nowInstant();
  const allPresentations = [
    ...(await input.presentations.listAll({ tenantId: input.tenantId })),
  ];
  const supportSkills = await input.skillDistribution.listForAudience(
    "platform-support",
  );
  const skillVersionIds = Object.freeze(
    supportSkills
      .filter((profile) => profile.installMode !== "hidden")
      .map((profile) => profile.skillVersionId),
  );

  const prepared: Array<{
    readonly seed: DefaultPlatformAgentSeed;
    readonly presentation: AgentPresentation;
  }> = [];
  let changed = false;

  for (const seed of DEFAULT_PLATFORM_AGENTS) {
    const existing = allPresentations.find(
      (presentation) =>
        presentation.displayName.trim().toLocaleLowerCase("en") ===
        seed.displayName.toLocaleLowerCase("en"),
    );

    // Respect an intentionally hidden admin-owned presentation.
    if (existing && !existing.visibleInUserApp) continue;

    let presentation = existing;
    if (!presentation) {
      const characterId = createCanonicalId("character");
      const characterVersionId = createCanonicalId("character-version");

      await input.identity.provision({
        tenantId: input.tenantId,
        characterId,
        characterVersionId,
        constitution: Object.freeze({
          schemaVersion: 1,
          displayName: seed.displayName,
          biography: `${seed.displayName} is a Masanawa platform support Character.`,
          personality: Object.freeze([
            "helpful",
            "clear",
            "practical",
            "respectful",
          ]),
          boundaries: Object.freeze([
            "Do not claim capabilities or completed actions without runtime evidence.",
            "Do not invent prices, balances, earnings, availability, or fulfillment status.",
            "Treat support, onboarding, creator guidance, and product discovery as the same peer platform role.",
          ]),
          disclosurePolicy: Object.freeze({}),
          languages: Object.freeze(["en", "ha"]),
          voiceReferences: Object.freeze([]),
          appearanceReferences: Object.freeze([]),
          expertise: Object.freeze([
            "Masanawa onboarding",
            "creator guidance",
            "product and service discovery",
            "platform support",
          ]),
        }),
        createdAt,
      });

      presentation = await input.presentations.put({
        expectedRevision: null,
        presentation: {
          schemaVersion: 1,
          tenantId: input.tenantId,
          characterId,
          characterVersionId,
          displayName: seed.displayName,
          roleLabel: "Masanawa Support",
          about:
            "Onboarding, platform support, creator guidance, and product/service discovery.",
          greeting: `Hi, I’m ${seed.displayName}. What would you like to do on Masanawa?`,
          visibleInUserApp: true,
          sortOrder: seed.sortOrder,
          revision: 1,
        },
      });
      allPresentations.push(presentation);
      changed = true;
    }

    const assignment = await input.skillAssignments.readForCharacter({
      tenantId: input.tenantId,
      characterId: presentation.characterId,
    });
    if (!assignment) {
      await input.skillAssignments.put({
        expectedRevision: null,
        assignment: {
          schemaVersion: 1,
          tenantId: input.tenantId,
          characterId: presentation.characterId,
          skillVersionIds,
          revision: 1,
        },
      });
      changed = true;
    }

    prepared.push(Object.freeze({ seed, presentation }));
  }

  // Profiles are created last so an interrupted bootstrap can reuse completed
  // presentations on the next attempt instead of duplicating Characters.
  for (const { seed, presentation } of prepared) {
    const profile = await input.profiles.readForCharacter({
      tenantId: input.tenantId,
      characterId: presentation.characterId,
    });
    if (profile) continue;
    await input.profiles.put({
      expectedRevision: null,
      profile: {
        schemaVersion: 1,
        tenantId: input.tenantId,
        characterId: presentation.characterId,
        supportAgent: true,
        defaultForNewUsers: seed.defaultForNewUsers,
        voiceProvider: "gemini",
        voiceName: seed.voiceName,
        revision: 1,
      },
    });
    changed = true;
  }

  const support = await input.profiles.listSupportAgents({
    tenantId: input.tenantId,
  });
  return Object.freeze({
    changed,
    supportAgentCount: support.length,
    characterIds: Object.freeze(support.map((profile) => profile.characterId)),
  });
}

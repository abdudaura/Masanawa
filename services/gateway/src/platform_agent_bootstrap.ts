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
  type CharacterVersionId,
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
    characterVersionId: CharacterVersionId;
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
 * Provisions missing canonical support identities and resumes an interrupted
 * Gwani/Gwana seed without overwriting an administrator's existing profiles.
 *
 * A tenant with noncanonical support entries is admin-managed and must never
 * be silently converted to a default roster. Profiles with an existing
 * administrator-chosen voice/default and hidden presentations are immutable.
 * Other fifteen Experts need an independently qualified voice/runtime path.
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
  const allPresentations = [
    ...(await input.presentations.listAll({ tenantId: input.tenantId })),
  ];
  const supportedNames = new Set(
    DEFAULT_PLATFORM_AGENTS.map((seed) => seed.displayName.toLowerCase()),
  );
  const knownProfileNames = existingSupport.map((profile) =>
    allPresentations.find(
      (presentation) => presentation.characterId === profile.characterId,
    )?.displayName.trim().toLowerCase(),
  );
  const existingDefault = existingSupport.some(
    (profile) => profile.defaultForNewUsers,
  );
  const unchanged = (): PlatformAgentBootstrapResult => Object.freeze({
    changed: false,
    supportAgentCount: existingSupport.length,
    characterIds: Object.freeze(
      existingSupport.map((profile) => profile.characterId),
    ),
  });

  // An admin-created support profile, orphaned identity, duplicate name or a
  // full existing pair makes ownership ambiguous. Do not guess or overwrite.
  if (existingSupport.length > 0 &&
      (existingSupport.length >= DEFAULT_PLATFORM_AGENTS.length ||
        knownProfileNames.some((name) => !name || !supportedNames.has(name)) ||
        new Set(knownProfileNames).size !== existingSupport.length)) {
    return unchanged();
  }

  const createdAt = input.now?.() ?? nowInstant();
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
    const canonicalName = seed.displayName.toLowerCase();
    // Existing default profiles/voice selections must never be rewritten.
    if (knownProfileNames.includes(canonicalName)) continue;
    const candidates = allPresentations.filter(
      (presentation) =>
        presentation.displayName.trim().toLowerCase() === canonicalName,
    );
    if (candidates.length > 1) continue;
    const existing = candidates[0];

    // Never convert a hidden or admin-owned specialist into platform support.
    // A presentation left by this bootstrap has the canonical support role.
    if (existing && (!existing.visibleInUserApp ||
        existing.roleLabel !== "Masanawa Support")) continue;

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
        defaultForNewUsers: seed.defaultForNewUsers && !existingDefault,
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


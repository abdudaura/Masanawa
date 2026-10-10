import type { AgentPresentationRepository } from "@masanawa/agents";
import { createCanonicalId, nowInstant, type CharacterId, type CharacterVersionId, type TenantId, type Instant } from "@masanawa/contracts";
import type { CharacterVersionReader, CharacterOwnershipReader } from "@masanawa/identity";
import type { PlatformAgentIdentityProvisioner } from "../platform_agent_bootstrap.js";
import { CANONICAL_EXPERT_DRAFTS, type CanonicalPersonaSpec } from "./catalog.js";

export interface PersonaSeedBinding {
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
}

/** Durable, per-(tenant, seed) exclusive lock and immutable ID reservation.
 * A reservation MUST survive a failed identity/presentation write and a restart.
 * Runtime users MUST NOT substitute a process-local mutex or name-only matching. */
export interface PersonaSeedReservations {
  withSeedLease<T>(input: {
    readonly tenantId: TenantId;
    readonly seedKey: string;
    readonly allocate: () => PersonaSeedBinding;
    readonly run: (binding: PersonaSeedBinding) => Promise<T>;
  }): Promise<T>;
}

export type PersonaSeedOutcome =
  | "already-present" | "created-hidden" | "name-collision" | "partial-identity"
  | "identity-mismatch" | "presentation-mismatch";

export interface PersonaSeedResult {
  readonly seedKey: string;
  readonly outcome: PersonaSeedOutcome;
  readonly characterId: CharacterId;
}

/** R03 owns the two support identities. Experts remain hidden and receive NO
 * voice/profile/skills/Seat price until separately qualified by an admin.
 * This writer never mutates any existing presentation, version or user choice. */
export async function ensureUnqualifiedExpertDrafts(input: Readonly<{
  tenantId: TenantId;
  reservations: PersonaSeedReservations;
  identity: PlatformAgentIdentityProvisioner;
  versions: CharacterVersionReader;
  ownership: CharacterOwnershipReader;
  presentations: AgentPresentationRepository;
  now?: () => Instant;
}>): Promise<readonly PersonaSeedResult[]> {
  const outcomes: PersonaSeedResult[] = [];
  for (const seed of CANONICAL_EXPERT_DRAFTS) {
    const result = await input.reservations.withSeedLease({
      tenantId: input.tenantId,
      seedKey: seed.seedKey,
      allocate: () => Object.freeze({
        characterId: createCanonicalId("character"),
        characterVersionId: createCanonicalId("character-version"),
      }),
      run: async (binding) => seedExpert(input, seed, binding),
    });
    outcomes.push(Object.freeze({ seedKey: seed.seedKey, ...result }));
  }
  return Object.freeze(outcomes);
}

async function seedExpert(
  input: Parameters<typeof ensureUnqualifiedExpertDrafts>[0],
  seed: CanonicalPersonaSpec,
  binding: PersonaSeedBinding,
): Promise<{ outcome: PersonaSeedOutcome; characterId: CharacterId }> {
  const base = { characterId: binding.characterId };
  const existing = await input.presentations.readForCharacter({
    tenantId: input.tenantId,
    characterId: binding.characterId,
  });
  if (existing) {
    return {
      ...base,
      outcome: existing.characterVersionId === binding.characterVersionId
        ? "already-present"
        : "presentation-mismatch",
    };
  }

  // Exact-name reuse is unsafe: it may be an admin-managed character. Never
  // seize, rename, hide or overwrite it, even if the seed registry says missing.
  const all = await input.presentations.listAll({ tenantId: input.tenantId });
  if (all.some((entry) =>
    entry.characterId !== binding.characterId &&
    entry.displayName.trim().toLocaleLowerCase("en") === seed.displayName.toLocaleLowerCase("en"))) {
    return { ...base, outcome: "name-collision" };
  }

  const [version, owner] = await Promise.all([
    input.versions.readCharacterVersion({
      tenantId: input.tenantId,
      characterId: binding.characterId,
      characterVersionId: binding.characterVersionId,
    }),
    input.ownership.readForCharacter({
      tenantId: input.tenantId,
      characterId: binding.characterId,
    }),
  ]);

  if ((version === null) !== (owner === null)) {
    return { ...base, outcome: "partial-identity" };
  }
  if (version && owner) {
    if (owner.kind !== "platform" || owner.ownerUserId !== null ||
        version.characterId !== binding.characterId ||
        version.characterVersionId !== binding.characterVersionId ||
        version.state !== "published") {
      return { ...base, outcome: "identity-mismatch" };
    }
  } else {
    const at = input.now?.() ?? nowInstant();
    await input.identity.provision({
      tenantId: input.tenantId,
      characterId: binding.characterId,
      characterVersionId: binding.characterVersionId,
      createdAt: at,
      constitution: {
        schemaVersion: 1,
        displayName: seed.displayName,
        biography: seed.about,
        personality: [seed.style, "Original Masanawa AI Expert; never impersonate a human"],
        boundaries: [
          seed.boundaries,
          "Never claim to be human, certified, available, or to have performed unverified actions.",
          "Never authorize finance, tools, public stage, or disclosure from persona metadata.",
          "Respect Human Host, current speaker language, safety, consent and private context.",
          "Keep humor out of grief, crisis, financial distress, abuse and solemn religious matters.",
        ],
        disclosurePolicy: {},
        languages: ["en", "ha"],
        voiceReferences: [],
        appearanceReferences: [],
        expertise: [...seed.topics],
      },
    });
  }

  // Do not publish an unqualified voice/seat-ready Expert to the consumer list.
  await input.presentations.put({
    expectedRevision: null,
    presentation: {
      schemaVersion: 1,
      tenantId: input.tenantId,
      characterId: binding.characterId,
      characterVersionId: binding.characterVersionId,
      displayName: seed.displayName,
      roleLabel: "Masanawa AI Expert · " + seed.roleLabel,
      about: seed.shortBio,
      greeting: seed.greeting,
      visibleInUserApp: false,
      sortOrder: seed.sortOrder,
      revision: 1,
    },
  });
  return { ...base, outcome: "created-hidden" };
}

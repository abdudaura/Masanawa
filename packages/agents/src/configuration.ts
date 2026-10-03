import {
  parseCanonicalId,
  type CharacterId,
  type CharacterVersionId,
  type SkillVersionId,
  type TenantId,
} from "@masanawa/contracts";

/**
 * Admin-owned user-app presentation for one existing Character.
 *
 * Character identity itself remains in @masanawa/identity. This record does
 * not contain Skill assignment or authority.
 */
export interface AgentPresentation {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly roleLabel: string;
  readonly about: string;
  readonly greeting: string | null;
  readonly visibleInUserApp: boolean;
  readonly sortOrder: number;
  readonly revision: number;
}

/**
 * Independent exact SkillVersion selection for one Character.
 *
 * Skill definitions/certification/readiness remain in @masanawa/skills.
 * This is selection metadata only; runtime admission must revalidate current
 * eligibility, certification and authority before execution.
 */
export interface CharacterSkillAssignment {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly skillVersionIds: readonly SkillVersionId[];
  readonly revision: number;
}

function bounded(
  value: string,
  name: string,
  max: number,
  allowEmpty = false,
): string {
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

export function normalizeAgentPresentation(
  input: AgentPresentation,
): AgentPresentation {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported agent presentation schema");
  }
  if (
    !Number.isSafeInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > 1_000_000
  ) {
    throw new RangeError("sortOrder is invalid");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    characterId: parseCanonicalId("character", input.characterId),
    characterVersionId: parseCanonicalId(
      "character-version",
      input.characterVersionId,
    ),
    roleLabel: bounded(input.roleLabel, "roleLabel", 120),
    about: bounded(input.about, "about", 500, true),
    greeting:
      input.greeting === null
        ? null
        : bounded(input.greeting, "greeting", 1000, true),
    visibleInUserApp: Boolean(input.visibleInUserApp),
    sortOrder: input.sortOrder,
    revision: revision(input.revision),
  });
}

export function normalizeCharacterSkillAssignment(
  input: CharacterSkillAssignment,
): CharacterSkillAssignment {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Character Skill assignment schema");
  }
  if (
    !Array.isArray(input.skillVersionIds) ||
    input.skillVersionIds.length > 64
  ) {
    throw new RangeError("skillVersionIds exceed their bound");
  }

  const skills = input.skillVersionIds.map((id) =>
    parseCanonicalId("skill-version", id),
  );
  if (new Set(skills).size !== skills.length) {
    throw new TypeError("skillVersionIds must be unique");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    characterId: parseCanonicalId("character", input.characterId),
    skillVersionIds: Object.freeze([...skills].sort()),
    revision: revision(input.revision),
  });
}

export interface AgentPresentationRepository {
  readForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<AgentPresentation | null>;

  listAll(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly AgentPresentation[]>;

  listVisible(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly AgentPresentation[]>;

  put(input: {
    readonly presentation: AgentPresentation;
    /** null creates; otherwise compare-and-swap the observed revision. */
    readonly expectedRevision: number | null;
  }): Promise<AgentPresentation>;
}

export interface CharacterSkillAssignmentRepository {
  readForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<CharacterSkillAssignment | null>;

  put(input: {
    readonly assignment: CharacterSkillAssignment;
    /** null creates; otherwise compare-and-swap the observed revision. */
    readonly expectedRevision: number | null;
  }): Promise<CharacterSkillAssignment>;
}

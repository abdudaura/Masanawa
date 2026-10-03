import {
  parseCanonicalId,
  type CharacterId,
  type CharacterVersionId,
  type SkillVersionId,
  type TenantId,
} from "@masanawa/contracts";

/**
 * Admin-owned presentation/runtime assignment for one Character.
 *
 * Character identity itself remains in @masanawa/identity. Skill definitions
 * remain in @masanawa/skills. This record only says how an existing Character
 * is presented in user apps and which exact SkillVersions are selected for
 * runtime admission.
 */
export interface AgentConfiguration {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly roleLabel: string;
  readonly about: string;
  readonly greeting: string | null;
  readonly visibleInUserApp: boolean;
  readonly sortOrder: number;
  readonly skillVersionIds: readonly SkillVersionId[];
  readonly revision: number;
}

function bounded(value: string, name: string, max: number, allowEmpty = false): string {
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeAgentConfiguration(
  input: AgentConfiguration,
): AgentConfiguration {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported agent configuration schema");
  if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1_000_000) {
    throw new RangeError("sortOrder is invalid");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError("revision is invalid");
  }
  if (!Array.isArray(input.skillVersionIds) || input.skillVersionIds.length > 64) {
    throw new RangeError("skillVersionIds exceed their bound");
  }
  const skills = input.skillVersionIds.map((id) => parseCanonicalId("skill-version", id));
  if (new Set(skills).size !== skills.length) {
    throw new TypeError("skillVersionIds must be unique");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    characterId: parseCanonicalId("character", input.characterId),
    characterVersionId: parseCanonicalId("character-version", input.characterVersionId),
    roleLabel: bounded(input.roleLabel, "roleLabel", 120),
    about: bounded(input.about, "about", 500, true),
    greeting: input.greeting === null ? null : bounded(input.greeting, "greeting", 1000, true),
    visibleInUserApp: Boolean(input.visibleInUserApp),
    sortOrder: input.sortOrder,
    skillVersionIds: Object.freeze([...skills].sort()),
    revision: input.revision,
  });
}

export interface AgentConfigurationRepository {
  readForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<AgentConfiguration | null>;

  listVisible(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly AgentConfiguration[]>;

  put(input: {
    readonly configuration: AgentConfiguration;
    /** null creates; otherwise compare-and-swap the observed revision. */
    readonly expectedRevision: number | null;
  }): Promise<AgentConfiguration>;
}

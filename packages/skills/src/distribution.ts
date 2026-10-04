import {
  isCanonicalId,
  type SkillVersionId,
} from "@masanawa/contracts";

export const skillDistributionAudiences = [
  "platform-support",
  "personal-clone",
  "business",
] as const;
export type SkillDistributionAudience =
  (typeof skillDistributionAudiences)[number];

export const skillInstallModes = [
  "automatic",
  "optional",
  "hidden",
] as const;
export type SkillInstallMode = (typeof skillInstallModes)[number];

export interface SkillDistributionProfile {
  readonly schemaVersion: 1;
  readonly skillVersionId: SkillVersionId;
  readonly audiences: readonly SkillDistributionAudience[];
  readonly installMode: SkillInstallMode;
  readonly category: string;
  readonly sortOrder: number;
}

function boundedToken(value: string, name: string): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 80 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeSkillDistributionProfile(
  input: SkillDistributionProfile,
): SkillDistributionProfile {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Skill distribution schema");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("Skill distribution SkillVersionId is invalid");
  }
  if (
    !Array.isArray(input.audiences) ||
    input.audiences.length < 1 ||
    input.audiences.length > skillDistributionAudiences.length
  ) {
    throw new RangeError("Skill distribution audiences are invalid");
  }
  const audiences = input.audiences.map((audience) => {
    if (!(skillDistributionAudiences as readonly string[]).includes(audience)) {
      throw new TypeError("Skill distribution audience is invalid");
    }
    return audience;
  });
  if (new Set(audiences).size !== audiences.length) {
    throw new TypeError("Skill distribution audiences must be unique");
  }
  if (!(skillInstallModes as readonly string[]).includes(input.installMode)) {
    throw new TypeError("Skill install mode is invalid");
  }
  if (
    !Number.isSafeInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > 1_000_000
  ) {
    throw new RangeError("Skill distribution sortOrder is invalid");
  }

  return Object.freeze({
    schemaVersion: 1,
    skillVersionId: input.skillVersionId,
    audiences: Object.freeze([...audiences].sort()),
    installMode: input.installMode,
    category: boundedToken(input.category, "skill distribution category"),
    sortOrder: input.sortOrder,
  });
}

export interface SkillDistributionRepository {
  put(input: SkillDistributionProfile): Promise<SkillDistributionProfile>;
  read(skillVersionId: SkillVersionId): Promise<SkillDistributionProfile | null>;
  listForAudience(
    audience: SkillDistributionAudience,
  ): Promise<readonly SkillDistributionProfile[]>;
}

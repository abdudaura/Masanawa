import {
  parseCanonicalId,
  type CharacterId,
  type TenantId,
} from "@masanawa/contracts";

export type CharacterSurfaceEvidenceRole =
  | "social-presentation"
  | "studio-media"
  | "commerce-originating"
  | "commerce-executor";

export interface CharacterSurfaceEvidence {
  readonly tenantId: TenantId;
  readonly role: CharacterSurfaceEvidenceRole;
  readonly characterId: CharacterId;
  readonly sourceReference: string;
  readonly sourceRevision: number;
}

export interface CharacterSurfaceConsistencyResult {
  readonly tenantId: TenantId;
  readonly presentationCharacterId: CharacterId;
  readonly evidence: readonly CharacterSurfaceEvidence[];
  readonly executorCharacterIds: readonly CharacterId[];
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("sourceRevision must be a positive safe integer");
  }
  return value;
}

function role(value: CharacterSurfaceEvidenceRole): CharacterSurfaceEvidenceRole {
  if (
    value !== "social-presentation" &&
    value !== "studio-media" &&
    value !== "commerce-originating" &&
    value !== "commerce-executor"
  ) {
    throw new TypeError("Character surface evidence role is invalid");
  }
  return value;
}

export function normalizeCharacterSurfaceEvidence(
  input: CharacterSurfaceEvidence,
): CharacterSurfaceEvidence {
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    role: role(input.role),
    characterId: parseCanonicalId("character", input.characterId),
    sourceReference: bounded(input.sourceReference, "sourceReference", 2048),
    sourceRevision: revision(input.sourceRevision),
  });
}

export function assertCharacterSurfaceConsistency(input: {
  readonly tenantId: TenantId;
  readonly presentationCharacterId: CharacterId;
  readonly evidence: readonly CharacterSurfaceEvidence[];
}): CharacterSurfaceConsistencyResult {
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const presentationCharacterId = parseCanonicalId(
    "character",
    input.presentationCharacterId,
  );

  if (!Array.isArray(input.evidence) || input.evidence.length < 1) {
    throw new Error("Character surface consistency requires evidence");
  }
  if (input.evidence.length > 256) {
    throw new RangeError("Character surface evidence exceeds its bound");
  }

  const evidence = input.evidence.map(normalizeCharacterSurfaceEvidence);
  const uniqueKeys = evidence.map(
    (item) =>
      `${item.role}|${item.sourceReference}|${item.sourceRevision}`,
  );
  if (new Set(uniqueKeys).size !== uniqueKeys.length) {
    throw new Error("Duplicate Character surface evidence is not allowed");
  }

  for (const item of evidence) {
    if (item.tenantId !== tenantId) {
      throw new Error("Character surface evidence Tenant does not match");
    }
    if (
      item.role !== "commerce-executor" &&
      item.characterId !== presentationCharacterId
    ) {
      throw new Error(
        "Character surface evidence does not match the presentation Character",
      );
    }
  }

  const requiredRoles: readonly CharacterSurfaceEvidenceRole[] = [
    "social-presentation",
    "studio-media",
    "commerce-originating",
  ];
  for (const required of requiredRoles) {
    if (!evidence.some((item) => item.role === required)) {
      throw new Error(
        `Character surface consistency is missing required evidence: ${required}`,
      );
    }
  }

  const executorCharacterIds = Object.freeze(
    [...new Set(
      evidence
        .filter((item) => item.role === "commerce-executor")
        .map((item) => item.characterId),
    )].sort(),
  );

  return Object.freeze({
    tenantId,
    presentationCharacterId,
    evidence: Object.freeze(evidence),
    executorCharacterIds,
  });
}

export function assertCommerceExecutorCannotSubstituteOrigin(input: {
  readonly consistency: CharacterSurfaceConsistencyResult;
  readonly executorCharacterId: CharacterId;
}): void {
  const executorCharacterId = parseCanonicalId(
    "character",
    input.executorCharacterId,
  );
  if (
    !input.consistency.executorCharacterIds.includes(executorCharacterId)
  ) {
    throw new Error("Commerce executor is not declared in consistency evidence");
  }
  if (
    !input.consistency.evidence.some(
      (item) =>
        item.role === "commerce-originating" &&
        item.characterId === input.consistency.presentationCharacterId,
    )
  ) {
    throw new Error("Commerce originating Character evidence is missing");
  }
}

import type {
  CharacterId,
  CharacterVersionId,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type { PersonalCloneProvision } from "./personal-clone.js";

export const legacyTwinMigrationErrorCodes = [
  "NOT_PERSONAL_CLONE",
  "MISSING_OWNER",
  "TENANT_MISMATCH",
  "CHARACTER_MISMATCH",
  "OWNER_RELATIONSHIP_MISMATCH",
  "VERSION_MISMATCH",
  "INACTIVE_CHARACTER",
  "INACTIVE_RELATIONSHIP",
] as const;

export type LegacyTwinMigrationErrorCode =
  (typeof legacyTwinMigrationErrorCodes)[number];

export class LegacyTwinMigrationError extends Error {
  readonly code: LegacyTwinMigrationErrorCode;

  constructor(code: LegacyTwinMigrationErrorCode) {
    super(code);
    this.name = "LegacyTwinMigrationError";
    this.code = code;
  }
}

export interface LegacyTwinContinuityProjection {
  readonly schemaVersion: 1;
  readonly source: "personal-clone";
  readonly tenantId: TenantId;
  readonly ownerUserId: UserId;
  readonly characterId: CharacterId;
  readonly activeCharacterVersionId: CharacterVersionId;
  readonly ownerRelationshipId: RelationshipId;
  readonly displayName: string;
  readonly sourceCreatedAt: Instant;
}

/**
 * Projects an existing canonical personal clone into the stable identity continuity
 * required by the simplified Twin product.
 *
 * This function intentionally does not create IDs, mutate the legacy records, move
 * money, infer public discoverability, or manufacture a second Twin identity. It only
 * proves that the existing Character/Version/Ownership/Relationship evidence is
 * internally consistent enough for an integration owner to adopt in-place.
 */
export function projectLegacyPersonalCloneToTwin(
  provision: PersonalCloneProvision,
): LegacyTwinContinuityProjection {
  const { character, version, ownership, relationship } = provision;

  if (ownership.kind !== "personal-clone") {
    throw new LegacyTwinMigrationError("NOT_PERSONAL_CLONE");
  }
  if (ownership.ownerUserId === null) {
    throw new LegacyTwinMigrationError("MISSING_OWNER");
  }

  const tenantId = character.tenantId;
  if (
    version.tenantId !== tenantId ||
    ownership.tenantId !== tenantId ||
    relationship.tenantId !== tenantId
  ) {
    throw new LegacyTwinMigrationError("TENANT_MISMATCH");
  }

  if (
    version.characterId !== character.characterId ||
    ownership.characterId !== character.characterId ||
    relationship.characterId !== character.characterId
  ) {
    throw new LegacyTwinMigrationError("CHARACTER_MISMATCH");
  }

  if (relationship.userId !== ownership.ownerUserId) {
    throw new LegacyTwinMigrationError("OWNER_RELATIONSHIP_MISMATCH");
  }

  if (
    character.activeCharacterVersionId === null ||
    version.characterVersionId !== character.activeCharacterVersionId
  ) {
    throw new LegacyTwinMigrationError("VERSION_MISMATCH");
  }

  if (character.state !== "active") {
    throw new LegacyTwinMigrationError("INACTIVE_CHARACTER");
  }

  if (relationship.state !== "active") {
    throw new LegacyTwinMigrationError("INACTIVE_RELATIONSHIP");
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    source: "personal-clone" as const,
    tenantId,
    ownerUserId: ownership.ownerUserId,
    characterId: character.characterId,
    activeCharacterVersionId: version.characterVersionId,
    ownerRelationshipId: relationship.relationshipId,
    displayName: version.constitution.displayName,
    sourceCreatedAt: ownership.createdAt,
  });
}

import { describe, expect, it } from "vitest";
import type {
  CharacterId,
  CharacterVersionId,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type { PersonalCloneProvision } from "./personal-clone.js";
import {
  LegacyTwinMigrationError,
  projectLegacyPersonalCloneToTwin,
} from "./twin-legacy-migration.js";

const tenantId = "tenant-1" as TenantId;
const userId = "user-1" as UserId;
const characterId = "character-1" as CharacterId;
const characterVersionId = "character-version-1" as CharacterVersionId;
const relationshipId = "relationship-1" as RelationshipId;
const createdAt = "2026-10-05T00:00:00.000Z" as Instant;

function fixture(): PersonalCloneProvision {
  return {
    created: false,
    character: {
      tenantId,
      characterId,
      state: "active",
      activeCharacterVersionId: characterVersionId,
      revision: 3,
      createdAt,
      updatedAt: createdAt,
    },
    version: {
      tenantId,
      characterVersionId,
      characterId,
      versionNumber: 2,
      state: "published",
      constitution: {
        schemaVersion: 1,
        displayName: "Amina Twin",
        biography: "Helpful representation",
        personality: ["warm"],
        boundaries: [],
        disclosurePolicy: {},
        languages: ["en"],
        voiceReferences: [],
        appearanceReferences: [],
        expertise: ["learning"],
      },
      createdAt,
      publishedAt: createdAt,
    },
    ownership: {
      tenantId,
      characterId,
      kind: "personal-clone",
      ownerUserId: userId,
      createdAt,
    },
    relationship: {
      tenantId,
      relationshipId,
      userId,
      characterId,
      state: "active",
      stage: null,
      tone: null,
      preferences: {},
      disclosures: {},
      permissions: {},
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

describe("projectLegacyPersonalCloneToTwin", () => {
  it("preserves canonical identity and relationship lineage exactly", () => {
    const source = fixture();

    expect(projectLegacyPersonalCloneToTwin(source)).toEqual({
      schemaVersion: 1,
      source: "personal-clone",
      tenantId,
      ownerUserId: userId,
      characterId,
      activeCharacterVersionId: characterVersionId,
      ownerRelationshipId: relationshipId,
      displayName: "Amina Twin",
      sourceCreatedAt: createdAt,
    });
  });

  it("is deterministic and does not mutate the legacy provision", () => {
    const source = fixture();
    const before = structuredClone(source);

    const first = projectLegacyPersonalCloneToTwin(source);
    const second = projectLegacyPersonalCloneToTwin(source);

    expect(second).toEqual(first);
    expect(source).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it.each([
    ["NOT_PERSONAL_CLONE", (p: PersonalCloneProvision) => ({
      ...p,
      ownership: { ...p.ownership, kind: "platform" as const },
    })],
    ["MISSING_OWNER", (p: PersonalCloneProvision) => ({
      ...p,
      ownership: { ...p.ownership, ownerUserId: null },
    })],
    ["TENANT_MISMATCH", (p: PersonalCloneProvision) => ({
      ...p,
      version: { ...p.version, tenantId: "tenant-2" as TenantId },
    })],
    ["CHARACTER_MISMATCH", (p: PersonalCloneProvision) => ({
      ...p,
      relationship: {
        ...p.relationship,
        characterId: "character-2" as CharacterId,
      },
    })],
    ["OWNER_RELATIONSHIP_MISMATCH", (p: PersonalCloneProvision) => ({
      ...p,
      relationship: { ...p.relationship, userId: "user-2" as UserId },
    })],
    ["VERSION_MISMATCH", (p: PersonalCloneProvision) => ({
      ...p,
      character: {
        ...p.character,
        activeCharacterVersionId:
          "character-version-2" as CharacterVersionId,
      },
    })],
    ["INACTIVE_CHARACTER", (p: PersonalCloneProvision) => ({
      ...p,
      character: { ...p.character, state: "archived" as const },
    })],
    ["INACTIVE_RELATIONSHIP", (p: PersonalCloneProvision) => ({
      ...p,
      relationship: { ...p.relationship, state: "archived" as const },
    })],
  ] as const)(
    "fails closed with %s",
    (code, mutate) => {
      const source = mutate(fixture());
      expect(() => projectLegacyPersonalCloneToTwin(source)).toThrowError(
        LegacyTwinMigrationError,
      );
      try {
        projectLegacyPersonalCloneToTwin(source);
      } catch (error) {
        expect(error).toMatchObject({ code });
      }
    },
  );
});

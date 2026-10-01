import {
  createCanonicalId,
  toInstant,
  type ExternalSubjectRef,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertCharacterVersionCanActivate,
  assertExternalUserSubjectLinkable,
  normalizeCharacterConstitution,
} from "./invariants.js";
import type { Character, CharacterVersion } from "./model.js";

describe("identity invariants", () => {
  it("normalizes Constitution content without deriving Character identity from it", () => {
    const constitution = normalizeCharacterConstitution({
      schemaVersion: 1,
      displayName: "  Amina Bello  ",
      biography: "",
      personality: ["warm", "warm", "curious"],
      boundaries: ["protect scoped private state"],
      disclosurePolicy: { aiNature: "disclose" },
      languages: ["ha", "en"],
      voiceReferences: [],
      appearanceReferences: [],
      expertise: ["education", "education"],
    });

    expect(constitution.displayName).toBe("Amina Bello");
    expect(constitution.personality).toEqual(["warm", "curious"]);
    expect(constitution.expertise).toEqual(["education"]);
  });

  it("refuses transport evidence that has not been explicitly linked", () => {
    const subject: ExternalSubjectRef = {
      system: "whatsapp",
      namespace: "jid",
      value: "subject",
      subjectKind: "user",
      authenticationStrength: "transport-verified",
      observedAt: toInstant(new Date()),
    };
    expect(() => assertExternalUserSubjectLinkable(subject)).toThrowError(
      expect.objectContaining({ code: "identity.external_subject_not_linked" }),
    );
  });

  it("activates only a published version bound to the same Character", () => {
    const now = toInstant(new Date());
    const tenantId = createCanonicalId("tenant");
    const characterId = createCanonicalId("character");
    const constitution = normalizeCharacterConstitution({
      schemaVersion: 1,
      displayName: "Amina",
      biography: "",
      personality: [],
      boundaries: [],
      disclosurePolicy: {},
      languages: ["ha"],
      voiceReferences: [],
      appearanceReferences: [],
      expertise: [],
    });
    const character: Character = {
      tenantId,
      characterId,
      state: "active",
      activeCharacterVersionId: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    const draft: CharacterVersion = {
      tenantId,
      characterVersionId: createCanonicalId("character-version"),
      characterId,
      versionNumber: 1,
      state: "draft",
      constitution,
      createdAt: now,
    };

    expect(() => assertCharacterVersionCanActivate(character, draft)).toThrowError(
      expect.objectContaining({ code: "identity.character_version_not_published" }),
    );
    expect(() =>
      assertCharacterVersionCanActivate(character, {
        ...draft,
        state: "published",
        publishedAt: now,
      }),
    ).not.toThrow();
  });
});

import {
  PlatformError,
  toInstant,
  type ExternalSubjectRef,
} from "@masanawa/contracts";
import type {
  Character,
  CharacterAssetReference,
  CharacterConstitution,
  CharacterVersion,
  JsonObject,
} from "./model.js";

function bounded(value: string, name: string, max: number, empty = false): string {
  const normalized = value.trim();
  if ((!empty && normalized.length === 0) || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function strings(
  values: readonly string[],
  name: string,
  maxEntries: number,
  maxLength: number,
  required = false,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maxEntries) {
    throw new TypeError(`${name} is invalid`);
  }
  const normalized = [...new Set(values.map((value) => bounded(value, name, maxLength)))];
  if (required && normalized.length === 0) {
    throw new TypeError(`${name} requires at least one entry`);
  }
  return Object.freeze(normalized);
}

function asset(
  input: CharacterAssetReference,
  name: string,
): CharacterAssetReference {
  const observedAt = toInstant(input.observedAt);
  const expiresAt =
    input.expiresAt === undefined ? undefined : toInstant(input.expiresAt);
  if (
    expiresAt !== undefined &&
    Date.parse(expiresAt) <= Date.parse(observedAt)
  ) {
    throw new TypeError(`${name}.expiresAt must follow observedAt`);
  }
  return Object.freeze({
    system: bounded(input.system, `${name}.system`, 128),
    namespace: bounded(input.namespace, `${name}.namespace`, 128),
    value: bounded(input.value, `${name}.value`, 2048),
    observedAt,
    ...(expiresAt ? { expiresAt } : {}),
    ...(input.provenance
      ? { provenance: Object.freeze({ ...input.provenance }) }
      : {}),
    ...(input.mediaType
      ? { mediaType: bounded(input.mediaType, `${name}.mediaType`, 128) }
      : {}),
  });
}

function assets(
  values: readonly CharacterAssetReference[],
  name: string,
): readonly CharacterAssetReference[] {
  if (!Array.isArray(values) || values.length > 32) {
    throw new TypeError(`${name} is invalid`);
  }
  return Object.freeze(values.map((value, index) => asset(value, `${name}[${index}]`)));
}

export function normalizeCharacterConstitution(
  input: CharacterConstitution,
): CharacterConstitution {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Constitution schemaVersion");
  }
  if (
    input.disclosurePolicy === null ||
    Array.isArray(input.disclosurePolicy) ||
    typeof input.disclosurePolicy !== "object"
  ) {
    throw new TypeError("disclosurePolicy must be an object");
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    displayName: bounded(input.displayName, "displayName", 200),
    biography: bounded(input.biography, "biography", 20_000, true),
    personality: strings(input.personality, "personality", 128, 1000),
    boundaries: strings(input.boundaries, "boundaries", 128, 2000),
    disclosurePolicy: Object.freeze({ ...input.disclosurePolicy }) as JsonObject,
    languages: strings(input.languages, "languages", 32, 64, true),
    voiceReferences: assets(input.voiceReferences, "voiceReferences"),
    appearanceReferences: assets(input.appearanceReferences, "appearanceReferences"),
    expertise: strings(input.expertise, "expertise", 256, 512),
  });
}

export function assertExternalUserSubjectLinkable(
  subject: ExternalSubjectRef,
): void {
  bounded(subject.system, "subject.system", 128);
  bounded(subject.namespace, "subject.namespace", 128);
  bounded(subject.value, "subject.value", 2048);
  if (subject.subjectKind !== "user") {
    throw new PlatformError({
      code: "identity.external_subject_not_user",
      category: "conflict",
      message: "Only an external user subject can map to a canonical User",
      retryable: false,
    });
  }
  if (
    subject.authenticationStrength !== "linked" &&
    subject.authenticationStrength !== "strong"
  ) {
    throw new PlatformError({
      code: "identity.external_subject_not_linked",
      category: "authentication",
      message: "External identity must be explicitly linked before resolution",
      retryable: false,
    });
  }
}

export function assertCharacterVersionCanActivate(
  character: Character,
  version: CharacterVersion,
): void {
  if (
    character.tenantId !== version.tenantId ||
    character.characterId !== version.characterId
  ) {
    throw new PlatformError({
      code: "identity.character_version_binding_mismatch",
      category: "conflict",
      message: "Character version belongs to another Character",
      retryable: false,
    });
  }
  if (version.state !== "published") {
    throw new PlatformError({
      code: "identity.character_version_not_published",
      category: "conflict",
      message: "Only published Character versions can become active",
      retryable: false,
    });
  }
}

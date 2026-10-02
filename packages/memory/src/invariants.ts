import {
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  memoryEvidenceSourceKinds,
  memoryTypes,
  type JsonObject,
  type MemoryEvidence,
  type MemoryEvidenceSourceKind,
  type MemoryExtractionInfo,
  type MemoryScope,
  type MemoryScopeKind,
  type MemoryType,
} from "./model.js";

export interface MemoryEvidenceInput {
  readonly sourceKind: MemoryEvidenceSourceKind;
  readonly sourceReference: string;
  readonly sourceContentHash: string;
  readonly verbatimText?: string | null;
  readonly observedAt: Instant;
}

export interface MemoryRevisionContentInput {
  readonly content: string;
  readonly payload?: JsonObject;
  readonly confidence?: number;
  readonly extractionMethod: string;
  readonly extractionModelVersion?: string | null;
  readonly eventTime?: Instant | null;
  readonly observedAt: Instant;
  readonly validFrom?: Instant | null;
  readonly validTo?: Instant | null;
  readonly expiresAt?: Instant | null;
  readonly evidence: readonly MemoryEvidenceInput[];
}

export interface NormalizedMemoryRevisionContent {
  readonly content: string;
  readonly payload: JsonObject;
  readonly confidence: number;
  readonly extraction: MemoryExtractionInfo;
  readonly eventTime: Instant | null;
  readonly observedAt: Instant;
  readonly validFrom: Instant | null;
  readonly validTo: Instant | null;
  readonly expiresAt: Instant | null;
  readonly evidence: readonly MemoryEvidence[];
}

export interface MemoryScopeStorage {
  readonly kind: MemoryScopeKind;
  readonly referenceId: string | null;
}

const evidenceSourceKindSet = new Set<string>(memoryEvidenceSourceKinds);
const memoryTypeSet = new Set<string>(memoryTypes);
const sha256Pattern = /^[0-9a-f]{64}$/u;

function boundedText(
  value: string,
  name: string,
  maxLength: number,
  options: { readonly preserveWhitespace?: boolean } = {},
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const checked = options.preserveWhitespace ? value : value.trim();
  if (checked.length === 0 || checked.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return checked;
}

function optionalInstant(value: Instant | null | undefined): Instant | null {
  return value === null || value === undefined ? null : toInstant(value);
}

function assertAfter(
  later: Instant | null,
  earlier: Instant | null,
  message: string,
): void {
  if (
    later !== null &&
    earlier !== null &&
    Date.parse(later) <= Date.parse(earlier)
  ) {
    throw new TypeError(message);
  }
}

export function normalizeMemoryType(value: MemoryType): MemoryType {
  if (!memoryTypeSet.has(value)) {
    throw new TypeError("Unsupported memory type");
  }
  return value;
}

export function normalizeMemoryScope(scope: MemoryScope): MemoryScope {
  switch (scope.kind) {
    case "organization":
      return Object.freeze({ kind: "organization" });
    case "relationship":
      return Object.freeze({
        kind: "relationship",
        relationshipId: parseCanonicalId(
          "relationship",
          scope.relationshipId,
        ),
      });
    case "character-private":
      return Object.freeze({
        kind: "character-private",
        characterId: parseCanonicalId("character", scope.characterId),
      });
    case "character-shared":
      return Object.freeze({
        kind: "character-shared",
        characterId: parseCanonicalId("character", scope.characterId),
      });
    case "world":
      return Object.freeze({
        kind: "world",
        worldId: parseCanonicalId("world", scope.worldId),
      });
    case "session":
      return Object.freeze({
        kind: "session",
        characterSessionId: parseCanonicalId(
          "character-session",
          scope.characterSessionId,
        ),
      });
    case "task":
      return Object.freeze({
        kind: "task",
        taskId: parseCanonicalId("task", scope.taskId),
      });
  }
}

export function memoryScopeFromStorage(
  kind: MemoryScopeKind,
  referenceId: string | null,
): MemoryScope {
  switch (kind) {
    case "organization":
      if (referenceId !== null) {
        throw new TypeError("Organization memory scope cannot have a reference");
      }
      return Object.freeze({ kind });
    case "relationship":
      if (referenceId === null) throw new TypeError("Relationship scope reference missing");
      return Object.freeze({
        kind,
        relationshipId: parseCanonicalId("relationship", referenceId),
      });
    case "character-private":
    case "character-shared":
      if (referenceId === null) throw new TypeError("Character scope reference missing");
      return Object.freeze({
        kind,
        characterId: parseCanonicalId("character", referenceId),
      });
    case "world":
      if (referenceId === null) throw new TypeError("World scope reference missing");
      return Object.freeze({
        kind,
        worldId: parseCanonicalId("world", referenceId),
      });
    case "session":
      if (referenceId === null) throw new TypeError("Session scope reference missing");
      return Object.freeze({
        kind,
        characterSessionId: parseCanonicalId("character-session", referenceId),
      });
    case "task":
      if (referenceId === null) throw new TypeError("Task scope reference missing");
      return Object.freeze({
        kind,
        taskId: parseCanonicalId("task", referenceId),
      });
  }
}

export function memoryScopeStorage(scope: MemoryScope): MemoryScopeStorage {
  const normalized = normalizeMemoryScope(scope);
  switch (normalized.kind) {
    case "organization":
      return Object.freeze({ kind: normalized.kind, referenceId: null });
    case "relationship":
      return Object.freeze({
        kind: normalized.kind,
        referenceId: normalized.relationshipId,
      });
    case "character-private":
    case "character-shared":
      return Object.freeze({
        kind: normalized.kind,
        referenceId: normalized.characterId,
      });
    case "world":
      return Object.freeze({
        kind: normalized.kind,
        referenceId: normalized.worldId,
      });
    case "session":
      return Object.freeze({
        kind: normalized.kind,
        referenceId: normalized.characterSessionId,
      });
    case "task":
      return Object.freeze({
        kind: normalized.kind,
        referenceId: normalized.taskId,
      });
  }
}

export function memoryScopeKey(scope: MemoryScope): string {
  const storage = memoryScopeStorage(scope);
  return storage.referenceId === null
    ? storage.kind
    : `${storage.kind}:${storage.referenceId}`;
}

function normalizeEvidence(
  evidence: readonly MemoryEvidenceInput[],
): readonly MemoryEvidence[] {
  if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 128) {
    throw new TypeError("evidence must contain between 1 and 128 entries");
  }

  return Object.freeze(
    evidence.map((item, index) => {
      if (!evidenceSourceKindSet.has(item.sourceKind)) {
        throw new TypeError(`evidence[${index}].sourceKind is invalid`);
      }
      const sourceContentHash = boundedText(
        item.sourceContentHash,
        `evidence[${index}].sourceContentHash`,
        64,
      ).toLowerCase();
      if (!sha256Pattern.test(sourceContentHash)) {
        throw new TypeError(
          `evidence[${index}].sourceContentHash must be SHA-256 hex`,
        );
      }

      const verbatimText =
        item.verbatimText === undefined || item.verbatimText === null
          ? null
          : boundedText(
              item.verbatimText,
              `evidence[${index}].verbatimText`,
              100_000,
              { preserveWhitespace: true },
            );

      return Object.freeze({
        ordinal: index + 1,
        sourceKind: item.sourceKind,
        sourceReference: boundedText(
          item.sourceReference,
          `evidence[${index}].sourceReference`,
          2048,
        ),
        sourceContentHash,
        verbatimText,
        observedAt: toInstant(item.observedAt),
      });
    }),
  );
}

export function normalizeMemoryRevisionContent(
  input: MemoryRevisionContentInput,
): NormalizedMemoryRevisionContent {
  if (
    input.payload !== undefined &&
    (input.payload === null ||
      Array.isArray(input.payload) ||
      typeof input.payload !== "object")
  ) {
    throw new TypeError("payload must be a JSON object");
  }

  const confidence = input.confidence ?? 1;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new TypeError("confidence must be between 0 and 1");
  }

  const observedAt = toInstant(input.observedAt);
  const eventTime = optionalInstant(input.eventTime);
  const validFrom = optionalInstant(input.validFrom);
  const validTo = optionalInstant(input.validTo);
  const expiresAt = optionalInstant(input.expiresAt);

  assertAfter(validTo, validFrom, "validTo must follow validFrom");
  assertAfter(expiresAt, observedAt, "expiresAt must follow observedAt");

  return Object.freeze({
    content: boundedText(input.content, "content", 100_000),
    payload: Object.freeze({ ...(input.payload ?? {}) }) as JsonObject,
    confidence,
    extraction: Object.freeze({
      method: boundedText(input.extractionMethod, "extractionMethod", 128),
      modelVersion:
        input.extractionModelVersion === undefined ||
        input.extractionModelVersion === null
          ? null
          : boundedText(
              input.extractionModelVersion,
              "extractionModelVersion",
              256,
            ),
    }),
    eventTime,
    observedAt,
    validFrom,
    validTo,
    expiresAt,
    evidence: normalizeEvidence(input.evidence),
  });
}

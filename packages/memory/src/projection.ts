import {
  PlatformError,
  toInstant,
  type Instant,
  type MemoryProjectionGenerationId,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import {
  fingerprintCanonicalJson,
} from "@masanawa/security";
import {
  memoryScopeKey,
  normalizeMemoryScope,
} from "./invariants.js";
import type {
  MemoryRecordSnapshot,
  MemoryScope,
  MemoryType,
} from "./model.js";

export const memoryProjectionKinds = [
  "lexical",
  "vector",
  "entity",
  "temporal",
] as const;
export type MemoryProjectionKind =
  (typeof memoryProjectionKinds)[number];

export const memoryProjectionGenerationStates = [
  "building",
  "current",
  "retired",
] as const;
export type MemoryProjectionGenerationState =
  (typeof memoryProjectionGenerationStates)[number];

export interface MemoryVectorCompatibility {
  readonly providerKey: string;
  readonly modelKey: string;
  readonly dimension: number;
}

export interface MemoryProjectionGeneration {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly kind: MemoryProjectionKind;
  readonly implementationKey: string;
  readonly schemaVersion: number;
  readonly vectorCompatibility: MemoryVectorCompatibility | null;
  readonly state: MemoryProjectionGenerationState;
  readonly createdAt: Instant;
  readonly activatedAt: Instant | null;
  readonly retiredAt: Instant | null;
}

export interface CreateMemoryProjectionGenerationInput {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly kind: MemoryProjectionKind;
  readonly implementationKey: string;
  readonly schemaVersion: number;
  readonly vectorCompatibility?: MemoryVectorCompatibility | null;
  readonly createdAt: Instant;
}

export interface MemoryScopePredicate {
  readonly scopes: readonly MemoryScope[];
  readonly keys: readonly string[];
}

export interface MemoryRetrievalAdapterCapabilities {
  readonly exactScopeFiltering: boolean;
  readonly lexical: boolean;
  readonly vector: boolean;
  readonly entity: boolean;
  readonly temporal: boolean;
}

export interface MemoryLexicalSearchInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly query: string;
  readonly limit: number;
}

export interface MemoryLexicalHit {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly lexicalRank: number;
  readonly sourceContentHash: string;
}

const projectionKindSet = new Set<string>(memoryProjectionKinds);

function bounded(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeMemoryProjectionGenerationInput(
  input: CreateMemoryProjectionGenerationInput,
): CreateMemoryProjectionGenerationInput {
  if (!projectionKindSet.has(input.kind)) {
    throw new TypeError("projection kind is invalid");
  }
  if (!Number.isSafeInteger(input.schemaVersion) || input.schemaVersion < 1) {
    throw new RangeError("schemaVersion must be a positive safe integer");
  }

  const vectorCompatibility = input.vectorCompatibility ?? null;
  if (input.kind === "vector") {
    if (vectorCompatibility === null) {
      throw new TypeError("vector projection requires compatibility metadata");
    }
    if (
      !Number.isSafeInteger(vectorCompatibility.dimension) ||
      vectorCompatibility.dimension < 1 ||
      vectorCompatibility.dimension > 1_000_000
    ) {
      throw new RangeError("vector dimension is invalid");
    }
  } else if (vectorCompatibility !== null) {
    throw new TypeError(
      "non-vector projection cannot declare vector compatibility metadata",
    );
  }

  return Object.freeze({
    ...input,
    implementationKey: bounded(
      input.implementationKey,
      "implementationKey",
      200,
    ),
    vectorCompatibility:
      vectorCompatibility === null
        ? null
        : Object.freeze({
            providerKey: bounded(
              vectorCompatibility.providerKey,
              "vectorCompatibility.providerKey",
              200,
            ),
            modelKey: bounded(
              vectorCompatibility.modelKey,
              "vectorCompatibility.modelKey",
              300,
            ),
            dimension: vectorCompatibility.dimension,
          }),
    createdAt: toInstant(input.createdAt),
  });
}

export function createMemoryScopePredicate(
  scopes: readonly MemoryScope[],
): MemoryScopePredicate {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > 64) {
    throw new RangeError(
      "retrieval requires between 1 and 64 authorized memory scopes",
    );
  }
  const normalized = [
    ...new Map(
      scopes.map((scope) => {
        const value = normalizeMemoryScope(scope);
        return [memoryScopeKey(value), value] as const;
      }),
    ).values(),
  ];
  const keys = normalized.map(memoryScopeKey).sort();
  return Object.freeze({
    scopes: Object.freeze(normalized),
    keys: Object.freeze(keys),
  });
}

export function normalizeMemoryLexicalSearchInput(
  input: MemoryLexicalSearchInput,
): MemoryLexicalSearchInput {
  const query = bounded(input.query, "query", 2000);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }
  const scopePredicate = createMemoryScopePredicate(
    input.scopePredicate.scopes,
  );
  return Object.freeze({
    tenantId: input.tenantId,
    scopePredicate,
    query,
    limit: input.limit,
  });
}

export function assertMemoryRetrievalAdapterCapabilities(
  capabilities: MemoryRetrievalAdapterCapabilities,
  signal: Exclude<MemoryProjectionKind, "vector"> | "vector",
): void {
  if (!capabilities.exactScopeFiltering) {
    throw new PlatformError({
      code: "memory.retrieval_scope_filter_unsupported",
      category: "authorization",
      message:
        "Memory retrieval adapter cannot enforce the exact authorized scope predicate",
      retryable: false,
    });
  }
  if (!capabilities[signal]) {
    throw new PlatformError({
      code: "memory.retrieval_signal_unsupported",
      category: "conflict",
      message: `Memory retrieval adapter does not support ${signal} retrieval`,
      retryable: false,
    });
  }
}

export function memoryProjectionSourceContentHash(
  snapshot: MemoryRecordSnapshot,
): string {
  return fingerprintCanonicalJson({
    tenantId: snapshot.record.tenantId,
    memoryRecordId: snapshot.record.memoryRecordId,
    memoryRevisionId: snapshot.currentRevision.memoryRevisionId,
    revisionNumber: snapshot.currentRevision.revisionNumber,
    memoryType: snapshot.record.memoryType,
    scope: memoryScopeKey(snapshot.record.scope),
    content: snapshot.currentRevision.content,
    payload: snapshot.currentRevision.payload,
    confidence: snapshot.currentRevision.confidence,
    extraction: snapshot.currentRevision.extraction,
    eventTime: snapshot.currentRevision.eventTime,
    observedAt: snapshot.currentRevision.observedAt,
    validFrom: snapshot.currentRevision.validFrom,
    validTo: snapshot.currentRevision.validTo,
    expiresAt: snapshot.currentRevision.expiresAt,
  });
}

import {
  PlatformError,
  toInstant,
  type Instant,
  type MemoryProjectionGenerationId,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import type {
  MemoryScope,
  MemoryType,
} from "./model.js";
import {
  createMemoryScopePredicate,
  type MemoryScopePredicate,
  type MemoryVectorCompatibility,
} from "./projection.js";

export interface MemoryVectorSearchInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly compatibility: MemoryVectorCompatibility;
  readonly queryVector: readonly number[];
  readonly limit: number;
}

export interface MemoryVectorHit {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly similarity: number;
  readonly sourceContentHash: string;
}

export interface MemoryEntitySearchInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly entityKeys: readonly string[];
  readonly limit: number;
}

export interface MemoryEntityHit {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly matchedEntityKeys: readonly string[];
  readonly entityScore: number;
  readonly sourceContentHash: string;
}

export interface MemoryTemporalSearchInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly fromInclusive: Instant;
  readonly toExclusive: Instant;
  readonly asOf?: Instant | null;
  readonly limit: number;
}

export interface MemoryTemporalHit {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly temporalAnchor: Instant;
  readonly eventTime: Instant | null;
  readonly observedAt: Instant;
  readonly validFrom: Instant | null;
  readonly validTo: Instant | null;
  readonly expiresAt: Instant | null;
  readonly sourceContentHash: string;
}

function positiveLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }
  return value;
}

function boundedKey(value: string, name: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeMemoryEntityKey(value: string): string {
  const normalized = boundedKey(value.normalize("NFKC"), "entityKey", 300)
    .replace(/\s+/gu, " ")
    .toLowerCase();
  if (normalized.length > 300) {
    throw new TypeError("entityKey is invalid");
  }
  return normalized;
}

export function normalizeMemoryEntityProjectionKeys(
  values: readonly string[],
): readonly string[] {
  if (!Array.isArray(values) || values.length > 256) {
    throw new RangeError("entity projection accepts at most 256 entity keys");
  }
  const normalized = [...new Set(values.map(normalizeMemoryEntityKey))].sort();
  return Object.freeze(normalized);
}

export function normalizeMemoryEntityKeys(
  values: readonly string[],
): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 64) {
    throw new RangeError("entity retrieval requires between 1 and 64 entity keys");
  }
  return Object.freeze([...normalizeMemoryEntityProjectionKeys(values)]);
}

export function normalizeMemoryVectorSearchInput(
  input: MemoryVectorSearchInput,
): MemoryVectorSearchInput {
  const providerKey = boundedKey(
    input.compatibility.providerKey,
    "compatibility.providerKey",
    200,
  );
  const modelKey = boundedKey(
    input.compatibility.modelKey,
    "compatibility.modelKey",
    300,
  );
  const dimension = input.compatibility.dimension;
  if (!Number.isSafeInteger(dimension) || dimension < 1 || dimension > 1_000_000) {
    throw new RangeError("compatibility.dimension is invalid");
  }
  if (!Array.isArray(input.queryVector) || input.queryVector.length !== dimension) {
    throw new RangeError(
      "queryVector length must exactly match compatibility.dimension",
    );
  }
  let squaredNorm = 0;
  const queryVector = input.queryVector.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("queryVector values must be finite numbers");
    }
    squaredNorm += value * value;
    return value;
  });
  if (!Number.isFinite(squaredNorm) || squaredNorm <= 0) {
    throw new RangeError("queryVector must have a finite non-zero norm");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    scopePredicate: createMemoryScopePredicate(input.scopePredicate.scopes),
    compatibility: Object.freeze({
      providerKey,
      modelKey,
      dimension,
    }),
    queryVector: Object.freeze(queryVector),
    limit: positiveLimit(input.limit),
  });
}

export function normalizeMemoryEntitySearchInput(
  input: MemoryEntitySearchInput,
): MemoryEntitySearchInput {
  return Object.freeze({
    tenantId: input.tenantId,
    scopePredicate: createMemoryScopePredicate(input.scopePredicate.scopes),
    entityKeys: normalizeMemoryEntityKeys(input.entityKeys),
    limit: positiveLimit(input.limit),
  });
}

export function normalizeMemoryTemporalSearchInput(
  input: MemoryTemporalSearchInput,
): MemoryTemporalSearchInput {
  const fromInclusive = toInstant(input.fromInclusive);
  const toExclusive = toInstant(input.toExclusive);
  if (Date.parse(fromInclusive) >= Date.parse(toExclusive)) {
    throw new RangeError("fromInclusive must be before toExclusive");
  }
  const asOf = input.asOf === null || input.asOf === undefined
    ? null
    : toInstant(input.asOf);

  return Object.freeze({
    tenantId: input.tenantId,
    scopePredicate: createMemoryScopePredicate(input.scopePredicate.scopes),
    fromInclusive,
    toExclusive,
    asOf,
    limit: positiveLimit(input.limit),
  });
}

export function assertMemoryVectorCompatibility(
  actual: MemoryVectorCompatibility,
  requested: MemoryVectorCompatibility,
): void {
  if (
    actual.providerKey !== requested.providerKey ||
    actual.modelKey !== requested.modelKey ||
    actual.dimension !== requested.dimension
  ) {
    throw new PlatformError({
      code: "memory.vector_query_incompatible",
      category: "conflict",
      message:
        "Vector query provider/model/dimension does not match the current projection generation",
      retryable: false,
    });
  }
}

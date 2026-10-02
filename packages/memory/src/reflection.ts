import type {
  Instant,
  MemoryRecordId,
  MemoryRevisionId,
  TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  memoryProjectionSourceContentHash,
} from "./projection.js";
import {
  memoryScopeKey,
  normalizeMemoryScope,
  type MemoryRevisionContentInput,
} from "./invariants.js";
import type {
  MemoryRecordSnapshot,
  MemoryScope,
} from "./model.js";

export interface MemoryReflectorIdentity {
  readonly key: string;
  readonly version: string;
}

export interface MemoryReflectionSource {
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly sourceContentHash: string;
}

export type MemoryReflectionRevisionInput =
  Omit<MemoryRevisionContentInput, "evidence">;

export interface CommitMemoryReflectionInput {
  readonly tenantId: TenantId;
  readonly reflectionMemoryRecordId: MemoryRecordId;
  readonly reflectionMemoryRevisionId: MemoryRevisionId;
  readonly scope: MemoryScope;
  readonly purposeKey: string;
  readonly reflector: MemoryReflectorIdentity;
  readonly sources: readonly MemoryReflectionSource[];
  readonly revision: MemoryReflectionRevisionInput;
  readonly createdAt: Instant;
}

export interface NormalizedMemoryReflectionIdentity {
  readonly tenantId: TenantId;
  readonly scope: MemoryScope;
  readonly purposeKey: string;
  readonly reflector: MemoryReflectorIdentity;
  readonly sources: readonly MemoryReflectionSource[];
}

export interface MemoryReflection {
  readonly tenantId: TenantId;
  readonly reflectionFingerprint: string;
  readonly reflectionMemoryRecordId: MemoryRecordId;
  readonly reflectionMemoryRevisionId: MemoryRevisionId;
  readonly scope: MemoryScope;
  readonly purposeKey: string;
  readonly reflector: MemoryReflectorIdentity;
  readonly sources: readonly MemoryReflectionSource[];
  readonly createdAt: Instant;
}

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


export function memoryReflectionSourceFromSnapshot(
  snapshot: MemoryRecordSnapshot,
): MemoryReflectionSource {
  if (snapshot.record.lifecycleState !== "active") {
    throw new TypeError("reflection source must be active");
  }
  if (
    snapshot.record.currentRevisionId !==
      snapshot.currentRevision.memoryRevisionId ||
    snapshot.record.revision !== snapshot.currentRevision.revisionNumber
  ) {
    throw new TypeError(
      "reflection source snapshot must be its canonical current revision",
    );
  }
  return Object.freeze({
    memoryRecordId: snapshot.record.memoryRecordId,
    memoryRevisionId: snapshot.currentRevision.memoryRevisionId,
    sourceContentHash: memoryProjectionSourceContentHash(snapshot),
  });
}

export function normalizeMemoryReflectionIdentity(
  input: Pick<
    CommitMemoryReflectionInput,
    "tenantId" | "scope" | "purposeKey" | "reflector" | "sources"
  >,
): NormalizedMemoryReflectionIdentity {
  if (
    !Array.isArray(input.sources) ||
    input.sources.length < 1 ||
    input.sources.length > 64
  ) {
    throw new RangeError("reflection requires between 1 and 64 source memories");
  }

  const scope = normalizeMemoryScope(input.scope);
  const seenRecords = new Set<MemoryRecordId>();
  const sha256Pattern = /^[0-9a-f]{64}$/u;
  const sources = input.sources.map((source) => {
    if (seenRecords.has(source.memoryRecordId)) {
      throw new TypeError(
        "reflection source MemoryRecord IDs must be unique",
      );
    }
    seenRecords.add(source.memoryRecordId);
    const sourceContentHash = bounded(
      source.sourceContentHash,
      "source.sourceContentHash",
      64,
    ).toLowerCase();
    if (!sha256Pattern.test(sourceContentHash)) {
      throw new TypeError(
        "reflection source content hash must be SHA-256 hex",
      );
    }
    return Object.freeze({
      memoryRecordId: source.memoryRecordId,
      memoryRevisionId: source.memoryRevisionId,
      sourceContentHash,
    });
  });

  const sorted = [...sources].sort(
    (left, right) =>
      left.memoryRecordId.localeCompare(right.memoryRecordId) ||
      left.memoryRevisionId.localeCompare(right.memoryRevisionId),
  );

  return Object.freeze({
    tenantId: input.tenantId,
    scope,
    purposeKey: bounded(input.purposeKey, "purposeKey", 200),
    reflector: Object.freeze({
      key: bounded(input.reflector.key, "reflector.key", 128),
      version: bounded(input.reflector.version, "reflector.version", 128),
    }),
    sources: Object.freeze(sorted),
  });
}

export function memoryReflectionFingerprint(
  input: Pick<
    CommitMemoryReflectionInput,
    "tenantId" | "scope" | "purposeKey" | "reflector" | "sources"
  >,
): string {
  const normalized = normalizeMemoryReflectionIdentity(input);
  return fingerprintCanonicalJson({
    tenantId: normalized.tenantId,
    scope: memoryScopeKey(normalized.scope),
    purposeKey: normalized.purposeKey,
    reflector: normalized.reflector,
    sources: normalized.sources,
  });
}

export function assertMemoryReflectionTargetIsDistinct(
  input: CommitMemoryReflectionInput,
): void {
  if (
    input.sources.some(
      (source) =>
        source.memoryRecordId === input.reflectionMemoryRecordId,
    )
  ) {
    throw new TypeError(
      "reflection target MemoryRecord cannot also be a source",
    );
  }
}

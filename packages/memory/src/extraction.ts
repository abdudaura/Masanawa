import {
  PlatformError,
  toInstant,
  type Instant,
  type MemoryExtractionId,
  type TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  memoryScopeKey,
  normalizeMemoryScope,
} from "./invariants.js";
import {
  memoryEvidenceSourceKinds,
  type MemoryEvidenceSourceKind,
  type MemoryScope,
} from "./model.js";

export const memoryExtractionStates = [
  "queued",
  "processing",
  "retry-scheduled",
  "completed",
  "no-facts",
  "dead-letter",
] as const;

export type MemoryExtractionState = (typeof memoryExtractionStates)[number];

export const memoryExtractionAttemptOutcomes = [
  "completed",
  "no-facts",
  "retry-scheduled",
  "dead-letter",
  "lease-expired",
] as const;

export type MemoryExtractionAttemptOutcome =
  (typeof memoryExtractionAttemptOutcomes)[number];

export interface MemoryExtractionSource {
  readonly kind: MemoryEvidenceSourceKind;
  readonly reference: string;
  readonly contentHash: string;
}

export interface MemoryExtractorIdentity {
  readonly key: string;
  readonly version: string;
}

export interface EnqueueMemoryExtractionInput {
  readonly tenantId: TenantId;
  readonly idempotencyKey: string;
  readonly scope: MemoryScope;
  readonly source: MemoryExtractionSource;
  readonly extractor: MemoryExtractorIdentity;
  readonly maxAttempts: number;
  readonly availableAt: Instant;
}

export interface NormalizedMemoryExtractionRequest {
  readonly tenantId: TenantId;
  readonly idempotencyKey: string;
  readonly scope: MemoryScope;
  readonly source: MemoryExtractionSource;
  readonly extractor: MemoryExtractorIdentity;
  readonly maxAttempts: number;
  readonly availableAt: Instant;
}

export interface MemoryExtractionJob {
  readonly tenantId: TenantId;
  readonly memoryExtractionId: MemoryExtractionId;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly scope: MemoryScope;
  readonly source: MemoryExtractionSource;
  readonly extractor: MemoryExtractorIdentity;
  readonly state: MemoryExtractionState;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly fence: number;
  readonly availableAt: Instant;
  readonly safeErrorCode: string | null;
  readonly terminalAt: Instant | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface MemoryExtractionAdmission {
  readonly job: MemoryExtractionJob;
  readonly reused: boolean;
}

export interface ClaimedMemoryExtraction extends MemoryExtractionJob {
  readonly state: "processing";
  readonly workerId: string;
  readonly leaseExpiresAt: Instant;
}

export interface MemoryExtractionAttempt {
  readonly tenantId: TenantId;
  readonly memoryExtractionId: MemoryExtractionId;
  readonly attempt: number;
  readonly fence: number;
  readonly workerId: string;
  readonly claimedAt: Instant;
  readonly leaseExpiresAt: Instant;
  readonly outcome: MemoryExtractionAttemptOutcome | null;
  readonly safeErrorCode: string | null;
  readonly settledAt: Instant | null;
}

export type MemoryExtractionSettlement =
  | {
      readonly outcome: "completed" | "no-facts";
    }
  | {
      readonly outcome: "retryable-failure";
      readonly safeErrorCode: string;
      readonly retryAt: Instant;
    }
  | {
      readonly outcome: "permanent-failure";
      readonly safeErrorCode: string;
    };

const sourceKindSet = new Set<string>(memoryEvidenceSourceKinds);
const sha256Pattern = /^[0-9a-f]{64}$/u;

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

export function normalizeMemoryExtractionRequest(
  input: EnqueueMemoryExtractionInput,
): NormalizedMemoryExtractionRequest {
  if (!sourceKindSet.has(input.source.kind)) {
    throw new TypeError("source.kind is invalid");
  }

  const contentHash = bounded(
    input.source.contentHash,
    "source.contentHash",
    64,
  ).toLowerCase();
  if (!sha256Pattern.test(contentHash)) {
    throw new TypeError("source.contentHash must be SHA-256 hex");
  }

  if (
    !Number.isSafeInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 20
  ) {
    throw new RangeError("maxAttempts must be an integer between 1 and 20");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 256),
    scope: normalizeMemoryScope(input.scope),
    source: Object.freeze({
      kind: input.source.kind,
      reference: bounded(input.source.reference, "source.reference", 2048),
      contentHash,
    }),
    extractor: Object.freeze({
      key: bounded(input.extractor.key, "extractor.key", 128),
      version: bounded(input.extractor.version, "extractor.version", 128),
    }),
    maxAttempts: input.maxAttempts,
    availableAt: toInstant(input.availableAt),
  });
}

export function memoryExtractionRequestFingerprint(
  input: EnqueueMemoryExtractionInput | NormalizedMemoryExtractionRequest,
): string {
  const normalized = normalizeMemoryExtractionRequest(input);
  return fingerprintCanonicalJson({
    tenantId: normalized.tenantId,
    idempotencyKey: normalized.idempotencyKey,
    scope: memoryScopeKey(normalized.scope),
    source: normalized.source,
    extractor: normalized.extractor,
    maxAttempts: normalized.maxAttempts,
    availableAt: normalized.availableAt,
  });
}

export function normalizeMemoryExtractionSafeErrorCode(
  value: string,
): string {
  return bounded(value, "safeErrorCode", 200);
}

export function assertMemoryExtractionClaimShape(input: {
  readonly workerId: string;
  readonly limit: number;
  readonly leaseMs: number;
}): void {
  bounded(input.workerId, "workerId", 200);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 500) {
    throw new RangeError("limit must be an integer between 1 and 500");
  }
  if (
    !Number.isSafeInteger(input.leaseMs) ||
    input.leaseMs < 1 ||
    input.leaseMs > 86_400_000
  ) {
    throw new RangeError("leaseMs must be between 1 and 86400000");
  }
}

export function staleMemoryExtractionClaim(): PlatformError {
  return new PlatformError({
    code: "memory.extraction_stale_claim",
    category: "conflict",
    message: "Memory extraction claim is no longer current",
    retryable: false,
  });
}

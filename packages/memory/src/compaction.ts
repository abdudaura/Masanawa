import type {
  Instant,
  TenantId,
} from "@masanawa/contracts";
import type {
  MemoryExtractionAdmission,
  MemoryExtractionSource,
  MemoryExtractorIdentity,
} from "./extraction.js";
import type { MemoryScope } from "./model.js";

export interface AdmitMemoryCompactionFlushInput {
  readonly tenantId: TenantId;
  readonly flushKey: string;
  readonly scope: MemoryScope;
  readonly source: MemoryExtractionSource;
  readonly extractor: MemoryExtractorIdentity;
  readonly maxAttempts: number;
  readonly availableAt: Instant;
}

export interface MemoryCompactionFlushAdmission {
  readonly extraction: MemoryExtractionAdmission;
  readonly safeToCompact: true;
}

export function memoryCompactionFlushIdempotencyKey(
  flushKey: string,
): string {
  if (typeof flushKey !== "string") {
    throw new TypeError("flushKey must be a string");
  }
  const normalized = flushKey.trim();
  if (normalized.length < 1 || normalized.length > 220) {
    throw new TypeError("flushKey is invalid");
  }
  return `compaction-flush:${normalized}`;
}

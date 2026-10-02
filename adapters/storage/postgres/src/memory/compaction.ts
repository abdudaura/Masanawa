import {
  memoryCompactionFlushIdempotencyKey,
  type AdmitMemoryCompactionFlushInput,
  type MemoryCompactionFlushAdmission,
} from "@masanawa/memory";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import { enqueueMemoryExtraction } from "./extraction.js";

export async function admitMemoryCompactionFlush(
  pool: Pool,
  input: AdmitMemoryCompactionFlushInput,
): Promise<MemoryCompactionFlushAdmission> {
  const idempotencyKey = memoryCompactionFlushIdempotencyKey(
    input.flushKey,
  );

  const extraction = await withTransaction(pool, (client) =>
    enqueueMemoryExtraction(client, {
      tenantId: input.tenantId,
      idempotencyKey,
      scope: input.scope,
      source: input.source,
      extractor: input.extractor,
      maxAttempts: input.maxAttempts,
      availableAt: input.availableAt,
    }),
  );

  // Reaching this return means the transaction that durably admitted/reused
  // extraction custody has committed. Callers may discard compacted context only
  // after receiving this result.
  return Object.freeze({
    extraction,
    safeToCompact: true as const,
  });
}

import type { Pool } from "pg";
import {
  fuseMemorySignalHits,
  type MemoryFusedHit,
  type MemoryHybridSearchInput,
  type MemorySignalResult,
} from "@masanawa/memory";
import { withTransaction } from "../transaction.js";
import { searchMemoryLexical } from "./projection.js";
import {
  searchMemoryEntity,
  searchMemoryTemporal,
  searchMemoryVector,
} from "./signals.js";

function boundedCandidateLimit(input: MemoryHybridSearchInput): number {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }
  const candidateLimit =
    input.candidateLimit ?? Math.min(100, Math.max(input.limit * 4, 20));
  if (
    !Number.isSafeInteger(candidateLimit) ||
    candidateLimit < input.limit ||
    candidateLimit > 100
  ) {
    throw new RangeError(
      "candidateLimit must be an integer between limit and 100",
    );
  }
  return candidateLimit;
}

function requestedSignalCount(input: MemoryHybridSearchInput): number {
  return (
    Number(input.lexicalQuery !== undefined) +
    Number(input.vector !== undefined) +
    Number(input.entityKeys !== undefined) +
    Number(input.temporal !== undefined)
  );
}

export async function searchMemoryHybrid(
  pool: Pool,
  input: MemoryHybridSearchInput,
): Promise<readonly MemoryFusedHit[]> {
  if (requestedSignalCount(input) < 1) {
    throw new RangeError("hybrid retrieval requires at least one signal");
  }
  const candidateLimit = boundedCandidateLimit(input);

  return withTransaction(
    pool,
    async (client) => {
      const signalResults: MemorySignalResult[] = [];

      if (input.lexicalQuery !== undefined) {
        signalResults.push({
          signal: "lexical",
          hits: await searchMemoryLexical(client, {
            tenantId: input.tenantId,
            scopePredicate: input.scopePredicate,
            query: input.lexicalQuery,
            limit: candidateLimit,
          }),
        });
      }

      if (input.vector !== undefined) {
        signalResults.push({
          signal: "vector",
          hits: await searchMemoryVector(client, {
            tenantId: input.tenantId,
            scopePredicate: input.scopePredicate,
            compatibility: input.vector.compatibility,
            queryVector: input.vector.queryVector,
            limit: candidateLimit,
          }),
        });
      }

      if (input.entityKeys !== undefined) {
        signalResults.push({
          signal: "entity",
          hits: await searchMemoryEntity(client, {
            tenantId: input.tenantId,
            scopePredicate: input.scopePredicate,
            entityKeys: input.entityKeys,
            limit: candidateLimit,
          }),
        });
      }

      if (input.temporal !== undefined) {
        signalResults.push({
          signal: "temporal",
          hits: await searchMemoryTemporal(client, {
            tenantId: input.tenantId,
            scopePredicate: input.scopePredicate,
            fromInclusive: input.temporal.fromInclusive,
            toExclusive: input.temporal.toExclusive,
            ...(input.temporal.asOf !== undefined
              ? { asOf: input.temporal.asOf }
              : {}),
            limit: candidateLimit,
          }),
        });
      }

      return fuseMemorySignalHits({
        tenantId: input.tenantId,
        scopePredicate: input.scopePredicate,
        signalResults,
        limit: input.limit,
        ...(input.reciprocalRankConstant !== undefined
          ? { reciprocalRankConstant: input.reciprocalRankConstant }
          : {}),
      });
    },
    {
      isolation: "repeatable read",
      readOnly: true,
    },
  );
}

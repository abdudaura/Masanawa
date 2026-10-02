import {
  PlatformError,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import { memoryScopeKey } from "./invariants.js";
import type { MemoryScope, MemoryType } from "./model.js";
import type {
  MemoryLexicalHit,
  MemoryScopePredicate,
} from "./projection.js";
import type {
  MemoryEntityHit,
  MemoryTemporalHit,
  MemoryVectorHit,
} from "./retrieval.js";

export const memoryRetrievalSignals = [
  "lexical",
  "vector",
  "entity",
  "temporal",
] as const;

export type MemoryRetrievalSignal = (typeof memoryRetrievalSignals)[number];

export type MemoryRetrievalSignalHit =
  | MemoryLexicalHit
  | MemoryVectorHit
  | MemoryEntityHit
  | MemoryTemporalHit;

export interface MemorySignalResult {
  readonly signal: MemoryRetrievalSignal;
  readonly hits: readonly MemoryRetrievalSignalHit[];
}

export interface MemoryFusionContribution {
  readonly signal: MemoryRetrievalSignal;
  readonly rank: number;
  readonly reciprocalRank: number;
}

export interface MemoryFusedHit {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly sourceContentHash: string;
  readonly fusionScore: number;
  readonly contributions: readonly MemoryFusionContribution[];
}

export interface FuseMemorySignalHitsInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly signalResults: readonly MemorySignalResult[];
  readonly limit: number;
  readonly reciprocalRankConstant?: number;
}

function boundedInteger(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function invariantError(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "internal",
    message,
    retryable: false,
  });
}

function authorizationError(message: string): PlatformError {
  return new PlatformError({
    code: "memory.retrieval_scope_violation",
    category: "authorization",
    message,
    retryable: false,
  });
}

function assertSameCanonicalHit(
  current: MemoryFusedHit,
  candidate: MemoryRetrievalSignalHit,
): void {
  if (
    current.memoryRevisionId !== candidate.memoryRevisionId ||
    current.memoryType !== candidate.memoryType ||
    memoryScopeKey(current.scope) !== memoryScopeKey(candidate.scope) ||
    current.content !== candidate.content ||
    current.sourceContentHash !== candidate.sourceContentHash
  ) {
    throw invariantError(
      "memory.fusion_canonical_mismatch",
      "Retrieval signals disagreed about the canonical current memory revision",
    );
  }
}

export function fuseMemorySignalHits(
  input: FuseMemorySignalHitsInput,
): readonly MemoryFusedHit[] {
  const limit = boundedInteger(input.limit, "limit", 1, 100);
  const reciprocalRankConstant = boundedInteger(
    input.reciprocalRankConstant ?? 60,
    "reciprocalRankConstant",
    1,
    10_000,
  );
  if (
    !Array.isArray(input.signalResults) ||
    input.signalResults.length < 1 ||
    input.signalResults.length > memoryRetrievalSignals.length
  ) {
    throw new RangeError("fusion requires between 1 and 4 signal result sets");
  }

  const allowedScopeKeys = new Set(input.scopePredicate.keys);
  if (allowedScopeKeys.size < 1) {
    throw new RangeError("fusion requires explicit authorized memory scopes");
  }

  const seenSignals = new Set<MemoryRetrievalSignal>();
  const fused = new Map<MemoryRecordId, MemoryFusedHit>();

  for (const result of input.signalResults) {
    if (seenSignals.has(result.signal)) {
      throw new TypeError("fusion accepts at most one result set per signal");
    }
    seenSignals.add(result.signal);

    const seenInSignal = new Set<MemoryRecordId>();
    for (let index = 0; index < result.hits.length; index += 1) {
      const hit = result.hits[index]!;
      if (hit.tenantId !== input.tenantId) {
        throw authorizationError(
          "Retrieval signal returned a memory from a different tenant",
        );
      }
      if (!allowedScopeKeys.has(memoryScopeKey(hit.scope))) {
        throw authorizationError(
          "Retrieval signal returned a memory outside the authorized scope predicate",
        );
      }
      if (seenInSignal.has(hit.memoryRecordId)) {
        throw invariantError(
          "memory.fusion_duplicate_signal_hit",
          "Retrieval signal returned the same MemoryRecord more than once",
        );
      }
      seenInSignal.add(hit.memoryRecordId);

      const rank = index + 1;
      const reciprocalRank = 1 / (reciprocalRankConstant + rank);
      const contribution = Object.freeze({
        signal: result.signal,
        rank,
        reciprocalRank,
      });

      const current = fused.get(hit.memoryRecordId);
      if (!current) {
        fused.set(
          hit.memoryRecordId,
          Object.freeze({
            tenantId: hit.tenantId,
            memoryRecordId: hit.memoryRecordId,
            memoryRevisionId: hit.memoryRevisionId,
            memoryType: hit.memoryType,
            scope: hit.scope,
            content: hit.content,
            sourceContentHash: hit.sourceContentHash,
            fusionScore: reciprocalRank,
            contributions: Object.freeze([contribution]),
          }),
        );
        continue;
      }

      assertSameCanonicalHit(current, hit);
      fused.set(
        hit.memoryRecordId,
        Object.freeze({
          ...current,
          fusionScore: current.fusionScore + reciprocalRank,
          contributions: Object.freeze([
            ...current.contributions,
            contribution,
          ]),
        }),
      );
    }
  }

  return Object.freeze(
    [...fused.values()]
      .map((hit) =>
        Object.freeze({
          ...hit,
          contributions: Object.freeze(
            [...hit.contributions].sort(
              (left, right) =>
                memoryRetrievalSignals.indexOf(left.signal) -
                memoryRetrievalSignals.indexOf(right.signal),
            ),
          ),
        }),
      )
      .sort(
        (left, right) =>
          right.fusionScore - left.fusionScore ||
          left.memoryRecordId.localeCompare(right.memoryRecordId),
      )
      .slice(0, limit),
  );
}

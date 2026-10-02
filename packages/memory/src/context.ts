import {
  PlatformError,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import { memoryScopeKey } from "./invariants.js";
import type { MemoryScope, MemoryType } from "./model.js";
import type { MemoryFusedHit } from "./fusion.js";
import type { MemoryScopePredicate } from "./projection.js";

export interface MemoryContextTokenCounter {
  count(text: string): number;
}

export interface CompileMemoryContextInput {
  readonly tenantId: TenantId;
  readonly scopePredicate: MemoryScopePredicate;
  readonly hits: readonly MemoryFusedHit[];
  readonly maxItems: number;
  readonly maxTokens: number;
}

export interface MemoryContextProvenance {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly sourceContentHash: string;
}

export interface CompiledMemoryContextItem {
  readonly contextItemId: string;
  readonly text: string;
  readonly tokenCount: number;
  readonly provenance: MemoryContextProvenance;
  readonly fusionScore: number;
}

export interface CompiledMemoryContext {
  readonly tenantId: TenantId;
  readonly text: string;
  readonly items: readonly CompiledMemoryContextItem[];
  readonly usedTokens: number;
  readonly maxTokens: number;
  readonly maxItems: number;
  readonly skippedDuplicateCount: number;
  readonly skippedOversizeCount: number;
  readonly skippedBudgetCount: number;
}

function boundedBudget(
  value: number,
  name: string,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

function countTokens(
  counter: MemoryContextTokenCounter,
  text: string,
): number {
  const value = counter.count(text);
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000_000) {
    throw new TypeError(
      "Memory context token counter returned an invalid token count",
    );
  }
  return value;
}

function authorizationError(message: string): PlatformError {
  return new PlatformError({
    code: "memory.context_scope_violation",
    category: "authorization",
    message,
    retryable: false,
  });
}

export function compileMemoryContext(
  input: CompileMemoryContextInput,
  tokenCounter: MemoryContextTokenCounter,
): CompiledMemoryContext {
  const maxItems = boundedBudget(input.maxItems, "maxItems", 100);
  const maxTokens = boundedBudget(input.maxTokens, "maxTokens", 1_000_000);
  if (!tokenCounter || typeof tokenCounter.count !== "function") {
    throw new TypeError("tokenCounter.count is required");
  }

  const allowedScopes = new Set(input.scopePredicate.keys);
  if (allowedScopes.size < 1) {
    throw new RangeError("context compilation requires authorized memory scopes");
  }

  const included: CompiledMemoryContextItem[] = [];
  const seenRecords = new Set<MemoryRecordId>();
  let combinedText = "";
  let usedTokens = 0;
  let skippedDuplicateCount = 0;
  let skippedOversizeCount = 0;
  let skippedBudgetCount = 0;

  for (const hit of input.hits) {
    if (hit.tenantId !== input.tenantId) {
      throw authorizationError(
        "Context candidate belongs to a different tenant",
      );
    }
    const scopeKey = memoryScopeKey(hit.scope);
    if (!allowedScopes.has(scopeKey)) {
      throw authorizationError(
        "Context candidate is outside the authorized memory scopes",
      );
    }
    if (seenRecords.has(hit.memoryRecordId)) {
      skippedDuplicateCount += 1;
      continue;
    }
    seenRecords.add(hit.memoryRecordId);

    if (included.length >= maxItems) {
      skippedBudgetCount += 1;
      continue;
    }

    const itemText = hit.content;
    const itemTokens = countTokens(tokenCounter, itemText);
    if (itemTokens > maxTokens) {
      skippedOversizeCount += 1;
      continue;
    }

    const candidateText =
      combinedText.length === 0
        ? itemText
        : `${combinedText}\n\n${itemText}`;
    const candidateTokens = countTokens(tokenCounter, candidateText);
    if (candidateTokens > maxTokens) {
      skippedBudgetCount += 1;
      continue;
    }

    const item = Object.freeze({
      contextItemId: `memory:${hit.memoryRecordId}@${hit.memoryRevisionId}`,
      text: itemText,
      tokenCount: itemTokens,
      provenance: Object.freeze({
        tenantId: hit.tenantId,
        memoryRecordId: hit.memoryRecordId,
        memoryRevisionId: hit.memoryRevisionId,
        memoryType: hit.memoryType,
        scope: hit.scope,
        scopeKey,
        sourceContentHash: hit.sourceContentHash,
      }),
      fusionScore: hit.fusionScore,
    });
    included.push(item);
    combinedText = candidateText;
    usedTokens = candidateTokens;
  }

  return Object.freeze({
    tenantId: input.tenantId,
    text: combinedText,
    items: Object.freeze([...included]),
    usedTokens,
    maxTokens,
    maxItems,
    skippedDuplicateCount,
    skippedOversizeCount,
    skippedBudgetCount,
  });
}

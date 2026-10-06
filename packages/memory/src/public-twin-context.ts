import {
  PlatformError,
  type CharacterId,
  type TenantId,
} from "@masanawa/contracts";
import {
  compileMemoryContext,
  type CompiledMemoryContext,
  type MemoryContextTokenCounter,
} from "./context.js";
import type { MemoryFusedHit } from "./fusion.js";
import { createPublicTwinRepresentationPredicate } from "./representation.js";

export interface CompilePublicTwinMemoryContextInput {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly hits: readonly MemoryFusedHit[];
  readonly maxItems: number;
  readonly maxTokens: number;
}

function denial(message: string): PlatformError {
  return new PlatformError({
    code: "memory.public_twin_context_forbidden",
    category: "authorization",
    message,
    retryable: false,
  });
}

export function assertPublicTwinMemoryHit(input: {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly hit: MemoryFusedHit;
}): void {
  if (input.hit.tenantId !== input.tenantId) {
    throw denial("Public twin context candidate belongs to a different tenant");
  }

  if (
    input.hit.scope.kind !== "character-shared" ||
    input.hit.scope.characterId !== input.characterId
  ) {
    throw denial(
      "Public twin context may use only explicitly shared memory for that twin",
    );
  }
}

export function compilePublicTwinMemoryContext(
  input: CompilePublicTwinMemoryContextInput,
  tokenCounter: MemoryContextTokenCounter,
): CompiledMemoryContext {
  const boundary = Object.freeze({
    tenantId: input.tenantId,
    characterId: input.characterId,
  });
  const scopePredicate = createPublicTwinRepresentationPredicate(boundary);

  for (const hit of input.hits) {
    assertPublicTwinMemoryHit({
      tenantId: input.tenantId,
      characterId: input.characterId,
      hit,
    });
  }

  return compileMemoryContext(
    {
      tenantId: input.tenantId,
      scopePredicate,
      hits: input.hits,
      maxItems: input.maxItems,
      maxTokens: input.maxTokens,
    },
    tokenCounter,
  );
}

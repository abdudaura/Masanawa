import {
  PlatformError,
  type CharacterId,
  type TenantId,
} from "@masanawa/contracts";
import type {
  MemoryRecordSnapshot,
  MemoryScope,
} from "./model.js";
import {
  createMemoryScopePredicate,
  type MemoryScopePredicate,
} from "./projection.js";

export interface PublicTwinRepresentationBoundary {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
}

function denial(message: string): PlatformError {
  return new PlatformError({
    code: "memory.public_twin_private_scope_forbidden",
    category: "authorization",
    message,
    retryable: false,
  });
}

export function publicTwinRepresentationScope(
  boundary: PublicTwinRepresentationBoundary,
): MemoryScope {
  return Object.freeze({
    kind: "character-shared",
    characterId: boundary.characterId,
  });
}

export function createPublicTwinRepresentationPredicate(
  boundary: PublicTwinRepresentationBoundary,
): MemoryScopePredicate {
  return createMemoryScopePredicate([
    publicTwinRepresentationScope(boundary),
  ]);
}

export function assertMemoryAllowedInPublicTwinRepresentation(input: {
  readonly boundary: PublicTwinRepresentationBoundary;
  readonly snapshot: MemoryRecordSnapshot;
}): void {
  if (input.snapshot.record.tenantId !== input.boundary.tenantId) {
    throw denial("Public twin memory belongs to a different tenant");
  }

  const scope = input.snapshot.record.scope;
  if (
    scope.kind !== "character-shared" ||
    scope.characterId !== input.boundary.characterId
  ) {
    throw denial(
      "Public twin responses may use only explicitly shared memory for that twin",
    );
  }

  if (
    input.snapshot.currentRevision.tenantId !== input.boundary.tenantId ||
    input.snapshot.currentRevision.memoryRecordId !==
      input.snapshot.record.memoryRecordId ||
    input.snapshot.currentRevision.memoryRevisionId !==
      input.snapshot.record.currentRevisionId
  ) {
    throw new PlatformError({
      code: "memory.public_twin_canonical_mismatch",
      category: "internal",
      message: "Public twin memory snapshot is not canonical",
      retryable: false,
    });
  }
}

export function filterPublicTwinRepresentationMemory(input: {
  readonly boundary: PublicTwinRepresentationBoundary;
  readonly snapshots: readonly MemoryRecordSnapshot[];
}): readonly MemoryRecordSnapshot[] {
  for (const snapshot of input.snapshots) {
    assertMemoryAllowedInPublicTwinRepresentation({
      boundary: input.boundary,
      snapshot,
    });
  }
  return Object.freeze([...input.snapshots]);
}

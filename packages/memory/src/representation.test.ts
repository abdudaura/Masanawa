import { describe, expect, it } from "vitest";
import type { MemoryRecordSnapshot, MemoryScope } from "./model.js";
import {
  assertMemoryAllowedInPublicTwinRepresentation,
  createPublicTwinRepresentationPredicate,
} from "./representation.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const characterId = "character_00000000-0000-4000-8000-000000000002" as never;

function snapshot(scope: MemoryScope): MemoryRecordSnapshot {
  const recordId = "memory-record_00000000-0000-4000-8000-000000000003" as never;
  const revisionId = "memory-revision_00000000-0000-4000-8000-000000000004" as never;
  return {
    record: {
      tenantId,
      memoryRecordId: recordId,
      memoryType: "fact",
      scope,
      lifecycleState: "active",
      currentRevisionId: revisionId,
      revision: 1,
      lifecycleRevision: 1,
      createdAt: "2026-10-05T08:00:00.000Z" as never,
      updatedAt: "2026-10-05T08:00:00.000Z" as never,
    },
    currentRevision: {
      tenantId,
      memoryRevisionId: revisionId,
      memoryRecordId: recordId,
      revisionNumber: 1,
      content: "Publicly shared representation fact",
      payload: {},
      confidence: 1,
      extraction: { method: "owner-approved", modelVersion: null },
      eventTime: null,
      observedAt: "2026-10-05T08:00:00.000Z" as never,
      validFrom: null,
      validTo: null,
      expiresAt: null,
      createdAt: "2026-10-05T08:00:00.000Z" as never,
      evidence: [],
    },
  };
}

describe("public twin representation memory", () => {
  it("builds a predicate containing only this twin's shared scope", () => {
    const predicate = createPublicTwinRepresentationPredicate({
      tenantId,
      characterId,
    });
    expect(predicate.scopes).toEqual([{ kind: "character-shared", characterId }]);
    expect(predicate.keys).toHaveLength(1);
  });

  it("admits explicitly shared memory for the represented twin", () => {
    expect(() =>
      assertMemoryAllowedInPublicTwinRepresentation({
        boundary: { tenantId, characterId },
        snapshot: snapshot({ kind: "character-shared", characterId }),
      }),
    ).not.toThrow();
  });

  it.each([
    { kind: "character-private", characterId } as const,
    {
      kind: "relationship",
      relationshipId: "relationship_00000000-0000-4000-8000-000000000005" as never,
    } as const,
    {
      kind: "session",
      characterSessionId: "character-session_00000000-0000-4000-8000-000000000006" as never,
    } as const,
  ])("rejects private/bounded scope %#", (scope) => {
    expect(() =>
      assertMemoryAllowedInPublicTwinRepresentation({
        boundary: { tenantId, characterId },
        snapshot: snapshot(scope),
      }),
    ).toThrow("only explicitly shared memory");
  });

  it("rejects another twin's shared memory", () => {
    expect(() =>
      assertMemoryAllowedInPublicTwinRepresentation({
        boundary: { tenantId, characterId },
        snapshot: snapshot({
          kind: "character-shared",
          characterId: "character_00000000-0000-4000-8000-000000000999" as never,
        }),
      }),
    ).toThrow("only explicitly shared memory");
  });
});

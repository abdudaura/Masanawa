import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import type { MemoryRecordSnapshot, MemoryScope } from "./model.js";
import {
  assertMemoryAllowedInPublicTwinRepresentation,
  createPublicTwinRepresentationPredicate,
} from "./representation.js";

const tenantId = createCanonicalId("tenant");
const characterId = createCanonicalId("character");

function snapshot(scope: MemoryScope): MemoryRecordSnapshot {
  const recordId = createCanonicalId("memory-record");
  const revisionId = createCanonicalId("memory-revision");
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
      relationshipId: createCanonicalId("relationship"),
    } as const,
    {
      kind: "session",
      characterSessionId: createCanonicalId("character-session"),
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
          characterId: createCanonicalId("character"),
        }),
      }),
    ).toThrow("only explicitly shared memory");
  });
});

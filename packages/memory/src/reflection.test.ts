import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import type { MemoryRecordSnapshot } from "./model.js";
import {
  memoryReflectionFingerprint,
  normalizeMemoryReflectionIdentity,
} from "./reflection.js";

function snapshot(input: {
  tenantId: ReturnType<typeof createCanonicalId<"tenant">>;
  relationshipId: ReturnType<typeof createCanonicalId<"relationship">>;
  content: string;
}): MemoryRecordSnapshot {
  const memoryRecordId = createCanonicalId("memory-record");
  const memoryRevisionId = createCanonicalId("memory-revision");
  const observedAt = toInstant("2026-10-02T10:30:00Z");
  return {
    record: {
      tenantId: input.tenantId,
      memoryRecordId,
      memoryType: "fact",
      scope: {
        kind: "relationship",
        relationshipId: input.relationshipId,
      },
      lifecycleState: "active",
      currentRevisionId: memoryRevisionId,
      revision: 1,
      lifecycleRevision: 1,
      createdAt: observedAt,
      updatedAt: observedAt,
    },
    currentRevision: {
      tenantId: input.tenantId,
      memoryRevisionId,
      memoryRecordId,
      revisionNumber: 1,
      content: input.content,
      payload: {},
      confidence: 1,
      extraction: { method: "fixture", modelVersion: null },
      eventTime: null,
      observedAt,
      validFrom: null,
      validTo: null,
      expiresAt: null,
      createdAt: observedAt,
      evidence: [
        {
          ordinal: 0,
          sourceKind: "message",
          sourceReference: `message:${memoryRecordId}`,
          sourceContentHash: "a".repeat(64),
          verbatimText: null,
          observedAt,
        },
      ],
    },
  };
}

describe("memory reflection identity", () => {
  it("is stable across source order and excludes generated output variability", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const first = snapshot({
      tenantId,
      relationshipId,
      content: "Fact one",
    });
    const second = snapshot({
      tenantId,
      relationshipId,
      content: "Fact two",
    });
    const base = {
      tenantId,
      scope: { kind: "relationship", relationshipId } as const,
      purposeKey: "relationship-pattern",
      reflector: { key: "reflection-model", version: "v1" },
    };

    const forward = memoryReflectionFingerprint({
      ...base,
      sources: [first, second],
    });
    const reversed = memoryReflectionFingerprint({
      ...base,
      sources: [second, first],
    });

    expect(forward).toBe(reversed);
    expect(forward).toHaveLength(64);

    const changedPurpose = memoryReflectionFingerprint({
      ...base,
      purposeKey: "different-purpose",
      sources: [first, second],
    });
    expect(changedPurpose).not.toBe(forward);
  });

  it("rejects cross-scope and stale source snapshots", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const alpha = snapshot({
      tenantId,
      relationshipId: relationshipA,
      content: "Alpha",
    });
    const beta = snapshot({
      tenantId,
      relationshipId: relationshipB,
      content: "Beta",
    });

    expect(() =>
      normalizeMemoryReflectionIdentity({
        tenantId,
        scope: { kind: "relationship", relationshipId: relationshipA },
        purposeKey: "cross-scope",
        reflector: { key: "fixture", version: "v1" },
        sources: [alpha, beta],
      }),
    ).toThrow(/exact output MemoryScope/u);

    expect(() =>
      normalizeMemoryReflectionIdentity({
        tenantId,
        scope: { kind: "relationship", relationshipId: relationshipA },
        purposeKey: "stale-source",
        reflector: { key: "fixture", version: "v1" },
        sources: [
          {
            ...alpha,
            record: {
              ...alpha.record,
              lifecycleState: "superseded",
            },
          },
        ],
      }),
    ).toThrow(/must be active/u);
  });
});

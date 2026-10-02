import {
  createCanonicalId,
  toInstant,
  type RelationshipId,
  type TenantId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import type { MemoryRecordSnapshot } from "./model.js";
import {
  memoryReflectionFingerprint,
  memoryReflectionSourceFromSnapshot,
  normalizeMemoryReflectionIdentity,
} from "./reflection.js";

function snapshot(input: {
  tenantId: TenantId;
  relationshipId: RelationshipId;
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
  it("is stable across source order and generated output variability", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const first = memoryReflectionSourceFromSnapshot(
      snapshot({ tenantId, relationshipId, content: "Fact one" }),
    );
    const second = memoryReflectionSourceFromSnapshot(
      snapshot({ tenantId, relationshipId, content: "Fact two" }),
    );
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

  it("validates current source snapshots before converting them to replay descriptors", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const alpha = snapshot({
      tenantId,
      relationshipId,
      content: "Alpha",
    });

    expect(() =>
      memoryReflectionSourceFromSnapshot({
        ...alpha,
        record: {
          ...alpha.record,
          lifecycleState: "superseded",
        },
      }),
    ).toThrow(/must be active/u);

    const source = memoryReflectionSourceFromSnapshot(alpha);
    expect(
      normalizeMemoryReflectionIdentity({
        tenantId,
        scope: { kind: "relationship", relationshipId },
        purposeKey: "normalized",
        reflector: { key: "fixture", version: "v1" },
        sources: [source],
      }).sources,
    ).toEqual([source]);
  });

  it("rejects duplicate source records and malformed source hashes", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const source = memoryReflectionSourceFromSnapshot(
      snapshot({ tenantId, relationshipId, content: "Alpha" }),
    );

    expect(() =>
      normalizeMemoryReflectionIdentity({
        tenantId,
        scope: { kind: "relationship", relationshipId },
        purposeKey: "duplicate",
        reflector: { key: "fixture", version: "v1" },
        sources: [source, source],
      }),
    ).toThrow(/must be unique/u);

    expect(() =>
      normalizeMemoryReflectionIdentity({
        tenantId,
        scope: { kind: "relationship", relationshipId },
        purposeKey: "bad-hash",
        reflector: { key: "fixture", version: "v1" },
        sources: [{ ...source, sourceContentHash: "not-a-hash" }],
      }),
    ).toThrow(/SHA-256/u);
  });
});

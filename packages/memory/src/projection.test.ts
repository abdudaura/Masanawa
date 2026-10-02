import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertMemoryRetrievalAdapterCapabilities,
  createMemoryScopePredicate,
  memoryProjectionSourceContentHash,
  normalizeMemoryProjectionGenerationInput,
} from "./projection.js";
import type { MemoryRecordSnapshot } from "./model.js";

describe("memory projection contracts", () => {
  it("requires exact explicit authorized scopes and deduplicates them", () => {
    const relationshipId = createCanonicalId("relationship");
    const predicate = createMemoryScopePredicate([
      { kind: "relationship", relationshipId },
      { kind: "relationship", relationshipId },
    ]);

    expect(predicate.scopes).toHaveLength(1);
    expect(predicate.keys).toEqual([
      `relationship:${relationshipId}`,
    ]);
    expect(() => createMemoryScopePredicate([])).toThrow(/authorized memory scopes/u);
  });

  it("fails closed when a retrieval adapter cannot enforce exact scope filtering", () => {
    expect(() =>
      assertMemoryRetrievalAdapterCapabilities(
        {
          exactScopeFiltering: false,
          lexical: true,
          vector: false,
          entity: false,
          temporal: false,
        },
        "lexical",
      ),
    ).toThrow(/exact authorized scope predicate/u);
  });

  it("requires vector provider/model/dimension compatibility only for vector generations", () => {
    const tenantId = createCanonicalId("tenant");
    const createdAt = toInstant("2026-10-02T06:00:00Z");

    expect(() =>
      normalizeMemoryProjectionGenerationInput({
        tenantId,
        memoryProjectionGenerationId: createCanonicalId(
          "memory-projection-generation",
        ),
        kind: "vector",
        implementationKey: "pgvector",
        schemaVersion: 1,
        createdAt,
      }),
    ).toThrow(/compatibility metadata/u);

    const vector = normalizeMemoryProjectionGenerationInput({
      tenantId,
      memoryProjectionGenerationId: createCanonicalId(
        "memory-projection-generation",
      ),
      kind: "vector",
      implementationKey: "pgvector",
      schemaVersion: 1,
      vectorCompatibility: {
        providerKey: "provider-a",
        modelKey: "embed-v1",
        dimension: 1536,
      },
      createdAt,
    });
    expect(vector.vectorCompatibility).toEqual({
      providerKey: "provider-a",
      modelKey: "embed-v1",
      dimension: 1536,
    });

    expect(() =>
      normalizeMemoryProjectionGenerationInput({
        tenantId,
        memoryProjectionGenerationId: createCanonicalId(
          "memory-projection-generation",
        ),
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        vectorCompatibility: {
          providerKey: "provider-a",
          modelKey: "embed-v1",
          dimension: 1536,
        },
        createdAt,
      }),
    ).toThrow(/non-vector/u);
  });

  it("changes projection source hash when canonical revision content changes", () => {
    const tenantId = createCanonicalId("tenant");
    const memoryRecordId = createCanonicalId("memory-record");
    const memoryRevisionId = createCanonicalId("memory-revision");
    const relationshipId = createCanonicalId("relationship");
    const now = toInstant("2026-10-02T06:00:00Z");

    const snapshot: MemoryRecordSnapshot = {
      record: {
        tenantId,
        memoryRecordId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        lifecycleState: "active",
        currentRevisionId: memoryRevisionId,
        revision: 1,
        lifecycleRevision: 1,
        createdAt: now,
        updatedAt: now,
      },
      currentRevision: {
        tenantId,
        memoryRevisionId,
        memoryRecordId,
        revisionNumber: 1,
        content: "The original canonical fact.",
        payload: {},
        confidence: 1,
        extraction: { method: "fixture", modelVersion: null },
        eventTime: null,
        observedAt: now,
        validFrom: null,
        validTo: null,
        expiresAt: null,
        createdAt: now,
        evidence: [
          {
            ordinal: 1,
            sourceKind: "message",
            sourceReference: "message:1",
            sourceContentHash: "a".repeat(64),
            verbatimText: null,
            observedAt: now,
          },
        ],
      },
    };

    const first = memoryProjectionSourceContentHash(snapshot);
    const second = memoryProjectionSourceContentHash({
      ...snapshot,
      currentRevision: {
        ...snapshot.currentRevision,
        content: "The corrected canonical fact.",
      },
    });
    expect(first).toHaveLength(64);
    expect(second).toHaveLength(64);
    expect(second).not.toBe(first);
  });
});

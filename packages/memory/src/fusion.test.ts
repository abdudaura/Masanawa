import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import { fuseMemorySignalHits } from "./fusion.js";
import { createMemoryScopePredicate } from "./projection.js";

describe("memory retrieval fusion", () => {
  it("fuses signal ranks deterministically without changing authorization", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const scope = { kind: "relationship", relationshipId } as const;
    const scopePredicate = createMemoryScopePredicate([scope]);
    const recordA = createCanonicalId("memory-record");
    const recordB = createCanonicalId("memory-record");
    const revisionA = createCanonicalId("memory-revision");
    const revisionB = createCanonicalId("memory-revision");
    const lexicalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const vectorGeneration = createCanonicalId(
      "memory-projection-generation",
    );

    const results = fuseMemorySignalHits({
      tenantId,
      scopePredicate,
      limit: 10,
      signalResults: [
        {
          signal: "lexical",
          hits: [
            {
              tenantId,
              memoryProjectionGenerationId: lexicalGeneration,
              memoryRecordId: recordB,
              memoryRevisionId: revisionB,
              memoryType: "fact",
              scope,
              content: "Beta memory",
              lexicalRank: 0.9,
              sourceContentHash: "b".repeat(64),
            },
            {
              tenantId,
              memoryProjectionGenerationId: lexicalGeneration,
              memoryRecordId: recordA,
              memoryRevisionId: revisionA,
              memoryType: "fact",
              scope,
              content: "Alpha memory",
              lexicalRank: 0.8,
              sourceContentHash: "a".repeat(64),
            },
          ],
        },
        {
          signal: "vector",
          hits: [
            {
              tenantId,
              memoryProjectionGenerationId: vectorGeneration,
              memoryRecordId: recordA,
              memoryRevisionId: revisionA,
              memoryType: "fact",
              scope,
              content: "Alpha memory",
              similarity: 0.99,
              sourceContentHash: "a".repeat(64),
            },
          ],
        },
      ],
    });

    expect(results.map((hit) => hit.memoryRecordId)).toEqual([
      recordA,
      recordB,
    ]);
    expect(results[0]?.contributions.map((item) => item.signal)).toEqual([
      "lexical",
      "vector",
    ]);
    expect(results[0]!.fusionScore).toBeGreaterThan(
      results[1]!.fusionScore,
    );
  });

  it("fails closed if a signal returns a hit outside the authorized scope", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const recordId = createCanonicalId("memory-record");
    const revisionId = createCanonicalId("memory-revision");
    const generationId = createCanonicalId(
      "memory-projection-generation",
    );

    expect(() =>
      fuseMemorySignalHits({
        tenantId,
        scopePredicate: createMemoryScopePredicate([
          { kind: "relationship", relationshipId: relationshipA },
        ]),
        limit: 5,
        signalResults: [
          {
            signal: "lexical",
            hits: [
              {
                tenantId,
                memoryProjectionGenerationId: generationId,
                memoryRecordId: recordId,
                memoryRevisionId: revisionId,
                memoryType: "fact",
                scope: {
                  kind: "relationship",
                  relationshipId: relationshipB,
                },
                content: "Wrong relationship",
                lexicalRank: 1,
                sourceContentHash: "c".repeat(64),
              },
            ],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "memory.retrieval_scope_violation",
      }),
    );
  });

  it("refuses to fuse different canonical revisions of one record", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const scope = { kind: "relationship", relationshipId } as const;
    const recordId = createCanonicalId("memory-record");
    const revisionA = createCanonicalId("memory-revision");
    const revisionB = createCanonicalId("memory-revision");
    const generationA = createCanonicalId(
      "memory-projection-generation",
    );
    const generationB = createCanonicalId(
      "memory-projection-generation",
    );

    expect(() =>
      fuseMemorySignalHits({
        tenantId,
        scopePredicate: createMemoryScopePredicate([scope]),
        limit: 5,
        signalResults: [
          {
            signal: "lexical",
            hits: [
              {
                tenantId,
                memoryProjectionGenerationId: generationA,
                memoryRecordId: recordId,
                memoryRevisionId: revisionA,
                memoryType: "fact",
                scope,
                content: "Revision A",
                lexicalRank: 1,
                sourceContentHash: "d".repeat(64),
              },
            ],
          },
          {
            signal: "vector",
            hits: [
              {
                tenantId,
                memoryProjectionGenerationId: generationB,
                memoryRecordId: recordId,
                memoryRevisionId: revisionB,
                memoryType: "fact",
                scope,
                content: "Revision B",
                similarity: 1,
                sourceContentHash: "e".repeat(64),
              },
            ],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "memory.fusion_canonical_mismatch",
      }),
    );
  });
});

import {
  createCanonicalId,
  type RelationshipId,
  type TenantId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import { compileMemoryContext } from "./context.js";
import { createMemoryScopePredicate } from "./projection.js";
import type { MemoryFusedHit } from "./fusion.js";

function hit(input: {
  tenantId: TenantId;
  relationshipId: RelationshipId;
  content: string;
  score: number;
}): MemoryFusedHit {
  return {
    tenantId: input.tenantId,
    memoryRecordId: createCanonicalId("memory-record"),
    memoryRevisionId: createCanonicalId("memory-revision"),
    memoryType: "fact",
    scope: {
      kind: "relationship",
      relationshipId: input.relationshipId,
    },
    content: input.content,
    sourceContentHash: "a".repeat(64),
    fusionScore: input.score,
    contributions: [],
  };
}

describe("memory context compiler", () => {
  const tokenCounter = {
    count(text: string): number {
      return text.length;
    },
  };

  it("enforces deterministic budgets and keeps provenance for every item", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const first = hit({
      tenantId,
      relationshipId,
      content: "alpha",
      score: 2,
    });
    const second = hit({
      tenantId,
      relationshipId,
      content: "beta",
      score: 1,
    });
    const third = hit({
      tenantId,
      relationshipId,
      content: "gamma",
      score: 0.5,
    });

    const compiled = compileMemoryContext(
      {
        tenantId,
        scopePredicate: createMemoryScopePredicate([
          { kind: "relationship", relationshipId },
        ]),
        hits: [first, second, third],
        maxItems: 2,
        maxTokens: 10,
      },
      tokenCounter,
    );

    expect(compiled.text).toBe("alpha");
    expect(compiled.usedTokens).toBe(5);
    expect(compiled.items).toHaveLength(1);
    expect(compiled.skippedBudgetCount).toBe(2);
    expect(compiled.items[0]?.provenance).toMatchObject({
      tenantId,
      memoryRecordId: first.memoryRecordId,
      memoryRevisionId: first.memoryRevisionId,
      scope: {
        kind: "relationship",
        relationshipId,
      },
      sourceContentHash: first.sourceContentHash,
    });
  });

  it("skips one oversized memory and continues with later eligible hits", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const oversized = hit({
      tenantId,
      relationshipId,
      content: "this-memory-is-too-large",
      score: 2,
    });
    const usable = hit({
      tenantId,
      relationshipId,
      content: "small",
      score: 1,
    });

    const compiled = compileMemoryContext(
      {
        tenantId,
        scopePredicate: createMemoryScopePredicate([
          { kind: "relationship", relationshipId },
        ]),
        hits: [oversized, usable],
        maxItems: 5,
        maxTokens: 10,
      },
      tokenCounter,
    );

    expect(compiled.items.map((item) => item.provenance.memoryRecordId)).toEqual([
      usable.memoryRecordId,
    ]);
    expect(compiled.skippedOversizeCount).toBe(1);
  });

  it("fails closed when any candidate is outside the authorized scope", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");

    expect(() =>
      compileMemoryContext(
        {
          tenantId,
          scopePredicate: createMemoryScopePredicate([
            { kind: "relationship", relationshipId: relationshipA },
          ]),
          hits: [
            hit({
              tenantId,
              relationshipId: relationshipB,
              content: "must not compile",
              score: 1,
            }),
          ],
          maxItems: 5,
          maxTokens: 100,
        },
        tokenCounter,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "memory.context_scope_violation",
      }),
    );
  });
});

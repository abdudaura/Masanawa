import { describe, expect, it } from "vitest";
import type { MemoryFusedHit } from "./fusion.js";
import {
  assertPublicTwinMemoryHit,
  compilePublicTwinMemoryContext,
} from "./public-twin-context.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const characterId = "character_00000000-0000-4000-8000-000000000002" as never;
const otherCharacterId = "character_00000000-0000-4000-8000-000000000099" as never;

function hit(input: {
  readonly scope:
    | { readonly kind: "character-shared"; readonly characterId: typeof characterId }
    | { readonly kind: "character-private"; readonly characterId: typeof characterId }
    | { readonly kind: "relationship"; readonly relationshipId: never };
  readonly tenant?: typeof tenantId;
  readonly suffix?: string;
}): MemoryFusedHit {
  const suffix = input.suffix ?? "003";
  return {
    tenantId: input.tenant ?? tenantId,
    memoryRecordId: `memory-record_00000000-0000-4000-8000-000000000${suffix}` as never,
    memoryRevisionId:
      `memory-revision_00000000-0000-4000-8000-000000000${suffix}` as never,
    memoryType: "fact",
    scope: input.scope,
    content: `memory ${suffix}`,
    sourceContentHash: `sha256:${suffix}`,
    fusionScore: 1,
    contributions: [],
  };
}

const tokenCounter = {
  count(text: string): number {
    return text.length;
  },
};

describe("public twin context safety", () => {
  it("compiles only the represented twin's explicitly shared memory", () => {
    const shared = hit({
      scope: { kind: "character-shared", characterId },
    });

    const context = compilePublicTwinMemoryContext(
      {
        tenantId,
        characterId,
        hits: [shared],
        maxItems: 5,
        maxTokens: 1000,
      },
      tokenCounter,
    );

    expect(context.items).toHaveLength(1);
    expect(context.items[0]?.provenance.scope).toEqual({
      kind: "character-shared",
      characterId,
    });
    expect(context.text).toBe("memory 003");
  });

  it.each([
    {
      name: "owner-private Character memory",
      candidate: hit({
        scope: { kind: "character-private", characterId },
        suffix: "010",
      }),
    },
    {
      name: "Relationship-private memory",
      candidate: hit({
        scope: {
          kind: "relationship",
          relationshipId:
            "relationship_00000000-0000-4000-8000-000000000011" as never,
        },
        suffix: "011",
      }),
    },
    {
      name: "another Twin's shared memory",
      candidate: hit({
        scope: {
          kind: "character-shared",
          characterId: otherCharacterId as typeof characterId,
        },
        suffix: "012",
      }),
    },
  ])("fails closed for $name", ({ candidate }) => {
    expect(() =>
      compilePublicTwinMemoryContext(
        {
          tenantId,
          characterId,
          hits: [candidate],
          maxItems: 5,
          maxTokens: 1000,
        },
        tokenCounter,
      ),
    ).toThrow("only explicitly shared memory");
  });

  it("rejects cross-tenant candidates before context compilation", () => {
    const candidate = hit({
      tenant: "tenant_00000000-0000-4000-8000-000000000999" as typeof tenantId,
      scope: { kind: "character-shared", characterId },
      suffix: "013",
    });

    expect(() =>
      assertPublicTwinMemoryHit({ tenantId, characterId, hit: candidate }),
    ).toThrow("different tenant");
  });

  it("rejects a mixed batch rather than silently dropping private memory", () => {
    const shared = hit({
      scope: { kind: "character-shared", characterId },
      suffix: "020",
    });
    const privateHit = hit({
      scope: { kind: "character-private", characterId },
      suffix: "021",
    });

    expect(() =>
      compilePublicTwinMemoryContext(
        {
          tenantId,
          characterId,
          hits: [shared, privateHit],
          maxItems: 5,
          maxTokens: 1000,
        },
        tokenCounter,
      ),
    ).toThrow("only explicitly shared memory");
  });

  it("preserves canonical Memory provenance through the public compiler", () => {
    const shared = hit({
      scope: { kind: "character-shared", characterId },
      suffix: "030",
    });

    const context = compilePublicTwinMemoryContext(
      {
        tenantId,
        characterId,
        hits: [shared],
        maxItems: 5,
        maxTokens: 1000,
      },
      tokenCounter,
    );

    expect(context.items[0]?.provenance).toMatchObject({
      tenantId,
      memoryRecordId: shared.memoryRecordId,
      memoryRevisionId: shared.memoryRevisionId,
      sourceContentHash: shared.sourceContentHash,
    });
  });
});

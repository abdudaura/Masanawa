import { describe, expect, it } from "vitest";
import {
  assertCharacterSurfaceConsistency,
  assertCommerceExecutorCannotSubstituteOrigin,
} from "./character-surface-consistency.js";

const tenantId =
  "tenant_01890f4c-0000-7000-8000-000000000001" as never;
const presentationCharacterId =
  "character_01890f4c-0000-7000-8000-000000000002" as never;
const executorCharacterId =
  "character_01890f4c-0000-7000-8000-000000000003" as never;

function evidence() {
  return [
    {
      tenantId,
      role: "social-presentation" as const,
      characterId: presentationCharacterId,
      sourceReference: "social-content:1",
      sourceRevision: 3,
    },
    {
      tenantId,
      role: "studio-media" as const,
      characterId: presentationCharacterId,
      sourceReference: "media-artifact:1",
      sourceRevision: 2,
    },
    {
      tenantId,
      role: "commerce-originating" as const,
      characterId: presentationCharacterId,
      sourceReference: "quote:1",
      sourceRevision: 1,
    },
    {
      tenantId,
      role: "commerce-executor" as const,
      characterId: executorCharacterId,
      sourceReference: "fulfillment:1",
      sourceRevision: 1,
    },
  ];
}

describe("Character surface consistency", () => {
  it("requires one exact presentation Character across Social, Studio and Commerce origin", () => {
    const result = assertCharacterSurfaceConsistency({
      tenantId,
      presentationCharacterId,
      evidence: evidence(),
    });

    expect(result.presentationCharacterId).toBe(presentationCharacterId);
    expect(result.executorCharacterIds).toEqual([executorCharacterId]);
  });

  it("allows a separate Commerce executor without letting it replace the origin", () => {
    const consistency = assertCharacterSurfaceConsistency({
      tenantId,
      presentationCharacterId,
      evidence: evidence(),
    });

    expect(() =>
      assertCommerceExecutorCannotSubstituteOrigin({
        consistency,
        executorCharacterId,
      }),
    ).not.toThrow();

    expect(() =>
      assertCommerceExecutorCannotSubstituteOrigin({
        consistency,
        executorCharacterId:
          "character_01890f4c-0000-7000-8000-000000000099" as never,
      }),
    ).toThrow("not declared");
  });

  it("fails closed if Social, Studio or Commerce origin uses a different Character", () => {
    for (const targetRole of [
      "social-presentation",
      "studio-media",
      "commerce-originating",
    ] as const) {
      const changed = evidence().map((item) =>
        item.role === targetRole
          ? {
              ...item,
              characterId: executorCharacterId,
            }
          : item,
      );

      expect(() =>
        assertCharacterSurfaceConsistency({
          tenantId,
          presentationCharacterId,
          evidence: changed,
        }),
      ).toThrow("does not match");
    }
  });

  it("rejects cross-Tenant evidence and missing required surfaces", () => {
    expect(() =>
      assertCharacterSurfaceConsistency({
        tenantId,
        presentationCharacterId,
        evidence: evidence().map((item, index) =>
          index === 0
            ? {
                ...item,
                tenantId:
                  "tenant_01890f4c-0000-7000-8000-000000000099" as never,
              }
            : item,
        ),
      }),
    ).toThrow("Tenant");

    expect(() =>
      assertCharacterSurfaceConsistency({
        tenantId,
        presentationCharacterId,
        evidence: evidence().filter(
          (item) => item.role !== "studio-media",
        ),
      }),
    ).toThrow("missing required evidence");
  });

  it("rejects duplicate source/revision evidence and empty evidence", () => {
    const duplicated = [...evidence(), evidence()[0]!];
    expect(() =>
      assertCharacterSurfaceConsistency({
        tenantId,
        presentationCharacterId,
        evidence: duplicated,
      }),
    ).toThrow("Duplicate");

    expect(() =>
      assertCharacterSurfaceConsistency({
        tenantId,
        presentationCharacterId,
        evidence: [],
      }),
    ).toThrow("requires evidence");
  });
});

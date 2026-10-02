import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import { createMemoryScopePredicate } from "./projection.js";
import {
  assertMemoryVectorCompatibility,
  normalizeMemoryEntityKeys,
  normalizeMemoryEntitySearchInput,
  normalizeMemoryTemporalSearchInput,
  normalizeMemoryVectorSearchInput,
} from "./retrieval.js";

describe("memory multisignal retrieval contracts", () => {
  it("normalizes entity keys deterministically and removes duplicates", () => {
    expect(
      normalizeMemoryEntityKeys([
        "  Amina   Bello ",
        "amina bello",
        "KATSINA",
      ]),
    ).toEqual(["amina bello", "katsina"]);
  });

  it("requires explicit scopes for entity retrieval", () => {
    const tenantId = createCanonicalId("tenant");
    expect(() =>
      normalizeMemoryEntitySearchInput({
        tenantId,
        scopePredicate: { scopes: [], keys: [] },
        entityKeys: ["amina"],
        limit: 5,
      }),
    ).toThrow(/authorized memory scopes/u);
  });

  it("binds vector queries to exact provider, model and dimension", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const scopePredicate = createMemoryScopePredicate([
      { kind: "relationship", relationshipId },
    ]);

    const normalized = normalizeMemoryVectorSearchInput({
      tenantId,
      scopePredicate,
      compatibility: {
        providerKey: "provider-a",
        modelKey: "embed-v1",
        dimension: 3,
      },
      queryVector: [0.1, 0.2, 0.3],
      limit: 10,
    });
    expect(normalized.queryVector).toEqual([0.1, 0.2, 0.3]);

    expect(() =>
      normalizeMemoryVectorSearchInput({
        tenantId,
        scopePredicate,
        compatibility: {
          providerKey: "provider-a",
          modelKey: "embed-v1",
          dimension: 3,
        },
        queryVector: [0.1, 0.2],
        limit: 10,
      }),
    ).toThrow(/exactly match/u);

    expect(() =>
      assertMemoryVectorCompatibility(
        {
          providerKey: "provider-a",
          modelKey: "embed-v1",
          dimension: 3,
        },
        {
          providerKey: "provider-a",
          modelKey: "embed-v2",
          dimension: 3,
        },
      ),
    ).toThrow(/does not match/u);
  });

  it("normalizes temporal windows and rejects inverted ranges", () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const scopePredicate = createMemoryScopePredicate([
      { kind: "relationship", relationshipId },
    ]);

    const normalized = normalizeMemoryTemporalSearchInput({
      tenantId,
      scopePredicate,
      fromInclusive: toInstant("2026-10-01T00:00:00Z"),
      toExclusive: toInstant("2026-10-02T00:00:00Z"),
      asOf: toInstant("2026-10-01T12:00:00Z"),
      limit: 20,
    });
    expect(normalized.asOf).toBe("2026-10-01T12:00:00.000Z");

    expect(() =>
      normalizeMemoryTemporalSearchInput({
        tenantId,
        scopePredicate,
        fromInclusive: toInstant("2026-10-02T00:00:00Z"),
        toExclusive: toInstant("2026-10-01T00:00:00Z"),
        limit: 20,
      }),
    ).toThrow(/before/u);
  });
});

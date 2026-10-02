import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  memoryScopeKey,
  normalizeMemoryRevisionContent,
  normalizeMemoryScope,
} from "./invariants.js";

const hash = "a".repeat(64);

describe("memory invariants", () => {
  it("keeps relationship scopes explicit and non-interchangeable", () => {
    const first = createCanonicalId("relationship");
    const second = createCanonicalId("relationship");

    expect(
      memoryScopeKey({ kind: "relationship", relationshipId: first }),
    ).not.toBe(
      memoryScopeKey({ kind: "relationship", relationshipId: second }),
    );

    expect(
      normalizeMemoryScope({
        kind: "character-shared",
        characterId: createCanonicalId("character"),
      }).kind,
    ).toBe("character-shared");
  });

  it("preserves verbatim evidence while normalizing extracted memory content", () => {
    const observedAt = toInstant("2026-10-02T04:00:00Z");
    const normalized = normalizeMemoryRevisionContent({
      content: "  User prefers morning reminders.  ",
      extractionMethod: "model",
      extractionModelVersion: "memory-extractor-v1",
      observedAt,
      evidence: [
        {
          sourceKind: "message",
          sourceReference: "message:123",
          sourceContentHash: hash,
          verbatimText: "  Please remind me in the morning.\n",
          observedAt,
        },
      ],
    });

    expect(normalized.content).toBe("User prefers morning reminders.");
    expect(normalized.evidence[0]?.verbatimText).toBe(
      "  Please remind me in the morning.\n",
    );
    expect(normalized.evidence[0]?.sourceContentHash).toBe(hash);
  });

  it("requires provenance evidence and valid temporal bounds", () => {
    const observedAt = toInstant("2026-10-02T04:00:00Z");

    expect(() =>
      normalizeMemoryRevisionContent({
        content: "No provenance",
        extractionMethod: "model",
        observedAt,
        evidence: [],
      }),
    ).toThrow(/evidence/u);

    expect(() =>
      normalizeMemoryRevisionContent({
        content: "Bad validity",
        extractionMethod: "model",
        observedAt,
        validFrom: toInstant("2026-10-02T05:00:00Z"),
        validTo: toInstant("2026-10-02T04:30:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:123",
            sourceContentHash: hash,
            observedAt,
          },
        ],
      }),
    ).toThrow(/validTo/u);

    expect(() =>
      normalizeMemoryRevisionContent({
        content: "Bad expiry",
        extractionMethod: "model",
        observedAt,
        expiresAt: toInstant("2026-10-02T03:59:59Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:123",
            sourceContentHash: hash,
            observedAt,
          },
        ],
      }),
    ).toThrow(/expiresAt/u);
  });
});

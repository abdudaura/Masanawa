import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  memoryExtractionRequestFingerprint,
  normalizeMemoryExtractionRequest,
} from "./extraction.js";

function request() {
  return {
    tenantId: createCanonicalId("tenant"),
    idempotencyKey: "turn:123:extract:v1",
    scope: {
      kind: "relationship",
      relationshipId: createCanonicalId("relationship"),
    } as const,
    source: {
      kind: "message" as const,
      reference: "message:123",
      contentHash: "a".repeat(64),
    },
    extractor: {
      key: "default-facts",
      version: "1",
    },
    maxAttempts: 3,
    availableAt: toInstant("2026-10-02T05:50:00Z"),
  } as const;
}

describe("memory extraction custody contracts", () => {
  it("normalizes an explicit scoped extraction request without source text", () => {
    const input = request();
    const normalized = normalizeMemoryExtractionRequest(input);

    expect(normalized.scope).toEqual(input.scope);
    expect(normalized.source).toEqual(input.source);
    expect(Object.keys(normalized.source).sort()).toEqual([
      "contentHash",
      "kind",
      "reference",
    ]);
  });

  it("fingerprints scope, source, extractor, attempts and schedule", () => {
    const input = request();
    const fingerprint = memoryExtractionRequestFingerprint(input);

    expect(fingerprint).toHaveLength(64);
    expect(
      memoryExtractionRequestFingerprint({
        ...input,
        source: {
          ...input.source,
          contentHash: "b".repeat(64),
        },
      }),
    ).not.toBe(fingerprint);
    expect(
      memoryExtractionRequestFingerprint({
        ...input,
        maxAttempts: 4,
      }),
    ).not.toBe(fingerprint);
  });

  it("rejects invalid hashes and unbounded retry policy", () => {
    const input = request();

    expect(() =>
      normalizeMemoryExtractionRequest({
        ...input,
        source: { ...input.source, contentHash: "not-sha256" },
      }),
    ).toThrow(/SHA-256/u);

    expect(() =>
      normalizeMemoryExtractionRequest({
        ...input,
        maxAttempts: 21,
      }),
    ).toThrow(/maxAttempts/u);
  });
});

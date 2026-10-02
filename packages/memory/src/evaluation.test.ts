import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertZeroMemoryRetrievalLeakage,
  evaluateMemoryRetrieval,
} from "./evaluation.js";

describe("memory retrieval evaluation", () => {
  it("reports recall separately from privacy leakage", () => {
    const expectedA = createCanonicalId("memory-record");
    const expectedB = createCanonicalId("memory-record");
    const forbidden = createCanonicalId("memory-record");

    const summary = evaluateMemoryRetrieval({
      name: "held-out relationship isolation",
      partition: "held-out",
      cases: [
        {
          caseId: "alpha",
          expectedRecordIds: [expectedA],
          forbiddenRecordIds: [forbidden],
          retrievedRecordIds: [expectedA],
        },
        {
          caseId: "beta",
          expectedRecordIds: [expectedB],
          forbiddenRecordIds: [forbidden],
          retrievedRecordIds: [],
        },
      ],
    });

    expect(summary.recall).toBe(0.5);
    expect(summary.precision).toBe(1);
    expect(summary.meanReciprocalRank).toBe(0.5);
    expect(summary.forbiddenHitCount).toBe(0);
    expect(summary.privacyPass).toBe(true);
    expect(() => assertZeroMemoryRetrievalLeakage(summary)).not.toThrow();
  });

  it("fails the privacy gate even when the expected record is also retrieved", () => {
    const expected = createCanonicalId("memory-record");
    const forbidden = createCanonicalId("memory-record");

    const summary = evaluateMemoryRetrieval({
      name: "leak fixture",
      partition: "held-out",
      cases: [
        {
          caseId: "leak",
          expectedRecordIds: [expected],
          forbiddenRecordIds: [forbidden],
          retrievedRecordIds: [expected, forbidden],
        },
      ],
    });

    expect(summary.recall).toBe(1);
    expect(summary.privacyPass).toBe(false);
    expect(() => assertZeroMemoryRetrievalLeakage(summary)).toThrow(
      expect.objectContaining({
        code: "memory.evaluation_privacy_leakage",
      }),
    );
  });
});

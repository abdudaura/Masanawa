import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createWorkflowUsageEvidence,
  totalWorkflowUsage,
  workflowUsageFingerprint,
} from "./index.js";

function evidence(overrides = {}) {
  return {
    usageEventId: createCanonicalId("event"),
    tenantId: createCanonicalId("tenant"),
    workflowRunId: createCanonicalId("workflow-run"),
    taskId: createCanonicalId("task"),
    operationId: createCanonicalId("operation"),
    providerId: createCanonicalId("provider"),
    category: "inference" as const,
    providerKey: "gemini",
    modelKey: "gemini-flash",
    inputUnits: 100,
    outputUnits: 20,
    costMicros: 250,
    latencyMs: 800,
    evidenceKey: "provider:response:abc123",
    occurredAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
    ...overrides,
  };
}

describe("Workflow usage evidence", () => {
  it("normalizes immutable bounded usage evidence", () => {
    const record = createWorkflowUsageEvidence(evidence());
    expect(Object.isFrozen(record)).toBe(true);
    expect(record).toMatchObject({
      category: "inference",
      inputUnits: 100,
      outputUnits: 20,
      costMicros: 250,
      latencyMs: 800,
    });
  });

  it("fingerprints the exact usage identity and measured values", () => {
    const input = evidence();
    expect(workflowUsageFingerprint(input)).toBe(
      workflowUsageFingerprint({ ...input }),
    );
    expect(workflowUsageFingerprint(input)).toMatch(/^[a-f0-9]{64}$/u);

    expect(
      workflowUsageFingerprint({ ...input, costMicros: 251 }),
    ).not.toBe(workflowUsageFingerprint(input));
  });

  it("aggregates integer workflow usage totals", () => {
    const first = evidence();
    const second = evidence({
      usageEventId: createCanonicalId("event"),
      inputUnits: 10,
      outputUnits: 5,
      costMicros: 50,
      latencyMs: 100,
    });

    expect(totalWorkflowUsage([first, second])).toEqual({
      recordCount: 2,
      inputUnits: 110,
      outputUnits: 25,
      costMicros: 300,
      latencyMs: 900,
    });
  });

  it("rejects negative, non-integer and malformed values", () => {
    expect(() =>
      createWorkflowUsageEvidence(evidence({ costMicros: -1 })),
    ).toThrow(/costMicros/u);

    expect(() =>
      createWorkflowUsageEvidence(evidence({ latencyMs: 1.5 })),
    ).toThrow(/latencyMs/u);

    expect(() =>
      createWorkflowUsageEvidence(evidence({ category: "secret" as never })),
    ).toThrow(/category/u);

    expect(() =>
      createWorkflowUsageEvidence(evidence({ evidenceKey: "contains spaces" })),
    ).toThrow(/evidenceKey/u);
  });

  it("rejects aggregate overflow", () => {
    const large = evidence({
      inputUnits: Number.MAX_SAFE_INTEGER,
      outputUnits: 0,
      costMicros: 0,
      latencyMs: 0,
    });
    const one = evidence({
      usageEventId: createCanonicalId("event"),
      inputUnits: 1,
      outputUnits: 0,
      costMicros: 0,
      latencyMs: 0,
    });

    expect(() => totalWorkflowUsage([large, one])).toThrow(/safe integer/u);
  });
});

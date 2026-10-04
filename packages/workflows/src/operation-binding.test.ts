import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createWorkflowOperationBinding,
  projectWorkflowOperationTruth,
} from "./index.js";

describe("workflow operation binding", () => {
  it("creates immutable exact Task/Operation bindings", () => {
    const binding = createWorkflowOperationBinding({
      tenantId: createCanonicalId("tenant"),
      taskId: createCanonicalId("task"),
      workflowRunId: createCanonicalId("workflow-run"),
      workflowVersionId: createCanonicalId("workflow-version"),
      graphSignature: `sha256:${"a".repeat(64)}`,
      role: "primary",
      operationId: createCanonicalId("operation"),
      boundAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
    });
    expect(Object.isFrozen(binding)).toBe(true);
    expect(binding.role).toBe("primary");
  });

  it("projects terminal Operation truth deterministically", () => {
    const operationId = createCanonicalId("operation");
    expect(
      projectWorkflowOperationTruth({
        operationId,
        operationState: "succeeded",
        reconciliationStatus: null,
        receiptIds: [],
      }).disposition,
    ).toBe("succeeded");

    expect(
      projectWorkflowOperationTruth({
        operationId,
        operationState: "failed",
        reconciliationStatus: null,
        receiptIds: [],
      }).disposition,
    ).toBe("failed");
  });

  it("never treats ambiguous Operation states as success", () => {
    const operationId = createCanonicalId("operation");
    for (const state of ["partial", "unknown", "reconciling"] as const) {
      expect(
        projectWorkflowOperationTruth({
          operationId,
          operationState: state,
          reconciliationStatus: null,
          receiptIds: [],
        }).disposition,
      ).toBe("reconciliation-required");
    }
  });

  it("lets active reconciliation override otherwise terminal-looking projection", () => {
    const operationId = createCanonicalId("operation");
    expect(
      projectWorkflowOperationTruth({
        operationId,
        operationState: "succeeded",
        reconciliationStatus: "needs-attention",
        receiptIds: [],
      }).disposition,
    ).toBe("needs-attention");
  });

  it("deduplicates receipt references without copying receipt payloads", () => {
    const operationId = createCanonicalId("operation");
    const receipt = createCanonicalId("external-receipt");
    const projection = projectWorkflowOperationTruth({
      operationId,
      operationState: "accepted",
      reconciliationStatus: null,
      receiptIds: [receipt, receipt],
    });
    expect(projection).toEqual({
      operationId,
      disposition: "pending",
      receiptIds: [receipt],
    });
  });
});

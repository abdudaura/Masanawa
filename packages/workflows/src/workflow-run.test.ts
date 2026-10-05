import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import {
  assertWorkflowRunTransition,
  normalizeWorkflowCheckpoint,
  normalizeWorkflowRun,
  type WorkflowRun,
} from "./workflow-run.js";

function run(state: WorkflowRun["state"] = "queued"): WorkflowRun {
  const at = nowInstant();
  const terminal = ["completed", "failed", "cancelled"].includes(state);
  return {
    schemaVersion: 1,
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
    workflowRunId: createCanonicalId("workflow-run"),
    workflowVersionId: createCanonicalId("workflow-version"),
    taskId: createCanonicalId("task"),
    state,
    revision: 1,
    checkpointRevision: 0,
    pendingApprovalIds:
      state === "waiting_approval" ? [createCanonicalId("approval")] : [],
    createdAt: at,
    updatedAt: at,
    completedAt: terminal ? at : null,
    failureCode: state === "failed" ? "workflow.failed" : null,
  };
}

describe("WorkflowRun lifecycle", () => {
  it("normalizes run and approval waiting state", () => {
    const value = normalizeWorkflowRun(run("waiting_approval"));
    expect(value.state).toBe("waiting_approval");
    expect(value.pendingApprovalIds).toHaveLength(1);
  });

  it("prevents terminal workflow restart", () => {
    expect(() => assertWorkflowRunTransition("queued", "running")).not.toThrow();
    expect(() =>
      assertWorkflowRunTransition("running", "waiting_approval"),
    ).not.toThrow();
    expect(() =>
      assertWorkflowRunTransition("completed", "running"),
    ).toThrowError(/cannot transition/u);
  });

  it("requires pending approvals only while waiting for approval", () => {
    expect(() =>
      normalizeWorkflowRun({
        ...run("running"),
        pendingApprovalIds: [createCanonicalId("approval")],
      }),
    ).toThrowError(/lifecycle/u);

    expect(() =>
      normalizeWorkflowRun({
        ...run("waiting_approval"),
        pendingApprovalIds: [],
      }),
    ).toThrowError(/lifecycle/u);
  });

  it("normalizes bounded JSON checkpoint state", () => {
    const checkpoint = normalizeWorkflowCheckpoint({
      schemaVersion: 1,
      workflowRunId: createCanonicalId("workflow-run"),
      checkpointRevision: 1,
      graphSignature: "sha256:abc123",
      committedState: { selectedPlan: "basic", total: 2 },
      executorState: { currentNode: "compare" },
      edgeState: { completed: ["start"] },
      pendingApprovalIds: [],
      createdAt: nowInstant(),
    });
    expect(checkpoint.committedState.selectedPlan).toBe("basic");
    expect(Object.isFrozen(checkpoint.committedState)).toBe(true);
  });

  it("rejects non-JSON and over-deep checkpoint state", () => {
    expect(() =>
      normalizeWorkflowCheckpoint({
        schemaVersion: 1,
        workflowRunId: createCanonicalId("workflow-run"),
        checkpointRevision: 1,
        graphSignature: "graph-v1",
        committedState: { invalid: (() => "no") as never },
        executorState: {},
        edgeState: {},
        pendingApprovalIds: [],
        createdAt: nowInstant(),
      }),
    ).toThrowError(/non-JSON/u);

    let nested: unknown = "leaf";
    for (let i = 0; i < 18; i += 1) nested = { child: nested };
    expect(() =>
      normalizeWorkflowCheckpoint({
        schemaVersion: 1,
        workflowRunId: createCanonicalId("workflow-run"),
        checkpointRevision: 1,
        graphSignature: "graph-v1",
        committedState: nested as Record<string, never>,
        executorState: {},
        edgeState: {},
        pendingApprovalIds: [],
        createdAt: nowInstant(),
      }),
    ).toThrowError(/bound/u);
  });
});

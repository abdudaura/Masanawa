import { describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant, toInstant } from "@masanawa/contracts";
import { canTransitionWork, normalizeTask, normalizeWorkflowRun, type WorkScope } from "./model.js";

const makeScope = (): WorkScope => ({
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  characterId: createCanonicalId("character"),
  relationshipId: createCanonicalId("relationship"),
});

describe("workflow Work model", () => {
  it("normalizes active Task data", () => {
    const at = nowInstant();
    const task = normalizeTask({
      schemaVersion: 1,
      ...makeScope(),
      taskId: createCanonicalId("task"),
      title: "  Compare   solar options  ",
      state: "running",
      workflowRunId: null,
      activeAgentRunId: createCanonicalId("agent-run"),
      revision: 1,
      createdAt: at,
      updatedAt: at,
      completedAt: null,
      failureCode: null,
    });
    expect(task.title).toBe("Compare solar options");
    expect(task.state).toBe("running");
    expect(Object.isFrozen(task)).toBe(true);
  });

  it("requires failure metadata for a failed Task", () => {
    const createdAt = nowInstant();
    const completedAt = toInstant(new Date(Date.now() + 1));
    expect(() => normalizeTask({
      schemaVersion: 1,
      ...makeScope(),
      taskId: createCanonicalId("task"),
      title: "Research",
      state: "failed",
      workflowRunId: null,
      activeAgentRunId: null,
      revision: 2,
      createdAt,
      updatedAt: completedAt,
      completedAt,
      failureCode: null,
    })).toThrow();
  });

  it("normalizes WorkflowRun checkpoint references", () => {
    const at = nowInstant();
    const taskId = createCanonicalId("task");
    const run = normalizeWorkflowRun({
      schemaVersion: 1,
      ...makeScope(),
      workflowRunId: createCanonicalId("workflow-run"),
      workflowVersionId: createCanonicalId("workflow-version"),
      taskId,
      state: "waiting_approval",
      checkpointRevision: 3,
      activeAgentRunId: null,
      revision: 4,
      createdAt: at,
      updatedAt: at,
      completedAt: null,
      failureCode: null,
    });
    expect(run.taskId).toBe(taskId);
    expect(run.checkpointRevision).toBe(3);
  });

  it("keeps terminal Work terminal", () => {
    expect(canTransitionWork("running", "waiting_external")).toBe(true);
    expect(canTransitionWork("waiting_external", "completed")).toBe(true);
    expect(canTransitionWork("completed", "running")).toBe(false);
    expect(canTransitionWork("running", "queued")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
  toInstant,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { assertTaskAccess, normalizeTask, assertTaskTransition, type Task } from "./task.js";

function task(state: Task["state"] = "queued"): Task {
  const at = nowInstant();
  const terminal = ["completed", "failed", "cancelled"].includes(state);
  return {
    schemaVersion: 1,
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
    taskId: createCanonicalId("task"),
    title: "Compare solar options",
    state,
    workflowRunId: null,
    revision: 1,
    createdAt: at,
    updatedAt: at,
    completedAt: terminal ? at : null,
    failureCode: state === "failed" ? "work.failed" : null,
  };
}

describe("Task lifecycle", () => {
  it("normalizes canonical task state", () => {
    const value = normalizeTask(task());
    expect(value.state).toBe("queued");
    expect(value.title).toBe("Compare solar options");
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("allows bounded progress transitions and rejects terminal restart", () => {
    expect(() => assertTaskTransition("queued", "running")).not.toThrow();
    expect(() => assertTaskTransition("running", "waiting_external")).not.toThrow();
    expect(() => assertTaskTransition("waiting_external", "completed")).not.toThrow();
    expect(() => assertTaskTransition("completed", "running")).toThrowError(
      /cannot transition/u,
    );
  });

  it("requires a terminal timestamp and failure code consistency", () => {
    const badCompleted = {
      ...task("completed"),
      completedAt: null,
    };
    expect(() => normalizeTask(badCompleted)).toThrowError(/lifecycle/u);

    const badRunning = {
      ...task("running"),
      failureCode: "work.failed",
    };
    expect(() => normalizeTask(badRunning)).toThrowError(/lifecycle/u);
  });

  it("uses relationship scope by default and optional task IDs as a narrowing filter", () => {
    const value = task("running");
    const base = createAuthorityContext({
      tenantId: value.tenantId,
      principal: { kind: "user", userId: value.userId },
      scopes: ["workflows"],
      capabilities: ["workflows.task.read"],
      resourceScope: { relationshipIds: [value.relationshipId] },
      policyRevision: "test",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: value.createdAt,
    });

    expect(() =>
      assertTaskAccess(base, value, "read", value.createdAt),
    ).not.toThrow();

    const denied = {
      ...base,
      resourceScope: {
        ...base.resourceScope,
        taskIds: [createCanonicalId("task")],
      },
    };
    expect(() =>
      assertTaskAccess(denied, value, "read", value.createdAt),
    ).toThrowError(/does not allow/u);
  });

  it("rejects invalid canonical references", () => {
    expect(() =>
      normalizeTask({
        ...task(),
        taskId: "task_not-a-uuid" as Task["taskId"],
      }),
    ).toThrowError(/RFC 9562/u);
  });
});

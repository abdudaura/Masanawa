import { describe, expect, it, vi } from "vitest";
import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowResumeDisposition,
  WorkflowRunScope,
} from "@masanawa/workflows";
import { createAgentHarnessResumeCoordinator } from "./agent_harness_resume.js";

const authority = {} as AuthorityContext;
const scope = {} as WorkflowRunScope;
const workflowRunId = "workflow-run_00000000-0000-4000-8000-000000000005" as never;

function disposition(kind: WorkflowResumeDisposition["kind"]): WorkflowResumeDisposition {
  const run = { workflowRunId } as never;
  const checkpoint = { workflowRunId } as never;
  switch (kind) {
    case "execute":
      return { kind, run, checkpoint, resumeFrom: "checkpoint" };
    case "waiting-approval":
      return { kind, run, checkpoint, approvalIds: [] };
    case "reconcile-external":
      return { kind, run, checkpoint };
    case "blocked":
      return { kind, run, reason: "running-without-checkpoint" };
    case "terminal":
      return { kind, run };
  }
}

describe("agent harness durable Work resume coordinator", () => {
  it("executes only execute dispositions", async () => {
    const execute = vi.fn(async () => undefined);
    const reconcileExternal = vi.fn(async () => undefined);
    const coordinator = createAgentHarnessResumeCoordinator({
      resume: { async inspect() { return disposition("execute"); } },
      executor: { execute },
      reconciler: { reconcileExternal },
    });
    await expect(coordinator.resumeWork({ authority, scope, workflowRunId }))
      .resolves.toBe("executed");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(reconcileExternal).not.toHaveBeenCalled();
  });

  it("routes waiting_external to reconciliation and never the executor", async () => {
    const execute = vi.fn(async () => undefined);
    const reconcileExternal = vi.fn(async () => undefined);
    const coordinator = createAgentHarnessResumeCoordinator({
      resume: { async inspect() { return disposition("reconcile-external"); } },
      executor: { execute },
      reconciler: { reconcileExternal },
    });
    await expect(coordinator.resumeWork({ authority, scope, workflowRunId }))
      .resolves.toBe("reconciliation-requested");
    expect(execute).not.toHaveBeenCalled();
    expect(reconcileExternal).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["waiting-approval", "waiting-approval"],
    ["blocked", "blocked"],
    ["terminal", "terminal"],
  ] as const)("does not execute %s disposition", async (kind, outcome) => {
    const execute = vi.fn(async () => undefined);
    const reconcileExternal = vi.fn(async () => undefined);
    const coordinator = createAgentHarnessResumeCoordinator({
      resume: { async inspect() { return disposition(kind); } },
      executor: { execute },
      reconciler: { reconcileExternal },
    });
    await expect(coordinator.resumeWork({ authority, scope, workflowRunId }))
      .resolves.toBe(outcome);
    expect(execute).not.toHaveBeenCalled();
    expect(reconcileExternal).not.toHaveBeenCalled();
  });
});

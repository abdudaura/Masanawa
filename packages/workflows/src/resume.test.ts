import { describe, expect, it, vi } from "vitest";
import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowRunRepository,
} from "./workflow-run.js";
import {
  createWorkflowResumeService,
  type WorkflowApprovalResolver,
  type WorkflowGraphResolver,
} from "./resume.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;
const relationshipId = "relationship_00000000-0000-4000-8000-000000000004" as never;
const workflowRunId = "workflow-run_00000000-0000-4000-8000-000000000005" as never;
const workflowVersionId = "workflow-version_00000000-0000-4000-8000-000000000006" as never;
const approvalId = "approval_00000000-0000-4000-8000-000000000007" as never;
const at = "2026-10-05T10:00:00.000Z" as never;

const authority = {
  tenantId,
  principal: { kind: "user", userId },
  capabilities: ["workflows.run.read", "workflows.run.update", "workflows.run.checkpoint"],
  resourceScope: { relationshipIds: [relationshipId], workflowRunIds: [workflowRunId] },
  issuedAt: "2026-10-05T09:00:00.000Z",
  expiresAt: "2026-10-05T11:00:00.000Z",
} as unknown as AuthorityContext;

function run(
  state: WorkflowRun["state"],
  options: {
    checkpointRevision?: number;
    pendingApprovalIds?: readonly typeof approvalId[];
    revision?: number;
  } = {},
): WorkflowRun {
  return {
    schemaVersion: 1,
    tenantId,
    userId,
    characterId,
    relationshipId,
    workflowRunId,
    workflowVersionId,
    taskId: null,
    state,
    revision: options.revision ?? 2,
    checkpointRevision: options.checkpointRevision ?? 1,
    pendingApprovalIds:
      options.pendingApprovalIds ??
      (state === "waiting_approval" ? [approvalId] : []),
    createdAt: "2026-10-05T08:00:00.000Z" as never,
    updatedAt: "2026-10-05T09:30:00.000Z" as never,
    completedAt:
      state === "completed" || state === "failed" || state === "cancelled"
        ? "2026-10-05T09:30:00.000Z" as never
        : null,
    failureCode: state === "failed" ? "work.failed" : null,
  };
}

function checkpoint(pendingApprovalIds: readonly typeof approvalId[] = []): WorkflowCheckpoint {
  return {
    schemaVersion: 1,
    workflowRunId,
    checkpointRevision: 1,
    graphSignature: "graph:v1:abc",
    committedState: { step: 2 },
    executorState: { cursor: "b" },
    edgeState: {},
    pendingApprovalIds,
    createdAt: "2026-10-05T09:29:00.000Z" as never,
  };
}

function harness(input: {
  current: WorkflowRun;
  checkpoint: WorkflowCheckpoint | null;
  approvalsSatisfied?: boolean;
  graphSignature?: string;
}) {
  let current = input.current;
  const transition = vi.fn(async (request: Parameters<WorkflowRunRepository["transition"]>[0]) => {
    current = {
      ...current,
      state: request.to,
      revision: current.revision + 1,
      pendingApprovalIds: request.pendingApprovalIds ?? [],
      updatedAt: at,
    } as WorkflowRun;
    return current;
  });
  const runs = {
    async read() { return current; },
    async readLatestCheckpoint() { return input.checkpoint; },
    transition,
  } as unknown as WorkflowRunRepository;
  const graphs: WorkflowGraphResolver = {
    async resolve() {
      return {
        workflowVersionId,
        graphSignature: input.graphSignature ?? "graph:v1:abc",
      };
    },
  };
  const approvals: WorkflowApprovalResolver = {
    async areSatisfied() { return input.approvalsSatisfied ?? false; },
  };
  return {
    transition,
    service: createWorkflowResumeService({
      runs,
      graphs,
      approvals,
      clock: { now: () => at },
    }),
  };
}

const scope = { tenantId, userId, characterId, relationshipId };

describe("workflow resume service", () => {
  it("starts queued Work with current authority", async () => {
    const { service, transition } = harness({
      current: run("queued", { checkpointRevision: 0 }),
      checkpoint: null,
    });
    const result = await service.inspect({ authority, scope, workflowRunId });
    expect(result.kind).toBe("execute");
    if (result.kind === "execute") expect(result.resumeFrom).toBe("start");
    expect(transition).toHaveBeenCalledTimes(1);
  });

  it("resumes running Work only from an exact durable checkpoint", async () => {
    const { service } = harness({
      current: run("running"),
      checkpoint: checkpoint(),
    });
    const result = await service.inspect({ authority, scope, workflowRunId });
    expect(result.kind).toBe("execute");
    if (result.kind === "execute") expect(result.resumeFrom).toBe("checkpoint");
  });

  it("blocks a running record that has no checkpoint instead of replaying from the start", async () => {
    const { service } = harness({
      current: run("running", { checkpointRevision: 0 }),
      checkpoint: null,
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .resolves.toMatchObject({ kind: "blocked", reason: "running-without-checkpoint" });
  });

  it("keeps approval-waiting Work paused until approvals are freshly satisfied", async () => {
    const current = run("waiting_approval", { pendingApprovalIds: [approvalId] });
    const cp = checkpoint([approvalId]);
    const waiting = harness({ current, checkpoint: cp, approvalsSatisfied: false });
    await expect(waiting.service.inspect({ authority, scope, workflowRunId }))
      .resolves.toMatchObject({ kind: "waiting-approval" });
    expect(waiting.transition).not.toHaveBeenCalled();

    const approved = harness({ current, checkpoint: cp, approvalsSatisfied: true });
    const result = await approved.service.inspect({ authority, scope, workflowRunId });
    expect(result.kind).toBe("execute");
    expect(approved.transition).toHaveBeenCalledWith(
      expect.objectContaining({ to: "running", pendingApprovalIds: [] }),
    );
  });

  it("never blindly resumes waiting_external Work", async () => {
    const { service, transition } = harness({
      current: run("waiting_external"),
      checkpoint: checkpoint(),
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .resolves.toMatchObject({ kind: "reconcile-external" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("never restarts terminal Work", async () => {
    const { service, transition } = harness({
      current: run("completed"),
      checkpoint: checkpoint(),
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .resolves.toMatchObject({ kind: "terminal" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("fails closed when the durable checkpoint does not match run custody", async () => {
    const { service } = harness({
      current: run("running", { checkpointRevision: 2 }),
      checkpoint: checkpoint(),
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .rejects.toThrow("same durable state");
  });

  it("fails closed when the current WorkflowVersion graph differs", async () => {
    const { service } = harness({
      current: run("running"),
      checkpoint: checkpoint(),
      graphSignature: "graph:v2:changed",
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .rejects.toThrow("different WorkflowVersion graph");
  });

  it("fails closed when run and checkpoint disagree on approvals", async () => {
    const { service } = harness({
      current: run("waiting_approval", { pendingApprovalIds: [approvalId] }),
      checkpoint: checkpoint([]),
    });
    await expect(service.inspect({ authority, scope, workflowRunId }))
      .rejects.toThrow("pending approvals");
  });
});

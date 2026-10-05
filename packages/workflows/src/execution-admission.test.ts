import { describe, expect, it, vi } from "vitest";
import type { WorkflowCheckpoint } from "./checkpoint-model.js";
import {
  createWorkflowExecutionAdmissionCoordinator,
  type CanonicalWorkflowTaskLease,
} from "./execution-admission.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as never;
const taskId =
  "task_00000000-0000-4000-8000-000000000002" as never;
const workflowRunId =
  "workflow-run_00000000-0000-4000-8000-000000000003" as never;
const workflowVersionId =
  "workflow-version_00000000-0000-4000-8000-000000000004" as never;
const graphSignature =
  ("sha256:" + "a".repeat(64)) as never;

function lease(
  overrides: Partial<CanonicalWorkflowTaskLease> = {},
): CanonicalWorkflowTaskLease {
  return {
    tenantId,
    taskId,
    workflowRunId,
    workflowVersionId,
    graphSignature,
    nodeKey: "research",
    state: "running",
    revision: 5,
    leaseOwner: "worker-a",
    leaseFence: 3,
    leaseExpiresAt: "2026-10-05T12:30:30.000Z" as never,
    ...overrides,
  };
}

function checkpoint(
  overrides: Partial<WorkflowCheckpoint> = {},
): WorkflowCheckpoint {
  return {
    schemaVersion: 1,
    tenantId,
    workflowRunId,
    workflowVersionId,
    graphSignature,
    sequence: 2,
    parentSequence: 1,
    workflowRunRevision: 4,
    payload: {
      runState: {},
      taskStates: {},
      executorStates: {},
      edgeStates: {},
      pendingRequestStates: {},
      iteration: 1,
      superstep: 1,
      evidenceRefs: [],
    },
    payloadFingerprint: "b".repeat(64),
    createdAt: "2026-10-05T12:29:00.000Z" as never,
    ...overrides,
  };
}

function harness(options: {
  cp?: WorkflowCheckpoint | null;
  external?: "safe" | "reconcile" | "blocked";
} = {}) {
  const assertCurrent = vi.fn(async () => undefined);
  const loadLatestCompatible = vi.fn(
    async () => options.cp === undefined ? null : options.cp,
  );
  const inspect = vi.fn(async () => {
    switch (options.external ?? "safe") {
      case "safe":
        return { kind: "safe" as const };
      case "reconcile":
        return {
          kind: "reconcile" as const,
          reason: "provider outcome is uncertain",
        };
      case "blocked":
        return {
          kind: "blocked" as const,
          reason: "operation is not ready",
        };
    }
  });

  return {
    assertCurrent,
    loadLatestCompatible,
    inspect,
    coordinator: createWorkflowExecutionAdmissionCoordinator({
      authority: { assertCurrent },
      checkpoints: { loadLatestCompatible },
      externalOutcomes: { inspect },
      clock: {
        now: () => "2026-10-05T12:29:30.000Z" as never,
      },
    }),
  };
}

describe("canonical Workflow Harness execution admission", () => {
  it("admits a current lease with no checkpoint from start", async () => {
    const h = harness();
    const result = await h.coordinator.inspect(lease());
    expect(result).toMatchObject({
      kind: "execute",
      resumeFrom: "start",
    });
    expect(h.assertCurrent).toHaveBeenCalledTimes(1);
    expect(h.inspect).toHaveBeenCalledTimes(1);
  });

  it("resumes only from an exact compatible checkpoint", async () => {
    const cp = checkpoint();
    const h = harness({ cp });
    const result = await h.coordinator.inspect(lease());
    expect(result.kind).toBe("execute");
    if (result.kind === "execute") {
      expect(result.resumeFrom).toBe("checkpoint");
      expect(result.checkpoint).toBe(cp);
    }
  });

  it("blocks expired leases before authority or external work", async () => {
    const h = harness();
    const result = await h.coordinator.inspect(
      lease({
        leaseExpiresAt: "2026-10-05T12:29:30.000Z" as never,
      }),
    );
    expect(result).toMatchObject({
      kind: "blocked",
      reason: "lease-expired",
    });
    expect(h.assertCurrent).not.toHaveBeenCalled();
    expect(h.inspect).not.toHaveBeenCalled();
  });

  it("routes uncertain external outcomes to reconciliation", async () => {
    const h = harness({ external: "reconcile" });
    const result = await h.coordinator.inspect(lease());
    expect(result).toMatchObject({
      kind: "reconcile",
      reason: "provider outcome is uncertain",
    });
  });

  it("blocks externally unsafe work without redispatch", async () => {
    const h = harness({ external: "blocked" });
    const result = await h.coordinator.inspect(lease());
    expect(result).toMatchObject({
      kind: "blocked",
      reason: "external-block",
      detail: "operation is not ready",
    });
  });

  it("rejects a checkpoint from another Run or graph", async () => {
    const h = harness({
      cp: checkpoint({
        workflowRunId:
          "workflow-run_00000000-0000-4000-8000-000000000999" as never,
      }),
    });
    await expect(h.coordinator.inspect(lease())).rejects.toMatchObject({
      code: "workflows.execution_checkpoint_incompatible",
    });
  });

  it("requires current authority before checkpoint/external inspection", async () => {
    const loadLatestCompatible = vi.fn(async () => null);
    const externalInspect = vi.fn(async () => ({ kind: "safe" as const }));
    const coordinator = createWorkflowExecutionAdmissionCoordinator({
      authority: {
        async assertCurrent() {
          throw new Error("authority revoked");
        },
      },
      checkpoints: { loadLatestCompatible },
      externalOutcomes: { inspect: externalInspect },
      clock: {
        now: () => "2026-10-05T12:29:30.000Z" as never,
      },
    });

    await expect(coordinator.inspect(lease())).rejects.toThrow(
      "authority revoked",
    );
    expect(loadLatestCompatible).not.toHaveBeenCalled();
    expect(externalInspect).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowExecutorLease,
  WorkflowExecutorLeaseRepository,
  WorkflowResumeDisposition,
  WorkflowRun,
  WorkflowRunScope,
} from "./index.js";
import { createWorkflowExecutionSessionCoordinator } from "./executor-session.js";

const authority = {} as AuthorityContext;
const scope = {} as WorkflowRunScope;
const workflowRunId =
  "workflow-run_00000000-0000-4000-8000-000000000001" as never;
const tenantId =
  "tenant_00000000-0000-4000-8000-000000000002" as never;
const at = "2026-10-05T10:00:00.000Z" as never;

function run(state: WorkflowRun["state"] = "running"): WorkflowRun {
  return {
    tenantId,
    workflowRunId,
    state,
  } as WorkflowRun;
}

function lease(): WorkflowExecutorLease {
  return {
    schemaVersion: 1,
    tenantId,
    workflowRunId,
    holderId: "worker-a",
    fence: 3,
    state: "held",
    acquiredAt: at,
    renewedAt: at,
    expiresAt: "2026-10-05T10:00:30.000Z" as never,
    releasedAt: null,
  };
}

function harness(disposition: WorkflowResumeDisposition) {
  const acquire = vi.fn(async () => lease());
  const renew = vi.fn(async () => ({
    ...lease(),
    renewedAt: "2026-10-05T10:00:10.000Z" as never,
    expiresAt: "2026-10-05T10:00:40.000Z" as never,
  }));
  const release = vi.fn(async () => ({
    ...lease(),
    state: "released" as const,
    releasedAt: "2026-10-05T10:00:20.000Z" as never,
  }));
  const leases = {
    acquire,
    renew,
    release,
    async read() { return lease(); },
  } as unknown as WorkflowExecutorLeaseRepository;

  return {
    acquire,
    renew,
    release,
    coordinator: createWorkflowExecutionSessionCoordinator({
      resume: { async inspect() { return disposition; } },
      leases,
      clock: { now: () => at },
      leaseDurationMs: 30_000,
    }),
  };
}

describe("Workflow execution session coordinator", () => {
  it("acquires a durable lease only for executable resume dispositions", async () => {
    const disposition: WorkflowResumeDisposition = {
      kind: "execute",
      run: run(),
      checkpoint: null,
      resumeFrom: "start",
    };
    const { coordinator, acquire } = harness(disposition);
    const result = await coordinator.open({
      authority,
      scope,
      workflowRunId,
      holderId: "worker-a",
    });
    expect(result.kind).toBe("execute-session");
    if (result.kind === "execute-session") {
      expect(result.run).toBe(disposition.run);
      expect(result.checkpoint).toBeNull();
      expect(result.resumeFrom).toBe("start");
      expect(result.lease.fence).toBe(3);
    }
    expect(acquire).toHaveBeenCalledTimes(1);
  });

  it.each([
    { kind: "waiting-approval", run: run("waiting_approval"), checkpoint: {} as never, approvalIds: [] },
    { kind: "reconcile-external", run: run("waiting_external"), checkpoint: {} as never },
    { kind: "blocked", run: run(), reason: "running-without-checkpoint" },
    { kind: "terminal", run: run("completed") },
  ] as const)("does not lease non-executable $kind Work", async (disposition) => {
    const { coordinator, acquire } = harness(
      disposition as WorkflowResumeDisposition,
    );
    const result = await coordinator.open({
      authority,
      scope,
      workflowRunId,
      holderId: "worker-a",
    });
    expect(result.kind).toBe(disposition.kind);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("renews and releases the exact session fence", async () => {
    const { coordinator, renew, release } = harness({
      kind: "execute",
      run: run(),
      checkpoint: null,
      resumeFrom: "start",
    });
    const current = lease();
    await coordinator.renew({ lease: current });
    await coordinator.close({ lease: current });

    expect(renew).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        fence: 3,
      }),
    );
    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        fence: 3,
      }),
    );
  });

  it("fails construction for an unsafe lease duration", () => {
    expect(() =>
      createWorkflowExecutionSessionCoordinator({
        resume: { async inspect() { return { kind: "terminal", run: run("completed") }; } },
        leases: {} as WorkflowExecutorLeaseRepository,
        clock: { now: () => at },
        leaseDurationMs: 999,
      }),
    ).toThrow("lease duration");
  });

  it("surfaces lease loss instead of hiding it", async () => {
    const coordinator = createWorkflowExecutionSessionCoordinator({
      resume: {
        async inspect() {
          return {
            kind: "execute",
            run: run(),
            checkpoint: null,
            resumeFrom: "start",
          };
        },
      },
      leases: {
        async renew() {
          throw new Error("fenced");
        },
      } as unknown as WorkflowExecutorLeaseRepository,
      clock: { now: () => at },
      leaseDurationMs: 30_000,
    });

    await expect(coordinator.renew({ lease: lease() })).rejects.toThrow("fenced");
  });
});

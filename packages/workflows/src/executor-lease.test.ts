import { describe, expect, it } from "vitest";
import {
  assertWorkflowExecutorLeaseHeld,
  assertWorkflowExecutorLeaseRelease,
  planWorkflowExecutorLeaseAcquire,
  planWorkflowExecutorLeaseRenew,
} from "./executor-lease.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const workflowRunId =
  "workflow-run_00000000-0000-4000-8000-000000000002" as never;
const t0 = "2026-10-05T10:00:00.000Z" as never;

describe("WorkflowRun executor leases", () => {
  it("acquires the first lease with fence 1", () => {
    const lease = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "queued",
      now: t0,
      durationMs: 30_000,
    });
    expect(lease.holderId).toBe("worker-a");
    expect(lease.fence).toBe(1);
    expect(lease.expiresAt).toBe("2026-10-05T10:00:30.000Z");
  });

  it("makes same-holder reacquire idempotent while active", () => {
    const first = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 30_000,
    });
    const replay = planWorkflowExecutorLeaseAcquire({
      current: first,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: "2026-10-05T10:00:10.000Z" as never,
      durationMs: 60_000,
    });
    expect(replay).toEqual(first);
  });

  it("rejects a competing holder until expiry", () => {
    const first = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 30_000,
    });
    expect(() =>
      planWorkflowExecutorLeaseAcquire({
        current: first,
        tenantId,
        workflowRunId,
        holderId: "worker-b",
        runState: "running",
        now: "2026-10-05T10:00:29.999Z" as never,
        durationMs: 30_000,
      }),
    ).toThrow("another active executor");
  });

  it("replaces an expired holder with a strictly newer fence", () => {
    const first = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 30_000,
    });
    const second = planWorkflowExecutorLeaseAcquire({
      current: first,
      tenantId,
      workflowRunId,
      holderId: "worker-b",
      runState: "running",
      now: "2026-10-05T10:00:30.000Z" as never,
      durationMs: 30_000,
    });
    expect(second.holderId).toBe("worker-b");
    expect(second.fence).toBe(2);
  });

  it("renews only the exact current unexpired fence", () => {
    const lease = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 30_000,
    });
    const renewed = planWorkflowExecutorLeaseRenew({
      current: lease,
      holderId: "worker-a",
      fence: 1,
      now: "2026-10-05T10:00:20.000Z" as never,
      durationMs: 30_000,
    });
    expect(renewed.fence).toBe(1);
    expect(renewed.acquiredAt).toBe(t0);
    expect(renewed.expiresAt).toBe("2026-10-05T10:00:50.000Z");

    expect(() =>
      planWorkflowExecutorLeaseRenew({
        current: renewed,
        holderId: "worker-a",
        fence: 2,
        now: "2026-10-05T10:00:21.000Z" as never,
        durationMs: 30_000,
      }),
    ).toThrow("Stale executor");
  });

  it("requires the exact live fence before checkpoint/result commit", () => {
    const lease = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 30_000,
    });
    expect(() =>
      assertWorkflowExecutorLeaseHeld({
        lease,
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        fence: 1,
        at: "2026-10-05T10:00:29.999Z" as never,
      }),
    ).not.toThrow();

    expect(() =>
      assertWorkflowExecutorLeaseHeld({
        lease,
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        fence: 1,
        at: "2026-10-05T10:00:30.000Z" as never,
      }),
    ).toThrow("expired");

    expect(() =>
      assertWorkflowExecutorLeaseHeld({
        lease,
        tenantId,
        workflowRunId,
        holderId: "worker-b",
        fence: 1,
        at: "2026-10-05T10:00:10.000Z" as never,
      }),
    ).toThrow("current WorkflowRun fence");
  });

  it("prevents stale holders from releasing a newer lease", () => {
    const first = planWorkflowExecutorLeaseAcquire({
      current: null,
      tenantId,
      workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: t0,
      durationMs: 1_000,
    });
    const second = planWorkflowExecutorLeaseAcquire({
      current: first,
      tenantId,
      workflowRunId,
      holderId: "worker-b",
      runState: "running",
      now: "2026-10-05T10:00:01.000Z" as never,
      durationMs: 30_000,
    });
    expect(() =>
      assertWorkflowExecutorLeaseRelease({
        lease: second,
        holderId: "worker-a",
        fence: 1,
        at: "2026-10-05T10:00:02.000Z" as never,
      }),
    ).toThrow("Stale executor");
  });

  it.each(["completed", "failed", "cancelled"] as const)(
    "terminal %s Work cannot acquire execution",
    (runState) => {
      expect(() =>
        planWorkflowExecutorLeaseAcquire({
          current: null,
          tenantId,
          workflowRunId,
          holderId: "worker-a",
          runState,
          now: t0,
          durationMs: 30_000,
        }),
      ).toThrow("Terminal WorkflowRun");
    },
  );

  it("bounds lease duration", () => {
    expect(() =>
      planWorkflowExecutorLeaseAcquire({
        current: null,
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        runState: "running",
        now: t0,
        durationMs: 999,
      }),
    ).toThrow("duration");

    expect(() =>
      planWorkflowExecutorLeaseAcquire({
        current: null,
        tenantId,
        workflowRunId,
        holderId: "worker-a",
        runState: "running",
        now: t0,
        durationMs: 15 * 60_000 + 1,
      }),
    ).toThrow("duration");
  });
});

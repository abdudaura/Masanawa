import { describe, expect, it } from "vitest";
import type { WorkflowExecutorLease } from "./executor-lease.js";
import {
  createWorkflowExecutorHeartbeatPolicy,
  evaluateWorkflowExecutorHeartbeat,
} from "./executor-heartbeat.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as never;
const workflowRunId =
  "workflow-run_00000000-0000-4000-8000-000000000002" as never;

function lease(
  overrides: Partial<WorkflowExecutorLease> = {},
): WorkflowExecutorLease {
  return {
    schemaVersion: 1,
    tenantId,
    workflowRunId,
    holderId: "worker-a",
    fence: 1,
    state: "held",
    acquiredAt: "2026-10-05T10:00:00.000Z" as never,
    renewedAt: "2026-10-05T10:00:00.000Z" as never,
    expiresAt: "2026-10-05T10:00:30.000Z" as never,
    releasedAt: null,
    ...overrides,
  };
}

const policy = createWorkflowExecutorHeartbeatPolicy({
  renewAtFractionBps: 5_000,
  minimumSafetyMarginMs: 5_000,
});

describe("Workflow executor heartbeat policy", () => {
  it("returns healthy before renewal window and schedules a bounded next check", () => {
    const result = evaluateWorkflowExecutorHeartbeat({
      lease: lease(),
      now: "2026-10-05T10:00:05.000Z" as never,
      policy,
    });
    expect(result.kind).toBe("healthy");
    if (result.kind === "healthy") {
      expect(result.renewAt).toBe("2026-10-05T10:00:15.000Z");
      expect(result.nextCheckAt).toBe("2026-10-05T10:00:10.000Z");
      expect(result.nextCheckAt < result.expiresAt).toBe(true);
    }
  });

  it("returns renew-now at the deterministic renewal boundary", () => {
    const result = evaluateWorkflowExecutorHeartbeat({
      lease: lease(),
      now: "2026-10-05T10:00:15.000Z" as never,
      policy,
    });
    expect(result).toMatchObject({
      kind: "renew-now",
      renewAt: "2026-10-05T10:00:15.000Z",
    });
  });

  it("uses the safety margin when it requires earlier renewal", () => {
    const result = evaluateWorkflowExecutorHeartbeat({
      lease: lease({
        expiresAt: "2026-10-05T10:00:06.000Z" as never,
      }),
      now: "2026-10-05T10:00:01.000Z" as never,
      policy,
    });
    expect(result.kind).toBe("renew-now");
    if (result.kind === "renew-now") {
      expect(result.renewAt).toBe("2026-10-05T10:00:01.000Z");
    }
  });

  it("stops immediately for released and expired leases", () => {
    expect(
      evaluateWorkflowExecutorHeartbeat({
        lease: lease({
          state: "released",
          releasedAt: "2026-10-05T10:00:10.000Z" as never,
        }),
        now: "2026-10-05T10:00:11.000Z" as never,
        policy,
      }),
    ).toMatchObject({ kind: "stop", reason: "released" });

    expect(
      evaluateWorkflowExecutorHeartbeat({
        lease: lease(),
        now: "2026-10-05T10:00:30.000Z" as never,
        policy,
      }),
    ).toMatchObject({ kind: "stop", reason: "expired" });
  });

  it("rejects stale observation time", () => {
    expect(() =>
      evaluateWorkflowExecutorHeartbeat({
        lease: lease({
          renewedAt: "2026-10-05T10:00:10.000Z" as never,
          expiresAt: "2026-10-05T10:00:40.000Z" as never,
        }),
        now: "2026-10-05T10:00:09.999Z" as never,
        policy,
      }),
    ).toThrow("moved backwards");
  });

  it("rejects unsafe heartbeat policy bounds", () => {
    expect(() =>
      createWorkflowExecutorHeartbeatPolicy({
        renewAtFractionBps: 999,
        minimumSafetyMarginMs: 5_000,
      }),
    ).toThrow("renewAtFractionBps");

    expect(() =>
      createWorkflowExecutorHeartbeatPolicy({
        renewAtFractionBps: 5_000,
        minimumSafetyMarginMs: 99,
      }),
    ).toThrow("minimumSafetyMarginMs");
  });
});

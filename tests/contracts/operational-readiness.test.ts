import { describe, expect, it } from "vitest";
import {
  createOpsIncident,
  evaluateOperationalReadiness,
  transitionOpsIncident,
  type OperationalSloPolicy,
} from "../../services/ops/src/operational-readiness.js";

const policy: OperationalSloPolicy = {
  schemaVersion: 1,
  serviceKey: "gateway",
  availabilityObjectiveBasisPoints: 9_950,
  maxP95LatencyMs: 500,
  maxSignalAgeMinutes: 5,
  maxOpenReconciliationCases: 10,
  maxNeedsAttentionCases: 0,
  maxOldestReconciliationAgeMinutes: 30,
  runbookRef: "docs/runbooks/incident-reconciliation.md",
};

describe("Task 147 operational readiness", () => {
  it("passes a healthy service window with bounded reconciliation backlog", () => {
    expect(
      evaluateOperationalReadiness({
        policy,
        sample: {
          serviceKey: "gateway",
          observedAt: "2026-10-06T12:00:00Z",
          windowMinutes: 5,
          totalRequests: 10_000,
          failedRequests: 20,
          p95LatencyMs: 220,
          lastSignalAt: "2026-10-06T11:59:30Z",
          openReconciliationCases: 2,
          needsAttentionCases: 0,
          oldestActiveReconciliationAgeMinutes: 10,
        },
      }),
    ).toMatchObject({
      passed: true,
      availabilityBasisPoints: 9_980,
      alerts: [],
    });
  });

  it("raises availability and latency SLO alerts from measured evidence", () => {
    const result = evaluateOperationalReadiness({
      policy,
      sample: {
        serviceKey: "gateway",
        observedAt: "2026-10-06T12:00:00Z",
        windowMinutes: 5,
        totalRequests: 1_000,
        failedRequests: 20,
        p95LatencyMs: 900,
        lastSignalAt: "2026-10-06T11:59:30Z",
        openReconciliationCases: 0,
        needsAttentionCases: 0,
        oldestActiveReconciliationAgeMinutes: 0,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.alerts.map((alert) => alert.kind)).toEqual(
      expect.arrayContaining(["availability-slo", "latency-slo"]),
    );
  });

  it("treats missing telemetry signal as critical", () => {
    const result = evaluateOperationalReadiness({
      policy,
      sample: {
        serviceKey: "gateway",
        observedAt: "2026-10-06T12:00:00Z",
        windowMinutes: 5,
        totalRequests: 0,
        failedRequests: 0,
        p95LatencyMs: 0,
        lastSignalAt: "2026-10-06T11:50:00Z",
        openReconciliationCases: 0,
        needsAttentionCases: 0,
        oldestActiveReconciliationAgeMinutes: 0,
      },
    });

    expect(result).toMatchObject({
      passed: false,
      availabilityBasisPoints: null,
    });
    expect(result.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "no-signal",
          severity: "critical",
        }),
      ]),
    );
  });

  it("escalates reconciliation backlog, needs-attention and stale cases without mutating them", () => {
    const sample = {
      serviceKey: "gateway",
      observedAt: "2026-10-06T12:00:00Z",
      windowMinutes: 5,
      totalRequests: 100,
      failedRequests: 0,
      p95LatencyMs: 100,
      lastSignalAt: "2026-10-06T11:59:00Z",
      openReconciliationCases: 11,
      needsAttentionCases: 1,
      oldestActiveReconciliationAgeMinutes: 31,
    };
    const before = JSON.stringify(sample);

    const result = evaluateOperationalReadiness({ policy, sample });

    expect(result.alerts.map((alert) => alert.kind)).toEqual(
      expect.arrayContaining([
        "reconciliation-backlog",
        "reconciliation-needs-attention",
        "reconciliation-stale",
      ]),
    );
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("creates an incident tied to one runbook and requires explicit lifecycle progression", () => {
    const readiness = evaluateOperationalReadiness({
      policy,
      sample: {
        serviceKey: "gateway",
        observedAt: "2026-10-06T12:00:00Z",
        windowMinutes: 5,
        totalRequests: 1_000,
        failedRequests: 100,
        p95LatencyMs: 800,
        lastSignalAt: "2026-10-06T11:59:00Z",
        openReconciliationCases: 0,
        needsAttentionCases: 0,
        oldestActiveReconciliationAgeMinutes: 0,
      },
    });

    const incident = createOpsIncident({
      incidentId: "incident-20261006-001",
      serviceKey: "gateway",
      alerts: readiness.alerts,
      openedAt: "2026-10-06T12:01:00Z",
    });
    const acknowledged = transitionOpsIncident({
      current: incident,
      nextState: "acknowledged",
      occurredAt: "2026-10-06T12:02:00Z",
    });
    const mitigated = transitionOpsIncident({
      current: acknowledged,
      nextState: "mitigated",
      occurredAt: "2026-10-06T12:10:00Z",
    });
    const resolved = transitionOpsIncident({
      current: mitigated,
      nextState: "resolved",
      occurredAt: "2026-10-06T12:20:00Z",
    });

    expect(resolved).toMatchObject({
      state: "resolved",
      revision: 4,
      runbookRef: "docs/runbooks/incident-reconciliation.md",
      resolvedAt: "2026-10-06T12:20:00.000Z",
    });

    expect(() =>
      transitionOpsIncident({
        current: incident,
        nextState: "resolved",
        occurredAt: "2026-10-06T12:03:00Z",
      }),
    ).toThrow("Invalid incident transition");
  });
});

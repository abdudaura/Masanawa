import test from "node:test";
import assert from "node:assert/strict";
import { qualifyPerformanceEvidence } from "./performance-qualification.mjs";

function thresholds(overrides = {}) {
  return {
    httpMinSamples: 4,
    httpMinDurationSeconds: 10,
    httpMaxP95Ms: 300,
    httpMaxP99Ms: 500,
    httpMaxErrorRate: 0.02,
    httpMinThroughputPerSecond: 0.2,

    realtimeMinSamples: 4,
    realtimeMinDurationSeconds: 10,
    realtimeMaxP95Ms: 500,
    realtimeMaxP99Ms: 800,
    realtimeMaxFailureRate: 0.05,
    realtimeMaxDisconnectRate: 0.05,

    backpressureMinAttempts: 4,
    backpressureMinDurationSeconds: 10,
    backpressureMaxUnexpectedDropRate: 0.01,
    backpressureMaxP95QueueDepth: 100,

    fleetMinAssignedCapacity: 10,
    fleetMinReadyRatio: 0.9,
    fleetMaxUtilization: 0.8,
    fleetMinFailureReserve: 2,
    ...overrides,
  };
}

function completeEvidence() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-06T13:00:00.000Z",
    thresholds: thresholds(),
    scenarios: [
      {
        id: "gateway-api",
        kind: "http",
        durationSeconds: 10,
        peakConcurrency: 8,
        startedAt: "2026-10-06T12:00:00.000Z",
        finishedAt: "2026-10-06T12:00:10.000Z",
        requestCount: 4,
        successCount: 4,
        errorCount: 0,
        rejectedCount: 0,
        latencyMs: [90, 110, 150, 180],
      },
      {
        id: "presence-live",
        kind: "realtime",
        durationSeconds: 10,
        peakConcurrency: 4,
        startedAt: "2026-10-06T12:01:00.000Z",
        finishedAt: "2026-10-06T12:01:10.000Z",
        sessionCount: 4,
        failedSessionCount: 0,
        disconnectCount: 0,
        firstResponseLatencyMs: [180, 220, 250, 300],
      },
      {
        id: "worker-backpressure",
        kind: "backpressure",
        durationSeconds: 10,
        peakConcurrency: 20,
        startedAt: "2026-10-06T12:02:00.000Z",
        finishedAt: "2026-10-06T12:02:10.000Z",
        attempted: 10,
        accepted: 8,
        intentionallyRejected: 2,
        unexpectedDropped: 0,
        queueDepthSamples: [1, 4, 8, 12, 18],
      },
      {
        id: "device-fleet",
        kind: "fleet",
        durationSeconds: 10,
        peakConcurrency: 7,
        startedAt: "2026-10-06T12:03:00.000Z",
        finishedAt: "2026-10-06T12:03:10.000Z",
        assignedCapacity: 12,
        readyCapacity: 11,
        peakDemand: 7,
        failedCapacity: 1,
      },
    ],
  };
}

test("complete performance evidence is accepted", () => {
  const report = qualifyPerformanceEvidence(completeEvidence());
  assert.equal(report.state, "ACCEPTED");
  assert.equal(report.scenarioCount, 4);
  assert.equal(report.acceptedCount, 4);
  assert.deepEqual(report.missingKinds, []);

  const http = report.results.find((item) => item.kind === "http");
  assert.equal(http.summary.latencies.p95Ms, 180);
  assert.equal(http.summary.latencies.p99Ms, 180);

  const fleet = report.results.find((item) => item.kind === "fleet");
  assert.equal(fleet.summary.headroom, 4);
  assert.equal(fleet.summary.failureReserve, 5);
});

test("missing a required scenario kind is incomplete, never accepted", () => {
  const input = completeEvidence();
  input.scenarios = input.scenarios.filter((item) => item.kind !== "realtime");

  const report = qualifyPerformanceEvidence(input);
  assert.equal(report.state, "INCOMPLETE");
  assert.deepEqual(report.missingKinds, ["realtime"]);
  assert.equal(report.failedCount, 0);
  assert.equal(report.incompleteCount, 1);
});

test("insufficient samples or duration are incomplete rather than threshold failures", () => {
  const input = completeEvidence();
  const http = input.scenarios.find((item) => item.kind === "http");
  http.requestCount = 3;
  http.successCount = 3;
  http.latencyMs = [90, 100, 110];

  const report = qualifyPerformanceEvidence(input);
  assert.equal(report.state, "INCOMPLETE");
  const httpResult = report.results.find((item) => item.kind === "http");
  assert.equal(httpResult.state, "INCOMPLETE");
  assert.match(httpResult.incomplete[0], /samples 3 < 4/);
});

test("latency and error-rate threshold breaches fail qualification", () => {
  const input = completeEvidence();
  const http = input.scenarios.find((item) => item.kind === "http");
  http.successCount = 3;
  http.errorCount = 1;
  http.latencyMs = [90, 110, 150, 900];

  const report = qualifyPerformanceEvidence(input);
  assert.equal(report.state, "FAILED");
  const httpResult = report.results.find((item) => item.kind === "http");
  assert.equal(httpResult.state, "FAILED");
  assert.ok(httpResult.failures.some((item) => item.includes("p95")));
  assert.ok(httpResult.failures.some((item) => item.includes("errorRate")));
});

test("intentional backpressure is distinct from unexpected drops", () => {
  const input = completeEvidence();
  const bp = input.scenarios.find((item) => item.kind === "backpressure");
  bp.accepted = 7;
  bp.intentionallyRejected = 2;
  bp.unexpectedDropped = 1;

  const report = qualifyPerformanceEvidence(input);
  assert.equal(report.state, "FAILED");
  const bpResult = report.results.find((item) => item.kind === "backpressure");
  assert.equal(bpResult.summary.rejectionRate, 0.2);
  assert.equal(bpResult.summary.unexpectedDropRate, 0.1);
  assert.ok(bpResult.failures.some((item) => item.includes("unexpectedDropRate")));
});

test("fleet utilization and failure reserve are enforced independently", () => {
  const input = completeEvidence();
  const fleet = input.scenarios.find((item) => item.kind === "fleet");
  fleet.assignedCapacity = 10;
  fleet.readyCapacity = 9;
  fleet.peakDemand = 9;
  fleet.failedCapacity = 1;

  const report = qualifyPerformanceEvidence(input);
  assert.equal(report.state, "FAILED");
  const fleetResult = report.results.find((item) => item.kind === "fleet");
  assert.ok(fleetResult.failures.some((item) => item.includes("utilization")));
  assert.ok(fleetResult.failures.some((item) => item.includes("failureReserve")));
});

test("duplicate scenario ids are rejected", () => {
  const input = completeEvidence();
  input.scenarios[1].id = input.scenarios[0].id;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /scenario ids must be unique/,
  );
});

test("accounting-inconsistent HTTP evidence is rejected", () => {
  const input = completeEvidence();
  const http = input.scenarios.find((item) => item.kind === "http");
  http.successCount = 4;
  http.errorCount = 1;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /request accounting does not sum/,
  );
});

test("accounting-inconsistent backpressure evidence is rejected", () => {
  const input = completeEvidence();
  const bp = input.scenarios.find((item) => item.kind === "backpressure");
  bp.accepted = 9;
  bp.intentionallyRejected = 2;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /backpressure accounting does not sum/,
  );
});

test("missing threshold dimensions fail closed", () => {
  const input = completeEvidence();
  delete input.thresholds.realtimeMaxP99Ms;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /threshold realtimeMaxP99Ms is required/,
  );
});

test("future or mismatched duration metadata is rejected", () => {
  const input = completeEvidence();
  const rt = input.scenarios.find((item) => item.kind === "realtime");
  rt.durationSeconds = 30;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /duration does not match timestamps/,
  );
});

test("NaN/negative samples are rejected", () => {
  const input = completeEvidence();
  const http = input.scenarios.find((item) => item.kind === "http");
  http.latencyMs[0] = -1;

  assert.throws(
    () => qualifyPerformanceEvidence(input),
    /latencyMs\[0\] is invalid/,
  );
});

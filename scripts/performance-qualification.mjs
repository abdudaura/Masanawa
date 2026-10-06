#!/usr/bin/env node

import fs from "node:fs";

const SCENARIO_KINDS = Object.freeze([
  "http",
  "realtime",
  "backpressure",
  "fleet",
]);

function fail(message) {
  const error = new Error(message);
  error.name = "PerformanceQualificationError";
  throw error;
}

function finite(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${name} is invalid`);
  }
  return value;
}

function integer(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${name} is invalid`);
  }
  return value;
}

function boundedString(value, name, min = 1, max = 160) {
  if (typeof value !== "string") fail(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    fail(`${name} is invalid`);
  }
  return normalized;
}

function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) fail("percentile requires samples");
  finite(p, "percentile", { min: 0, max: 1 });
  if (sorted.length === 1) return sorted[0];
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function normalizeLatencySamples(values, name) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 1_000_000) {
    fail(`${name} must contain 1..1000000 samples`);
  }
  return values
    .map((value, index) =>
      finite(value, `${name}[${index}]`, { min: 0, max: 3_600_000 }),
    )
    .sort((a, b) => a - b);
}

function summarizeLatencies(values) {
  const sorted = normalizeLatencySamples(values, "latencyMs");
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    samples: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    meanMs: total / sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
  });
}

function normalizeCommonScenario(input) {
  const id = boundedString(input.id, "scenario.id", 1, 120).toLowerCase();
  const kind = boundedString(input.kind, "scenario.kind", 1, 40).toLowerCase();
  if (!SCENARIO_KINDS.includes(kind)) fail(`scenario ${id} has unsupported kind`);
  return {
    id,
    kind,
    durationSeconds: finite(input.durationSeconds, `${id}.durationSeconds`, {
      min: 1,
      max: 86_400,
    }),
    peakConcurrency: integer(input.peakConcurrency, `${id}.peakConcurrency`, {
      min: 1,
      max: 10_000_000,
    }),
    startedAt: boundedString(input.startedAt, `${id}.startedAt`, 20, 40),
    finishedAt: boundedString(input.finishedAt, `${id}.finishedAt`, 20, 40),
  };
}

function ensureTimeOrder(common) {
  const start = Date.parse(common.startedAt);
  const end = Date.parse(common.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    fail(`scenario ${common.id} timestamps are invalid`);
  }
  const observed = (end - start) / 1000;
  if (Math.abs(observed - common.durationSeconds) > Math.max(2, common.durationSeconds * 0.05)) {
    fail(`scenario ${common.id} duration does not match timestamps`);
  }
}

function normalizeHttp(input) {
  const common = normalizeCommonScenario(input);
  ensureTimeOrder(common);
  const requestCount = integer(input.requestCount, `${common.id}.requestCount`, {
    min: 1,
    max: 2_000_000_000,
  });
  const successCount = integer(input.successCount, `${common.id}.successCount`, {
    min: 0,
    max: requestCount,
  });
  const errorCount = integer(input.errorCount, `${common.id}.errorCount`, {
    min: 0,
    max: requestCount,
  });
  const rejectedCount = integer(input.rejectedCount ?? 0, `${common.id}.rejectedCount`, {
    min: 0,
    max: requestCount,
  });
  if (successCount + errorCount + rejectedCount !== requestCount) {
    fail(`scenario ${common.id} request accounting does not sum`);
  }
  const latencies = summarizeLatencies(input.latencyMs);
  if (latencies.samples !== requestCount) {
    fail(`scenario ${common.id} latency sample count must equal requestCount`);
  }
  return Object.freeze({
    ...common,
    requestCount,
    successCount,
    errorCount,
    rejectedCount,
    latencies,
    throughputPerSecond: requestCount / common.durationSeconds,
    errorRate: errorCount / requestCount,
    rejectionRate: rejectedCount / requestCount,
  });
}

function normalizeRealtime(input) {
  const common = normalizeCommonScenario(input);
  ensureTimeOrder(common);
  const sessionCount = integer(input.sessionCount, `${common.id}.sessionCount`, {
    min: 1,
    max: 100_000_000,
  });
  const failedSessionCount = integer(
    input.failedSessionCount,
    `${common.id}.failedSessionCount`,
    { min: 0, max: sessionCount },
  );
  const disconnectCount = integer(input.disconnectCount ?? 0, `${common.id}.disconnectCount`, {
    min: 0,
    max: sessionCount,
  });
  const firstResponse = summarizeLatencies(input.firstResponseLatencyMs);
  if (firstResponse.samples !== sessionCount) {
    fail(`scenario ${common.id} realtime sample count must equal sessionCount`);
  }
  return Object.freeze({
    ...common,
    sessionCount,
    failedSessionCount,
    disconnectCount,
    firstResponseLatencies: firstResponse,
    failureRate: failedSessionCount / sessionCount,
    disconnectRate: disconnectCount / sessionCount,
    sessionsPerSecond: sessionCount / common.durationSeconds,
  });
}

function normalizeBackpressure(input) {
  const common = normalizeCommonScenario(input);
  ensureTimeOrder(common);
  const attempted = integer(input.attempted, `${common.id}.attempted`, {
    min: 1,
    max: 2_000_000_000,
  });
  const accepted = integer(input.accepted, `${common.id}.accepted`, {
    min: 0,
    max: attempted,
  });
  const intentionallyRejected = integer(
    input.intentionallyRejected,
    `${common.id}.intentionallyRejected`,
    { min: 0, max: attempted },
  );
  const unexpectedDropped = integer(
    input.unexpectedDropped,
    `${common.id}.unexpectedDropped`,
    { min: 0, max: attempted },
  );
  if (accepted + intentionallyRejected + unexpectedDropped !== attempted) {
    fail(`scenario ${common.id} backpressure accounting does not sum`);
  }
  const queueDepthSamples = normalizeLatencySamples(input.queueDepthSamples, "queueDepthSamples");
  return Object.freeze({
    ...common,
    attempted,
    accepted,
    intentionallyRejected,
    unexpectedDropped,
    rejectionRate: intentionallyRejected / attempted,
    unexpectedDropRate: unexpectedDropped / attempted,
    acceptedPerSecond: accepted / common.durationSeconds,
    maxQueueDepth: queueDepthSamples[queueDepthSamples.length - 1],
    p95QueueDepth: percentile(queueDepthSamples, 0.95),
  });
}

function normalizeFleet(input) {
  const common = normalizeCommonScenario(input);
  ensureTimeOrder(common);
  const assignedCapacity = integer(input.assignedCapacity, `${common.id}.assignedCapacity`, {
    min: 1,
    max: 100_000_000,
  });
  const readyCapacity = integer(input.readyCapacity, `${common.id}.readyCapacity`, {
    min: 0,
    max: assignedCapacity,
  });
  const peakDemand = integer(input.peakDemand, `${common.id}.peakDemand`, {
    min: 0,
    max: 100_000_000,
  });
  const failedCapacity = integer(input.failedCapacity ?? 0, `${common.id}.failedCapacity`, {
    min: 0,
    max: assignedCapacity,
  });
  if (readyCapacity + failedCapacity > assignedCapacity) {
    fail(`scenario ${common.id} fleet accounting exceeds assigned capacity`);
  }
  const utilization = readyCapacity === 0 ? 1 : peakDemand / readyCapacity;
  const headroom = readyCapacity - peakDemand;
  const failureReserve = assignedCapacity - peakDemand;
  return Object.freeze({
    ...common,
    assignedCapacity,
    readyCapacity,
    peakDemand,
    failedCapacity,
    utilization,
    headroom,
    failureReserve,
    readyRatio: readyCapacity / assignedCapacity,
  });
}

function normalizeScenario(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("scenario must be an object");
  }
  const kind = boundedString(input.kind, "scenario.kind", 1, 40).toLowerCase();
  if (kind === "http") return normalizeHttp(input);
  if (kind === "realtime") return normalizeRealtime(input);
  if (kind === "backpressure") return normalizeBackpressure(input);
  if (kind === "fleet") return normalizeFleet(input);
  fail("unsupported scenario kind");
}

function normalizeThresholds(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("thresholds must be an object");
  }
  const require = (key) => {
    if (!(key in input)) fail(`threshold ${key} is required`);
    return input[key];
  };
  return Object.freeze({
    http: Object.freeze({
      minSamples: integer(require("httpMinSamples"), "httpMinSamples", { min: 1 }),
      minDurationSeconds: finite(require("httpMinDurationSeconds"), "httpMinDurationSeconds", { min: 1 }),
      maxP95Ms: finite(require("httpMaxP95Ms"), "httpMaxP95Ms", { min: 0 }),
      maxP99Ms: finite(require("httpMaxP99Ms"), "httpMaxP99Ms", { min: 0 }),
      maxErrorRate: finite(require("httpMaxErrorRate"), "httpMaxErrorRate", { min: 0, max: 1 }),
      minThroughputPerSecond: finite(require("httpMinThroughputPerSecond"), "httpMinThroughputPerSecond", { min: 0 }),
    }),
    realtime: Object.freeze({
      minSamples: integer(require("realtimeMinSamples"), "realtimeMinSamples", { min: 1 }),
      minDurationSeconds: finite(require("realtimeMinDurationSeconds"), "realtimeMinDurationSeconds", { min: 1 }),
      maxP95Ms: finite(require("realtimeMaxP95Ms"), "realtimeMaxP95Ms", { min: 0 }),
      maxP99Ms: finite(require("realtimeMaxP99Ms"), "realtimeMaxP99Ms", { min: 0 }),
      maxFailureRate: finite(require("realtimeMaxFailureRate"), "realtimeMaxFailureRate", { min: 0, max: 1 }),
      maxDisconnectRate: finite(require("realtimeMaxDisconnectRate"), "realtimeMaxDisconnectRate", { min: 0, max: 1 }),
    }),
    backpressure: Object.freeze({
      minAttempts: integer(require("backpressureMinAttempts"), "backpressureMinAttempts", { min: 1 }),
      minDurationSeconds: finite(require("backpressureMinDurationSeconds"), "backpressureMinDurationSeconds", { min: 1 }),
      maxUnexpectedDropRate: finite(require("backpressureMaxUnexpectedDropRate"), "backpressureMaxUnexpectedDropRate", { min: 0, max: 1 }),
      maxP95QueueDepth: finite(require("backpressureMaxP95QueueDepth"), "backpressureMaxP95QueueDepth", { min: 0 }),
    }),
    fleet: Object.freeze({
      minAssignedCapacity: integer(require("fleetMinAssignedCapacity"), "fleetMinAssignedCapacity", { min: 1 }),
      minReadyRatio: finite(require("fleetMinReadyRatio"), "fleetMinReadyRatio", { min: 0, max: 1 }),
      maxUtilization: finite(require("fleetMaxUtilization"), "fleetMaxUtilization", { min: 0 }),
      minFailureReserve: integer(require("fleetMinFailureReserve"), "fleetMinFailureReserve", { min: 0 }),
    }),
  });
}

function checkScenario(scenario, thresholds) {
  const failures = [];
  const incomplete = [];

  if (scenario.kind === "http") {
    const t = thresholds.http;
    if (scenario.requestCount < t.minSamples) incomplete.push(`samples ${scenario.requestCount} < ${t.minSamples}`);
    if (scenario.durationSeconds < t.minDurationSeconds) incomplete.push(`duration ${scenario.durationSeconds}s < ${t.minDurationSeconds}s`);
    if (scenario.latencies.p95Ms > t.maxP95Ms) failures.push(`p95 ${scenario.latencies.p95Ms}ms > ${t.maxP95Ms}ms`);
    if (scenario.latencies.p99Ms > t.maxP99Ms) failures.push(`p99 ${scenario.latencies.p99Ms}ms > ${t.maxP99Ms}ms`);
    if (scenario.errorRate > t.maxErrorRate) failures.push(`errorRate ${scenario.errorRate} > ${t.maxErrorRate}`);
    if (scenario.throughputPerSecond < t.minThroughputPerSecond) failures.push(`throughput ${scenario.throughputPerSecond} < ${t.minThroughputPerSecond}`);
  } else if (scenario.kind === "realtime") {
    const t = thresholds.realtime;
    if (scenario.sessionCount < t.minSamples) incomplete.push(`samples ${scenario.sessionCount} < ${t.minSamples}`);
    if (scenario.durationSeconds < t.minDurationSeconds) incomplete.push(`duration ${scenario.durationSeconds}s < ${t.minDurationSeconds}s`);
    if (scenario.firstResponseLatencies.p95Ms > t.maxP95Ms) failures.push(`p95 ${scenario.firstResponseLatencies.p95Ms}ms > ${t.maxP95Ms}ms`);
    if (scenario.firstResponseLatencies.p99Ms > t.maxP99Ms) failures.push(`p99 ${scenario.firstResponseLatencies.p99Ms}ms > ${t.maxP99Ms}ms`);
    if (scenario.failureRate > t.maxFailureRate) failures.push(`failureRate ${scenario.failureRate} > ${t.maxFailureRate}`);
    if (scenario.disconnectRate > t.maxDisconnectRate) failures.push(`disconnectRate ${scenario.disconnectRate} > ${t.maxDisconnectRate}`);
  } else if (scenario.kind === "backpressure") {
    const t = thresholds.backpressure;
    if (scenario.attempted < t.minAttempts) incomplete.push(`attempts ${scenario.attempted} < ${t.minAttempts}`);
    if (scenario.durationSeconds < t.minDurationSeconds) incomplete.push(`duration ${scenario.durationSeconds}s < ${t.minDurationSeconds}s`);
    if (scenario.unexpectedDropRate > t.maxUnexpectedDropRate) failures.push(`unexpectedDropRate ${scenario.unexpectedDropRate} > ${t.maxUnexpectedDropRate}`);
    if (scenario.p95QueueDepth > t.maxP95QueueDepth) failures.push(`p95QueueDepth ${scenario.p95QueueDepth} > ${t.maxP95QueueDepth}`);
  } else if (scenario.kind === "fleet") {
    const t = thresholds.fleet;
    if (scenario.assignedCapacity < t.minAssignedCapacity) incomplete.push(`assignedCapacity ${scenario.assignedCapacity} < ${t.minAssignedCapacity}`);
    if (scenario.readyRatio < t.minReadyRatio) failures.push(`readyRatio ${scenario.readyRatio} < ${t.minReadyRatio}`);
    if (scenario.utilization > t.maxUtilization) failures.push(`utilization ${scenario.utilization} > ${t.maxUtilization}`);
    if (scenario.failureReserve < t.minFailureReserve) failures.push(`failureReserve ${scenario.failureReserve} < ${t.minFailureReserve}`);
  }

  return Object.freeze({
    id: scenario.id,
    kind: scenario.kind,
    state: failures.length > 0 ? "FAILED" : incomplete.length > 0 ? "INCOMPLETE" : "ACCEPTED",
    failures: Object.freeze(failures),
    incomplete: Object.freeze(incomplete),
    summary: scenario,
  });
}

export function qualifyPerformanceEvidence(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("qualification input must be an object");
  }
  if (input.schemaVersion !== 1) fail("Unsupported qualification schema");
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1 || input.scenarios.length > 100) {
    fail("scenarios must contain 1..100 entries");
  }

  const thresholds = normalizeThresholds(input.thresholds);
  const scenarios = input.scenarios.map(normalizeScenario);
  const ids = scenarios.map((scenario) => scenario.id);
  if (new Set(ids).size !== ids.length) fail("scenario ids must be unique");

  const kinds = new Set(scenarios.map((scenario) => scenario.kind));
  const missingKinds = SCENARIO_KINDS.filter((kind) => !kinds.has(kind));
  const results = scenarios.map((scenario) => checkScenario(scenario, thresholds));

  const failedCount = results.filter((result) => result.state === "FAILED").length;
  const incompleteCount =
    results.filter((result) => result.state === "INCOMPLETE").length + missingKinds.length;

  return Object.freeze({
    schemaVersion: 1,
    generatedAt: boundedString(input.generatedAt, "generatedAt", 20, 40),
    state: failedCount > 0 ? "FAILED" : incompleteCount > 0 ? "INCOMPLETE" : "ACCEPTED",
    missingKinds: Object.freeze(missingKinds),
    scenarioCount: results.length,
    acceptedCount: results.filter((result) => result.state === "ACCEPTED").length,
    incompleteCount,
    failedCount,
    results: Object.freeze(results),
  });
}

function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error("Usage: node scripts/performance-qualification.mjs <evidence.json>");
    process.exitCode = 1;
    return;
  }

  try {
    const raw = fs.readFileSync(inputPath, "utf8");
    const input = JSON.parse(raw);
    const report = qualifyPerformanceEvidence(input);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.state === "ACCEPTED" ? 0 : report.state === "INCOMPLETE" ? 2 : 3;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

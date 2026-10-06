export interface CapacitySample {
  readonly latencyMs: number;
  readonly realtimeLatencyMs: number | null;
  readonly queueDepth: number;
  readonly inFlight: number;
  readonly rejected: boolean;
}

export interface FleetCapacitySnapshot {
  readonly totalInstances: number;
  readonly readyInstances: number;
  readonly utilizationBasisPoints: number;
}

export interface CapacityBudget {
  readonly maxP95LatencyMs: number;
  readonly maxP99LatencyMs: number;
  readonly maxP95RealtimeLatencyMs: number | null;
  readonly maxQueueDepth: number;
  readonly maxInFlight: number;
  readonly maxRejectionRateBasisPoints: number;
  readonly minReadyInstances: number;
  readonly minReadyRatioBasisPoints: number;
  readonly maxFleetUtilizationBasisPoints: number;
}

export interface CapacityEvidenceResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly sampleCount: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly p95RealtimeLatencyMs: number | null;
  readonly peakQueueDepth: number;
  readonly peakInFlight: number;
  readonly rejectionRateBasisPoints: number;
  readonly readyRatioBasisPoints: number;
  readonly fleetUtilizationBasisPoints: number;
}

function integer(
  value: number,
  name: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) {
    throw new RangeError("percentile requires at least one value");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentileValue / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)]!;
}

export function evaluateCapacityEvidence(input: {
  readonly samples: readonly CapacitySample[];
  readonly fleet: FleetCapacitySnapshot;
  readonly budget: CapacityBudget;
}): CapacityEvidenceResult {
  if (!Array.isArray(input.samples) || input.samples.length < 1) {
    throw new RangeError("capacity evidence requires at least one sample");
  }

  const samples = input.samples.map((sample, index) => {
    integer(sample.latencyMs, `samples[${index}].latencyMs`, 0);
    if (sample.realtimeLatencyMs !== null) {
      integer(
        sample.realtimeLatencyMs,
        `samples[${index}].realtimeLatencyMs`,
        0,
      );
    }
    integer(sample.queueDepth, `samples[${index}].queueDepth`, 0);
    integer(sample.inFlight, `samples[${index}].inFlight`, 0);
    if (typeof sample.rejected !== "boolean") {
      throw new TypeError(`samples[${index}].rejected must be boolean`);
    }
    return sample;
  });

  const fleet = {
    totalInstances: integer(input.fleet.totalInstances, "totalInstances", 1),
    readyInstances: integer(input.fleet.readyInstances, "readyInstances", 0),
    utilizationBasisPoints: integer(
      input.fleet.utilizationBasisPoints,
      "utilizationBasisPoints",
      0,
      10_000,
    ),
  };
  if (fleet.readyInstances > fleet.totalInstances) {
    throw new RangeError("readyInstances cannot exceed totalInstances");
  }

  const budget = {
    maxP95LatencyMs: integer(
      input.budget.maxP95LatencyMs,
      "maxP95LatencyMs",
      0,
    ),
    maxP99LatencyMs: integer(
      input.budget.maxP99LatencyMs,
      "maxP99LatencyMs",
      0,
    ),
    maxP95RealtimeLatencyMs:
      input.budget.maxP95RealtimeLatencyMs === null
        ? null
        : integer(
            input.budget.maxP95RealtimeLatencyMs,
            "maxP95RealtimeLatencyMs",
            0,
          ),
    maxQueueDepth: integer(
      input.budget.maxQueueDepth,
      "maxQueueDepth",
      0,
    ),
    maxInFlight: integer(input.budget.maxInFlight, "maxInFlight", 0),
    maxRejectionRateBasisPoints: integer(
      input.budget.maxRejectionRateBasisPoints,
      "maxRejectionRateBasisPoints",
      0,
      10_000,
    ),
    minReadyInstances: integer(
      input.budget.minReadyInstances,
      "minReadyInstances",
      1,
    ),
    minReadyRatioBasisPoints: integer(
      input.budget.minReadyRatioBasisPoints,
      "minReadyRatioBasisPoints",
      0,
      10_000,
    ),
    maxFleetUtilizationBasisPoints: integer(
      input.budget.maxFleetUtilizationBasisPoints,
      "maxFleetUtilizationBasisPoints",
      0,
      10_000,
    ),
  };

  if (budget.maxP99LatencyMs < budget.maxP95LatencyMs) {
    throw new RangeError("maxP99LatencyMs cannot be lower than maxP95LatencyMs");
  }

  const latencies = samples.map((sample) => sample.latencyMs);
  const realtimeLatencies = samples
    .map((sample) => sample.realtimeLatencyMs)
    .filter((value): value is number => value !== null);

  const p95LatencyMs = percentile(latencies, 95);
  const p99LatencyMs = percentile(latencies, 99);
  const p95RealtimeLatencyMs =
    realtimeLatencies.length === 0
      ? null
      : percentile(realtimeLatencies, 95);
  const peakQueueDepth = Math.max(...samples.map((sample) => sample.queueDepth));
  const peakInFlight = Math.max(...samples.map((sample) => sample.inFlight));
  const rejected = samples.filter((sample) => sample.rejected).length;
  const rejectionRateBasisPoints = Math.floor(
    (rejected * 10_000) / samples.length,
  );
  const readyRatioBasisPoints = Math.floor(
    (fleet.readyInstances * 10_000) / fleet.totalInstances,
  );

  const failures: string[] = [];
  if (p95LatencyMs > budget.maxP95LatencyMs) {
    failures.push("p95-latency");
  }
  if (p99LatencyMs > budget.maxP99LatencyMs) {
    failures.push("p99-latency");
  }
  if (
    budget.maxP95RealtimeLatencyMs !== null &&
    p95RealtimeLatencyMs !== null &&
    p95RealtimeLatencyMs > budget.maxP95RealtimeLatencyMs
  ) {
    failures.push("p95-realtime-latency");
  }
  if (
    budget.maxP95RealtimeLatencyMs !== null &&
    p95RealtimeLatencyMs === null
  ) {
    failures.push("missing-realtime-evidence");
  }
  if (peakQueueDepth > budget.maxQueueDepth) {
    failures.push("queue-depth");
  }
  if (peakInFlight > budget.maxInFlight) {
    failures.push("inflight");
  }
  if (rejectionRateBasisPoints > budget.maxRejectionRateBasisPoints) {
    failures.push("rejection-rate");
  }
  if (fleet.readyInstances < budget.minReadyInstances) {
    failures.push("ready-instance-count");
  }
  if (readyRatioBasisPoints < budget.minReadyRatioBasisPoints) {
    failures.push("ready-instance-ratio");
  }
  if (
    fleet.utilizationBasisPoints >
    budget.maxFleetUtilizationBasisPoints
  ) {
    failures.push("fleet-utilization");
  }

  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    sampleCount: samples.length,
    p95LatencyMs,
    p99LatencyMs,
    p95RealtimeLatencyMs,
    peakQueueDepth,
    peakInFlight,
    rejectionRateBasisPoints,
    readyRatioBasisPoints,
    fleetUtilizationBasisPoints: fleet.utilizationBasisPoints,
  });
}

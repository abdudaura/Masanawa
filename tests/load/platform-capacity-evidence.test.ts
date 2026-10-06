import { describe, expect, it } from "vitest";
import {
  evaluateCapacityEvidence,
  type CapacityBudget,
  type CapacitySample,
} from "../support/capacity-evidence.js";

const budget: CapacityBudget = {
  maxP95LatencyMs: 250,
  maxP99LatencyMs: 400,
  maxP95RealtimeLatencyMs: 180,
  maxQueueDepth: 20,
  maxInFlight: 50,
  maxRejectionRateBasisPoints: 100,
  minReadyInstances: 2,
  minReadyRatioBasisPoints: 6_600,
  maxFleetUtilizationBasisPoints: 8_000,
};

function healthySamples(): CapacitySample[] {
  return Array.from({ length: 100 }, (_, index) => ({
    latencyMs: index < 95 ? 120 : index < 99 ? 220 : 300,
    realtimeLatencyMs: index < 95 ? 90 : 150,
    queueDepth: index % 8,
    inFlight: 10 + (index % 20),
    rejected: false,
  }));
}

describe("Task 146 platform capacity evidence", () => {
  it("passes bounded latency, backpressure and fleet headroom evidence", () => {
    const result = evaluateCapacityEvidence({
      samples: healthySamples(),
      fleet: {
        totalInstances: 3,
        readyInstances: 3,
        utilizationBasisPoints: 6_500,
      },
      budget,
    });

    expect(result).toMatchObject({
      passed: true,
      failures: [],
      sampleCount: 100,
      p95LatencyMs: 120,
      p99LatencyMs: 220,
      p95RealtimeLatencyMs: 90,
      rejectionRateBasisPoints: 0,
      readyRatioBasisPoints: 10_000,
    });
  });

  it("fails when queue pressure and inflight concurrency exceed policy", () => {
    const samples = healthySamples();
    samples[50] = {
      ...samples[50]!,
      queueDepth: 21,
      inFlight: 51,
    };

    expect(
      evaluateCapacityEvidence({
        samples,
        fleet: {
          totalInstances: 3,
          readyInstances: 3,
          utilizationBasisPoints: 6_500,
        },
        budget,
      }),
    ).toMatchObject({
      passed: false,
      failures: expect.arrayContaining(["queue-depth", "inflight"]),
    });
  });

  it("fails excessive rejection/backpressure shedding rate", () => {
    const samples = healthySamples();
    samples[0] = { ...samples[0]!, rejected: true };
    samples[1] = { ...samples[1]!, rejected: true };

    expect(
      evaluateCapacityEvidence({
        samples,
        fleet: {
          totalInstances: 3,
          readyInstances: 3,
          utilizationBasisPoints: 6_500,
        },
        budget,
      }),
    ).toMatchObject({
      passed: false,
      rejectionRateBasisPoints: 200,
      failures: expect.arrayContaining(["rejection-rate"]),
    });
  });

  it("fails realtime latency and requires realtime evidence when budgeted", () => {
    const samples = healthySamples().map((sample, index) => ({
      ...sample,
      realtimeLatencyMs: index < 95 ? 200 : 250,
    }));

    expect(
      evaluateCapacityEvidence({
        samples,
        fleet: {
          totalInstances: 3,
          readyInstances: 3,
          utilizationBasisPoints: 6_500,
        },
        budget,
      }),
    ).toMatchObject({
      passed: false,
      failures: expect.arrayContaining(["p95-realtime-latency"]),
    });

    const noRealtime = healthySamples().map((sample) => ({
      ...sample,
      realtimeLatencyMs: null,
    }));

    expect(
      evaluateCapacityEvidence({
        samples: noRealtime,
        fleet: {
          totalInstances: 3,
          readyInstances: 3,
          utilizationBasisPoints: 6_500,
        },
        budget,
      }),
    ).toMatchObject({
      passed: false,
      failures: expect.arrayContaining(["missing-realtime-evidence"]),
    });
  });

  it("fails degraded fleet readiness or insufficient headroom", () => {
    const result = evaluateCapacityEvidence({
      samples: healthySamples(),
      fleet: {
        totalInstances: 3,
        readyInstances: 1,
        utilizationBasisPoints: 9_000,
      },
      budget,
    });

    expect(result).toMatchObject({
      passed: false,
      failures: expect.arrayContaining([
        "ready-instance-count",
        "ready-instance-ratio",
        "fleet-utilization",
      ]),
    });
  });

  it("rejects incoherent budgets rather than silently accepting them", () => {
    expect(() =>
      evaluateCapacityEvidence({
        samples: healthySamples(),
        fleet: {
          totalInstances: 3,
          readyInstances: 3,
          utilizationBasisPoints: 5_000,
        },
        budget: {
          ...budget,
          maxP95LatencyMs: 500,
          maxP99LatencyMs: 400,
        },
      }),
    ).toThrow("maxP99LatencyMs cannot be lower");
  });
});

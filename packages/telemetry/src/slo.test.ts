import { describe, expect, it } from "vitest";
import {
  evaluateSloWindow,
  normalizeSloDefinition,
  type SloDefinition,
} from "./slo.js";

const base: SloDefinition = {
  key: "gateway.availability",
  service: "gateway",
  metric: "availability",
  windowMinutes: 60,
  targetPermillion: 999_000,
  latencyThresholdMs: null,
  ticketBurnRate: 2,
  pageBurnRate: 10,
};

describe("SLO evaluation", () => {
  it("classifies healthy, ticket and page burn deterministically", () => {
    const healthy = evaluateSloWindow({
      definition: base,
      observation: {
        total: 100_000,
        good: 99_950,
        observedAt: "2026-10-06T12:00:00.000Z" as never,
      },
    });
    expect(healthy.alertLevel).toBe("healthy");

    const ticket = evaluateSloWindow({
      definition: base,
      observation: {
        total: 100_000,
        good: 99_700,
        observedAt: "2026-10-06T12:05:00.000Z" as never,
      },
    });
    expect(ticket.alertLevel).toBe("ticket");
    expect(ticket.burnRate).toBeGreaterThanOrEqual(2);
    expect(ticket.burnRate).toBeLessThan(10);

    const page = evaluateSloWindow({
      definition: base,
      observation: {
        total: 100_000,
        good: 98_500,
        observedAt: "2026-10-06T12:10:00.000Z" as never,
      },
    });
    expect(page.alertLevel).toBe("page");
    expect(page.burnRate).toBeGreaterThanOrEqual(10);
  });

  it("supports latency SLOs using pre-aggregated good/total counts", () => {
    const result = evaluateSloWindow({
      definition: {
        key: "presence.turn-latency",
        service: "presence",
        metric: "latency",
        windowMinutes: 15,
        targetPermillion: 990_000,
        latencyThresholdMs: 800,
        ticketBurnRate: 2,
        pageBurnRate: 6,
      },
      observation: {
        total: 10_000,
        good: 9_700,
        observedAt: "2026-10-06T12:15:00.000Z" as never,
      },
    });

    expect(result.latencyThresholdMs).toBe(800);
    expect(result.alertLevel).toBe("ticket");
  });

  it("rejects invalid targets, thresholds and burn-rate ordering", () => {
    expect(() =>
      normalizeSloDefinition({
        ...base,
        targetPermillion: 1_000_000,
      }),
    ).toThrow("targetPermillion");

    expect(() =>
      normalizeSloDefinition({
        ...base,
        metric: "latency",
        latencyThresholdMs: null,
      }),
    ).toThrow("requires");

    expect(() =>
      normalizeSloDefinition({
        ...base,
        ticketBurnRate: 10,
        pageBurnRate: 5,
      }),
    ).toThrow("exceed");
  });

  it("keeps alert output bounded to metrics and identifiers only", () => {
    const canary = "do-not-log-secret-or-prompt-canary";
    const result = evaluateSloWindow({
      definition: base,
      observation: {
        total: 1000,
        good: 999,
        observedAt: "2026-10-06T12:20:00.000Z" as never,
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(canary);
    expect(Object.keys(result).sort()).toEqual([
      "alertLevel",
      "bad",
      "burnRate",
      "good",
      "latencyThresholdMs",
      "metric",
      "observedAt",
      "observedGoodPermillion",
      "service",
      "sloKey",
      "targetPermillion",
      "total",
      "windowMinutes",
    ]);
  });
});

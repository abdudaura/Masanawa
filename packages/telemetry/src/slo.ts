import { toInstant, type Instant } from "@masanawa/contracts";

export type SloMetricKind = "availability" | "latency";
export type SloAlertLevel = "healthy" | "ticket" | "page";

export interface SloDefinition {
  readonly key: string;
  readonly service: string;
  readonly metric: SloMetricKind;
  readonly windowMinutes: number;
  readonly targetPermillion: number;
  readonly latencyThresholdMs: number | null;
  readonly ticketBurnRate: number;
  readonly pageBurnRate: number;
}

export interface SloWindowObservation {
  readonly total: number;
  readonly good: number;
  readonly observedAt: Instant;
}

export interface SloEvaluation {
  readonly sloKey: string;
  readonly service: string;
  readonly metric: SloMetricKind;
  readonly windowMinutes: number;
  readonly total: number;
  readonly good: number;
  readonly bad: number;
  readonly targetPermillion: number;
  readonly observedGoodPermillion: number;
  readonly burnRate: number;
  readonly alertLevel: SloAlertLevel;
  readonly observedAt: Instant;
  readonly latencyThresholdMs: number | null;
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < min ||
    normalized.length > max ||
    !keyPattern.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeSloDefinition(input: SloDefinition): SloDefinition {
  if (input.metric !== "availability" && input.metric !== "latency") {
    throw new TypeError("SLO metric is invalid");
  }
  const targetPermillion = positiveInteger(
    input.targetPermillion,
    "targetPermillion",
    999_999,
  );
  if (targetPermillion < 500_000) {
    throw new RangeError("targetPermillion must be at least 500000");
  }

  const latencyThresholdMs =
    input.latencyThresholdMs === null
      ? null
      : positiveInteger(
          input.latencyThresholdMs,
          "latencyThresholdMs",
          600_000,
        );
  if (input.metric === "latency" && latencyThresholdMs === null) {
    throw new Error("Latency SLO requires latencyThresholdMs");
  }
  if (input.metric === "availability" && latencyThresholdMs !== null) {
    throw new Error("Availability SLO cannot define latencyThresholdMs");
  }

  const ticketBurnRate = finitePositive(
    input.ticketBurnRate,
    "ticketBurnRate",
  );
  const pageBurnRate = finitePositive(input.pageBurnRate, "pageBurnRate");
  if (pageBurnRate <= ticketBurnRate) {
    throw new RangeError("pageBurnRate must exceed ticketBurnRate");
  }

  return Object.freeze({
    key: bounded(input.key, "slo.key", 3, 160),
    service: bounded(input.service, "slo.service", 2, 120),
    metric: input.metric,
    windowMinutes: positiveInteger(
      input.windowMinutes,
      "windowMinutes",
      43_200,
    ),
    targetPermillion,
    latencyThresholdMs,
    ticketBurnRate,
    pageBurnRate,
  });
}

export function normalizeSloWindowObservation(
  input: SloWindowObservation,
): SloWindowObservation {
  const total = positiveInteger(input.total, "observation.total", 1_000_000_000);
  if (!Number.isSafeInteger(input.good) || input.good < 0 || input.good > total) {
    throw new RangeError("observation.good is invalid");
  }
  return Object.freeze({
    total,
    good: input.good,
    observedAt: toInstant(input.observedAt),
  });
}

export function evaluateSloWindow(input: {
  readonly definition: SloDefinition;
  readonly observation: SloWindowObservation;
}): SloEvaluation {
  const definition = normalizeSloDefinition(input.definition);
  const observation = normalizeSloWindowObservation(input.observation);
  const bad = observation.total - observation.good;
  const observedGoodPermillion = Math.floor(
    (observation.good * 1_000_000) / observation.total,
  );
  const errorBudgetPermillion = 1_000_000 - definition.targetPermillion;
  const observedBadPermillion = 1_000_000 - observedGoodPermillion;
  const burnRate = observedBadPermillion / errorBudgetPermillion;

  const alertLevel: SloAlertLevel =
    burnRate >= definition.pageBurnRate
      ? "page"
      : burnRate >= definition.ticketBurnRate
        ? "ticket"
        : "healthy";

  return Object.freeze({
    sloKey: definition.key,
    service: definition.service,
    metric: definition.metric,
    windowMinutes: definition.windowMinutes,
    total: observation.total,
    good: observation.good,
    bad,
    targetPermillion: definition.targetPermillion,
    observedGoodPermillion,
    burnRate,
    alertLevel,
    observedAt: observation.observedAt,
    latencyThresholdMs: definition.latencyThresholdMs,
  });
}

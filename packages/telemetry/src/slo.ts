import { toInstant, type Instant } from "@masanawa/contracts";

export type SloMetricKind =
  | "availability"
  | "latency-good-event"
  | "success-rate"
  | "delivery-rate"
  | "reconciliation-rate"
  | "device-ready-rate";

export interface ServiceLevelObjective {
  readonly schemaVersion: 1;
  readonly key: string;
  readonly description: string;
  readonly metricKind: SloMetricKind;
  readonly targetGoodRatio: number;
  readonly windowMinutes: number;
  readonly minimumEvents: number;
  readonly warningBurnRate: number;
  readonly criticalBurnRate: number;
  readonly maxObservationAgeSeconds: number;
}

export interface SloObservation {
  readonly schemaVersion: 1;
  readonly sloKey: string;
  readonly goodEvents: number;
  readonly totalEvents: number;
  readonly windowStartedAt: Instant;
  readonly windowEndedAt: Instant;
  readonly observedAt: Instant;
}

export type SloEvaluationStatus =
  | "insufficient-data"
  | "healthy"
  | "warning"
  | "critical";

export interface SloEvaluation {
  readonly sloKey: string;
  readonly status: SloEvaluationStatus;
  readonly totalEvents: number;
  readonly goodEvents: number;
  readonly goodRatio: number | null;
  readonly badRatio: number | null;
  readonly burnRate: number | null;
  readonly remainingErrorBudgetRatio: number | null;
  readonly evidenceAgeSeconds: number;
  readonly reasonCode:
    | "ok"
    | "minimum-events-not-met"
    | "observation-stale"
    | "warning-burn-rate"
    | "critical-burn-rate";
  readonly observedAt: Instant;
}

export interface ReconciliationQueueSnapshot {
  readonly schemaVersion: 1;
  readonly queueKey: string;
  readonly pending: number;
  readonly unknown: number;
  readonly manualReview: number;
  readonly retryable: number;
  readonly oldestAgeSeconds: number;
  readonly observedAt: Instant;
}

export interface ReconciliationQueueThresholds {
  readonly schemaVersion: 1;
  readonly queueKey: string;
  readonly warningPending: number;
  readonly criticalPending: number;
  readonly warningUnknown: number;
  readonly criticalUnknown: number;
  readonly warningManualReview: number;
  readonly criticalManualReview: number;
  readonly warningOldestAgeSeconds: number;
  readonly criticalOldestAgeSeconds: number;
  readonly maxObservationAgeSeconds: number;
}

export interface ReconciliationQueueEvaluation {
  readonly queueKey: string;
  readonly status: SloEvaluationStatus;
  readonly reasons: readonly string[];
  readonly snapshot: ReconciliationQueueSnapshot;
  readonly evidenceAgeSeconds: number;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positiveInteger(value: number, name: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

function normalizeMetricKind(value: SloMetricKind): SloMetricKind {
  if (
    value !== "availability" &&
    value !== "latency-good-event" &&
    value !== "success-rate" &&
    value !== "delivery-rate" &&
    value !== "reconciliation-rate" &&
    value !== "device-ready-rate"
  ) {
    throw new TypeError("SLO metricKind is invalid");
  }
  return value;
}

function ratio(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new RangeError(`${name} must be greater than 0 and less than 1`);
  }
  return value;
}

export function normalizeServiceLevelObjective(
  input: ServiceLevelObjective,
): ServiceLevelObjective {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported SLO schemaVersion");
  }
  const warningBurnRate = positiveFinite(
    input.warningBurnRate,
    "warningBurnRate",
  );
  const criticalBurnRate = positiveFinite(
    input.criticalBurnRate,
    "criticalBurnRate",
  );
  if (criticalBurnRate < warningBurnRate) {
    throw new RangeError(
      "criticalBurnRate must be greater than or equal to warningBurnRate",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    key: bounded(input.key, "slo.key", 3, 160).toLowerCase(),
    description: bounded(input.description, "slo.description", 1, 500),
    metricKind: normalizeMetricKind(input.metricKind),
    targetGoodRatio: ratio(input.targetGoodRatio, "targetGoodRatio"),
    windowMinutes: positiveInteger(input.windowMinutes, "windowMinutes", 43_200),
    minimumEvents: positiveInteger(input.minimumEvents, "minimumEvents"),
    warningBurnRate,
    criticalBurnRate,
    maxObservationAgeSeconds: positiveInteger(
      input.maxObservationAgeSeconds,
      "maxObservationAgeSeconds",
      604_800,
    ),
  });
}

export function normalizeSloObservation(
  input: SloObservation,
): SloObservation {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported SLO observation schemaVersion");
  }
  const totalEvents = nonNegativeInteger(input.totalEvents, "totalEvents");
  const goodEvents = nonNegativeInteger(input.goodEvents, "goodEvents");
  if (goodEvents > totalEvents) {
    throw new RangeError("goodEvents cannot exceed totalEvents");
  }

  const windowStartedAt = toInstant(input.windowStartedAt);
  const windowEndedAt = toInstant(input.windowEndedAt);
  const observedAt = toInstant(input.observedAt);
  if (windowEndedAt < windowStartedAt) {
    throw new Error("SLO observation window cannot end before it starts");
  }
  if (observedAt < windowEndedAt) {
    throw new Error("SLO observation cannot be recorded before its window ends");
  }

  return Object.freeze({
    schemaVersion: 1,
    sloKey: bounded(input.sloKey, "sloKey", 3, 160).toLowerCase(),
    goodEvents,
    totalEvents,
    windowStartedAt,
    windowEndedAt,
    observedAt,
  });
}

function evidenceAgeSeconds(observedAt: Instant, now: Instant): number {
  const observed = Date.parse(observedAt);
  const current = Date.parse(now);
  if (current < observed) {
    throw new Error("evaluation time cannot predate observation");
  }
  return Math.floor((current - observed) / 1000);
}

export function evaluateSloObservation(input: {
  readonly objective: ServiceLevelObjective;
  readonly observation: SloObservation;
  readonly now: Instant;
}): SloEvaluation {
  const objective = normalizeServiceLevelObjective(input.objective);
  const observation = normalizeSloObservation(input.observation);
  const now = toInstant(input.now);

  if (observation.sloKey !== objective.key) {
    throw new Error("SLO observation key does not match objective");
  }

  const ageSeconds = evidenceAgeSeconds(observation.observedAt, now);
  if (ageSeconds > objective.maxObservationAgeSeconds) {
    return Object.freeze({
      sloKey: objective.key,
      status: "insufficient-data" as const,
      totalEvents: observation.totalEvents,
      goodEvents: observation.goodEvents,
      goodRatio: null,
      badRatio: null,
      burnRate: null,
      remainingErrorBudgetRatio: null,
      evidenceAgeSeconds: ageSeconds,
      reasonCode: "observation-stale" as const,
      observedAt: observation.observedAt,
    });
  }

  if (observation.totalEvents < objective.minimumEvents) {
    return Object.freeze({
      sloKey: objective.key,
      status: "insufficient-data" as const,
      totalEvents: observation.totalEvents,
      goodEvents: observation.goodEvents,
      goodRatio:
        observation.totalEvents === 0
          ? null
          : observation.goodEvents / observation.totalEvents,
      badRatio:
        observation.totalEvents === 0
          ? null
          : 1 - observation.goodEvents / observation.totalEvents,
      burnRate: null,
      remainingErrorBudgetRatio: null,
      evidenceAgeSeconds: ageSeconds,
      reasonCode: "minimum-events-not-met" as const,
      observedAt: observation.observedAt,
    });
  }

  const goodRatio = observation.goodEvents / observation.totalEvents;
  const badRatio = 1 - goodRatio;
  const allowedBadRatio = 1 - objective.targetGoodRatio;
  const burnRate = badRatio / allowedBadRatio;
  const remainingErrorBudgetRatio = Math.max(0, 1 - burnRate);

  const critical = burnRate >= objective.criticalBurnRate;
  const warning = !critical && burnRate >= objective.warningBurnRate;

  return Object.freeze({
    sloKey: objective.key,
    status: critical ? "critical" : warning ? "warning" : "healthy",
    totalEvents: observation.totalEvents,
    goodEvents: observation.goodEvents,
    goodRatio,
    badRatio,
    burnRate,
    remainingErrorBudgetRatio,
    evidenceAgeSeconds: ageSeconds,
    reasonCode: critical
      ? "critical-burn-rate"
      : warning
        ? "warning-burn-rate"
        : "ok",
    observedAt: observation.observedAt,
  });
}

function normalizeQueueSnapshot(
  input: ReconciliationQueueSnapshot,
): ReconciliationQueueSnapshot {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported reconciliation queue snapshot schemaVersion");
  }
  const pending = nonNegativeInteger(input.pending, "pending");
  const unknown = nonNegativeInteger(input.unknown, "unknown");
  const manualReview = nonNegativeInteger(input.manualReview, "manualReview");
  const retryable = nonNegativeInteger(input.retryable, "retryable");
  const oldestAgeSeconds = nonNegativeInteger(
    input.oldestAgeSeconds,
    "oldestAgeSeconds",
  );
  if (unknown > pending || manualReview > pending || retryable > pending) {
    throw new Error(
      "reconciliation queue subsets cannot exceed pending count",
    );
  }
  if (pending === 0 && oldestAgeSeconds !== 0) {
    throw new Error("empty reconciliation queue must have zero oldest age");
  }

  return Object.freeze({
    schemaVersion: 1,
    queueKey: bounded(input.queueKey, "queueKey", 3, 160).toLowerCase(),
    pending,
    unknown,
    manualReview,
    retryable,
    oldestAgeSeconds,
    observedAt: toInstant(input.observedAt),
  });
}

function thresholdPair(
  warning: number,
  critical: number,
  name: string,
): readonly [number, number] {
  const normalizedWarning = nonNegativeInteger(warning, `warning${name}`);
  const normalizedCritical = nonNegativeInteger(critical, `critical${name}`);
  if (normalizedCritical < normalizedWarning) {
    throw new RangeError(
      `critical${name} must be greater than or equal to warning${name}`,
    );
  }
  return [normalizedWarning, normalizedCritical] as const;
}

function normalizeQueueThresholds(
  input: ReconciliationQueueThresholds,
): ReconciliationQueueThresholds {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported reconciliation queue thresholds schemaVersion");
  }
  const [warningPending, criticalPending] = thresholdPair(
    input.warningPending,
    input.criticalPending,
    "Pending",
  );
  const [warningUnknown, criticalUnknown] = thresholdPair(
    input.warningUnknown,
    input.criticalUnknown,
    "Unknown",
  );
  const [warningManualReview, criticalManualReview] = thresholdPair(
    input.warningManualReview,
    input.criticalManualReview,
    "ManualReview",
  );
  const [warningOldestAgeSeconds, criticalOldestAgeSeconds] = thresholdPair(
    input.warningOldestAgeSeconds,
    input.criticalOldestAgeSeconds,
    "OldestAgeSeconds",
  );

  return Object.freeze({
    schemaVersion: 1,
    queueKey: bounded(input.queueKey, "queueKey", 3, 160).toLowerCase(),
    warningPending,
    criticalPending,
    warningUnknown,
    criticalUnknown,
    warningManualReview,
    criticalManualReview,
    warningOldestAgeSeconds,
    criticalOldestAgeSeconds,
    maxObservationAgeSeconds: positiveInteger(
      input.maxObservationAgeSeconds,
      "maxObservationAgeSeconds",
      604_800,
    ),
  });
}

export function evaluateReconciliationQueue(input: {
  readonly snapshot: ReconciliationQueueSnapshot;
  readonly thresholds: ReconciliationQueueThresholds;
  readonly now: Instant;
}): ReconciliationQueueEvaluation {
  const snapshot = normalizeQueueSnapshot(input.snapshot);
  const thresholds = normalizeQueueThresholds(input.thresholds);
  const now = toInstant(input.now);

  if (snapshot.queueKey !== thresholds.queueKey) {
    throw new Error("reconciliation queue snapshot key does not match thresholds");
  }

  const ageSeconds = evidenceAgeSeconds(snapshot.observedAt, now);
  if (ageSeconds > thresholds.maxObservationAgeSeconds) {
    return Object.freeze({
      queueKey: snapshot.queueKey,
      status: "insufficient-data" as const,
      reasons: Object.freeze(["observation-stale"]),
      snapshot,
      evidenceAgeSeconds: ageSeconds,
    });
  }

  const criticalReasons: string[] = [];
  const warningReasons: string[] = [];

  function classify(
    value: number,
    warning: number,
    critical: number,
    name: string,
  ): void {
    if (value >= critical && critical > 0) {
      criticalReasons.push(name);
    } else if (value >= warning && warning > 0) {
      warningReasons.push(name);
    }
  }

  classify(
    snapshot.pending,
    thresholds.warningPending,
    thresholds.criticalPending,
    "pending",
  );
  classify(
    snapshot.unknown,
    thresholds.warningUnknown,
    thresholds.criticalUnknown,
    "unknown",
  );
  classify(
    snapshot.manualReview,
    thresholds.warningManualReview,
    thresholds.criticalManualReview,
    "manual-review",
  );
  classify(
    snapshot.oldestAgeSeconds,
    thresholds.warningOldestAgeSeconds,
    thresholds.criticalOldestAgeSeconds,
    "oldest-age",
  );

  if (criticalReasons.length > 0) {
    return Object.freeze({
      queueKey: snapshot.queueKey,
      status: "critical" as const,
      reasons: Object.freeze(criticalReasons),
      snapshot,
      evidenceAgeSeconds: ageSeconds,
    });
  }
  if (warningReasons.length > 0) {
    return Object.freeze({
      queueKey: snapshot.queueKey,
      status: "warning" as const,
      reasons: Object.freeze(warningReasons),
      snapshot,
      evidenceAgeSeconds: ageSeconds,
    });
  }

  return Object.freeze({
    queueKey: snapshot.queueKey,
    status: "healthy" as const,
    reasons: Object.freeze([]),
    snapshot,
    evidenceAgeSeconds: ageSeconds,
  });
}

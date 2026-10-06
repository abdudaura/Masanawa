export type OpsAlertKind =
  | "availability-slo"
  | "latency-slo"
  | "no-signal"
  | "reconciliation-backlog"
  | "reconciliation-needs-attention"
  | "reconciliation-stale";

export type OpsAlertSeverity = "warning" | "critical";

export interface OperationalSloPolicy {
  readonly schemaVersion: 1;
  readonly serviceKey: string;
  readonly availabilityObjectiveBasisPoints: number;
  readonly maxP95LatencyMs: number;
  readonly maxSignalAgeMinutes: number;
  readonly maxOpenReconciliationCases: number;
  readonly maxNeedsAttentionCases: number;
  readonly maxOldestReconciliationAgeMinutes: number;
  readonly runbookRef: string;
}

export interface OperationalWindowSample {
  readonly serviceKey: string;
  readonly observedAt: string;
  readonly windowMinutes: number;
  readonly totalRequests: number;
  readonly failedRequests: number;
  readonly p95LatencyMs: number;
  readonly lastSignalAt: string;
  readonly openReconciliationCases: number;
  readonly needsAttentionCases: number;
  readonly oldestActiveReconciliationAgeMinutes: number;
}

export interface OpsAlert {
  readonly kind: OpsAlertKind;
  readonly severity: OpsAlertSeverity;
  readonly serviceKey: string;
  readonly detail: string;
  readonly runbookRef: string;
}

export interface OperationalReadinessResult {
  readonly passed: boolean;
  readonly availabilityBasisPoints: number | null;
  readonly alerts: readonly OpsAlert[];
}

export type OpsIncidentState =
  | "open"
  | "acknowledged"
  | "mitigated"
  | "resolved";

export interface OpsIncident {
  readonly incidentId: string;
  readonly serviceKey: string;
  readonly severity: OpsAlertSeverity;
  readonly state: OpsIncidentState;
  readonly alertKinds: readonly OpsAlertKind[];
  readonly runbookRef: string;
  readonly revision: number;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function integer(value: number, name: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function instant(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

export function normalizeOperationalSloPolicy(
  input: OperationalSloPolicy,
): OperationalSloPolicy {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported operational SLO policy");
  }
  return Object.freeze({
    schemaVersion: 1,
    serviceKey: bounded(input.serviceKey, "serviceKey", 1, 120).toLowerCase(),
    availabilityObjectiveBasisPoints: integer(
      input.availabilityObjectiveBasisPoints,
      "availabilityObjectiveBasisPoints",
      1,
      10_000,
    ),
    maxP95LatencyMs: integer(input.maxP95LatencyMs, "maxP95LatencyMs", 0),
    maxSignalAgeMinutes: integer(
      input.maxSignalAgeMinutes,
      "maxSignalAgeMinutes",
      1,
      24 * 60,
    ),
    maxOpenReconciliationCases: integer(
      input.maxOpenReconciliationCases,
      "maxOpenReconciliationCases",
      0,
    ),
    maxNeedsAttentionCases: integer(
      input.maxNeedsAttentionCases,
      "maxNeedsAttentionCases",
      0,
    ),
    maxOldestReconciliationAgeMinutes: integer(
      input.maxOldestReconciliationAgeMinutes,
      "maxOldestReconciliationAgeMinutes",
      0,
    ),
    runbookRef: bounded(input.runbookRef, "runbookRef", 1, 240),
  });
}

export function evaluateOperationalReadiness(input: {
  readonly policy: OperationalSloPolicy;
  readonly sample: OperationalWindowSample;
}): OperationalReadinessResult {
  const policy = normalizeOperationalSloPolicy(input.policy);
  const sample = input.sample;
  const serviceKey = bounded(sample.serviceKey, "sample.serviceKey", 1, 120).toLowerCase();
  if (serviceKey !== policy.serviceKey) {
    throw new Error("Operational sample service does not match SLO policy");
  }

  const observedAt = instant(sample.observedAt, "sample.observedAt");
  const lastSignalAt = instant(sample.lastSignalAt, "sample.lastSignalAt");
  const windowMinutes = integer(sample.windowMinutes, "windowMinutes", 1, 24 * 60);
  const totalRequests = integer(sample.totalRequests, "totalRequests", 0);
  const failedRequests = integer(sample.failedRequests, "failedRequests", 0);
  if (failedRequests > totalRequests) {
    throw new RangeError("failedRequests cannot exceed totalRequests");
  }
  const p95LatencyMs = integer(sample.p95LatencyMs, "p95LatencyMs", 0);
  const openReconciliationCases = integer(
    sample.openReconciliationCases,
    "openReconciliationCases",
    0,
  );
  const needsAttentionCases = integer(
    sample.needsAttentionCases,
    "needsAttentionCases",
    0,
  );
  const oldestActiveReconciliationAgeMinutes = integer(
    sample.oldestActiveReconciliationAgeMinutes,
    "oldestActiveReconciliationAgeMinutes",
    0,
  );

  const alerts: OpsAlert[] = [];
  const add = (
    kind: OpsAlertKind,
    severity: OpsAlertSeverity,
    detail: string,
  ) => {
    alerts.push(
      Object.freeze({
        kind,
        severity,
        serviceKey,
        detail,
        runbookRef: policy.runbookRef,
      }),
    );
  };

  const observedMs = new Date(observedAt).getTime();
  const lastSignalMs = new Date(lastSignalAt).getTime();
  if (lastSignalMs > observedMs) {
    throw new Error("lastSignalAt cannot be after observedAt");
  }
  const signalAgeMinutes = Math.floor((observedMs - lastSignalMs) / 60_000);
  if (signalAgeMinutes > policy.maxSignalAgeMinutes) {
    add(
      "no-signal",
      "critical",
      `last signal age ${signalAgeMinutes}m > ${policy.maxSignalAgeMinutes}m`,
    );
  }

  const availabilityBasisPoints =
    totalRequests === 0
      ? null
      : Math.floor(((totalRequests - failedRequests) * 10_000) / totalRequests);

  if (
    availabilityBasisPoints !== null &&
    availabilityBasisPoints < policy.availabilityObjectiveBasisPoints
  ) {
    add(
      "availability-slo",
      "critical",
      `availability ${availabilityBasisPoints}bp < ${policy.availabilityObjectiveBasisPoints}bp`,
    );
  }

  if (p95LatencyMs > policy.maxP95LatencyMs) {
    add(
      "latency-slo",
      "warning",
      `p95 latency ${p95LatencyMs}ms > ${policy.maxP95LatencyMs}ms`,
    );
  }

  if (openReconciliationCases > policy.maxOpenReconciliationCases) {
    add(
      "reconciliation-backlog",
      "warning",
      `open reconciliation ${openReconciliationCases} > ${policy.maxOpenReconciliationCases}`,
    );
  }

  if (needsAttentionCases > policy.maxNeedsAttentionCases) {
    add(
      "reconciliation-needs-attention",
      "critical",
      `needs-attention reconciliation ${needsAttentionCases} > ${policy.maxNeedsAttentionCases}`,
    );
  }

  if (
    oldestActiveReconciliationAgeMinutes >
    policy.maxOldestReconciliationAgeMinutes
  ) {
    add(
      "reconciliation-stale",
      "critical",
      `oldest reconciliation ${oldestActiveReconciliationAgeMinutes}m > ${policy.maxOldestReconciliationAgeMinutes}m`,
    );
  }

  void windowMinutes;
  return Object.freeze({
    passed: alerts.length === 0,
    availabilityBasisPoints,
    alerts: Object.freeze(alerts),
  });
}

export function createOpsIncident(input: {
  readonly incidentId: string;
  readonly serviceKey: string;
  readonly alerts: readonly OpsAlert[];
  readonly openedAt: string;
}): OpsIncident {
  if (!Array.isArray(input.alerts) || input.alerts.length < 1) {
    throw new Error("Incident requires at least one alert");
  }
  const serviceKey = bounded(input.serviceKey, "serviceKey", 1, 120).toLowerCase();
  if (input.alerts.some((alert) => alert.serviceKey !== serviceKey)) {
    throw new Error("Incident alerts must belong to the same service");
  }
  const runbooks = new Set(input.alerts.map((alert) => alert.runbookRef));
  if (runbooks.size !== 1) {
    throw new Error("Incident alerts must resolve to one runbook");
  }
  const severity: OpsAlertSeverity = input.alerts.some(
    (alert) => alert.severity === "critical",
  )
    ? "critical"
    : "warning";
  const openedAt = instant(input.openedAt, "openedAt");

  return Object.freeze({
    incidentId: bounded(input.incidentId, "incidentId", 8, 180),
    serviceKey,
    severity,
    state: "open",
    alertKinds: Object.freeze(
      [...new Set(input.alerts.map((alert) => alert.kind))].sort(),
    ),
    runbookRef: [...runbooks][0]!,
    revision: 1,
    openedAt,
    updatedAt: openedAt,
    resolvedAt: null,
  });
}

const incidentTransitions: Readonly<
  Record<OpsIncidentState, readonly OpsIncidentState[]>
> = Object.freeze({
  open: Object.freeze(["acknowledged"]),
  acknowledged: Object.freeze(["mitigated"]),
  mitigated: Object.freeze(["resolved"]),
  resolved: Object.freeze([]),
});

export function transitionOpsIncident(input: {
  readonly current: OpsIncident;
  readonly nextState: OpsIncidentState;
  readonly occurredAt: string;
}): OpsIncident {
  if (!incidentTransitions[input.current.state].includes(input.nextState)) {
    throw new Error(
      `Invalid incident transition: ${input.current.state} -> ${input.nextState}`,
    );
  }
  const occurredAt = instant(input.occurredAt, "occurredAt");
  if (occurredAt < input.current.updatedAt) {
    throw new Error("Incident transition cannot move backward in time");
  }

  return Object.freeze({
    ...input.current,
    state: input.nextState,
    revision: input.current.revision + 1,
    updatedAt: occurredAt,
    resolvedAt: input.nextState === "resolved" ? occurredAt : null,
  });
}

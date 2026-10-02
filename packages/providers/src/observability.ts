import {
  isCanonicalId,
  type CorrelationId,
  type OperationId,
  type ProviderId,
  type RequestId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  privacySafeAttributes,
  type PrivacySafeTelemetryAttributes,
} from "@masanawa/telemetry";
import {
  normalizeProviderKey,
  normalizeProviderVersion,
  providerReadinessStates,
  type ProviderReadinessState,
} from "./model.js";

export const providerExecutionOutcomes = [
  "succeeded",
  "accepted",
  "rejected",
  "partial",
  "unknown",
  "not-dispatched",
  "selection-failed",
] as const;

export type ProviderExecutionOutcome =
  (typeof providerExecutionOutcomes)[number];

export const providerFailureClasses = [
  "none",
  "readiness",
  "timeout",
  "rate-limit",
  "cost-limit",
  "authentication",
  "authorization",
  "provider-rejected",
  "transport",
  "invalid-response",
  "receipt-persistence",
  "internal",
] as const;

export type ProviderFailureClass =
  (typeof providerFailureClasses)[number];

export type ProviderExecutionCostClass =
  | "free"
  | "metered"
  | "external";

export interface ProviderExecutionObservation {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly operationId: OperationId;
  readonly toolVersionId: ToolVersionId;
  readonly providerId: ProviderId;
  readonly providerKey: string;
  readonly providerVersion: string;
  readonly readinessState: ProviderReadinessState;
  readonly outcome: ProviderExecutionOutcome;
  readonly failureClass: ProviderFailureClass;
  readonly durationMs: number;
  readonly timeoutMs: number;
  readonly costClass: ProviderExecutionCostClass;
}

export interface ProviderExecutionObserver {
  record(
    observation: ProviderExecutionObservation,
  ): void | Promise<void>;
}

const outcomeSet = new Set<string>(providerExecutionOutcomes);
const failureSet = new Set<string>(providerFailureClasses);
const readinessSet = new Set<string>(providerReadinessStates);
const costSet = new Set<string>(["free", "metered", "external"]);

function safeDuration(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeProviderExecutionObservation(
  input: ProviderExecutionObservation,
): ProviderExecutionObservation {
  if (!isCanonicalId("request", input.requestId)) {
    throw new TypeError("provider telemetry requestId is invalid");
  }
  if (!isCanonicalId("correlation", input.correlationId)) {
    throw new TypeError("provider telemetry correlationId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("provider telemetry operationId is invalid");
  }
  if (!isCanonicalId("tool-version", input.toolVersionId)) {
    throw new TypeError("provider telemetry toolVersionId is invalid");
  }
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("provider telemetry providerId is invalid");
  }
  if (!readinessSet.has(input.readinessState)) {
    throw new TypeError("provider telemetry readinessState is invalid");
  }
  if (!outcomeSet.has(input.outcome)) {
    throw new TypeError("provider telemetry outcome is invalid");
  }
  if (!failureSet.has(input.failureClass)) {
    throw new TypeError("provider telemetry failureClass is invalid");
  }
  if (!costSet.has(input.costClass)) {
    throw new TypeError("provider telemetry costClass is invalid");
  }
  if (
    input.failureClass === "none" &&
    (input.outcome === "rejected" ||
      input.outcome === "partial" ||
      input.outcome === "unknown" ||
      input.outcome === "not-dispatched" ||
      input.outcome === "selection-failed")
  ) {
    throw new TypeError(
      "failed/ambiguous provider telemetry requires a failureClass",
    );
  }

  return Object.freeze({
    requestId: input.requestId,
    correlationId: input.correlationId,
    operationId: input.operationId,
    toolVersionId: input.toolVersionId,
    providerId: input.providerId,
    providerKey: normalizeProviderKey(input.providerKey),
    providerVersion: normalizeProviderVersion(input.providerVersion),
    readinessState: input.readinessState,
    outcome: input.outcome,
    failureClass: input.failureClass,
    durationMs: safeDuration(
      input.durationMs,
      "provider telemetry durationMs",
      86_400_000,
    ),
    timeoutMs: safeDuration(
      input.timeoutMs,
      "provider telemetry timeoutMs",
      3_600_000,
    ),
    costClass: input.costClass,
  });
}

export function providerExecutionTelemetryAttributes(
  input: ProviderExecutionObservation,
): PrivacySafeTelemetryAttributes {
  const observation = normalizeProviderExecutionObservation(input);
  return privacySafeAttributes({
    "masanawa.request.id": observation.requestId,
    "masanawa.correlation.id": observation.correlationId,
    "masanawa.operation.id": observation.operationId,
    "masanawa.tool.version_id": observation.toolVersionId,
    "masanawa.provider.id": observation.providerId,
    "masanawa.provider.key": observation.providerKey,
    "masanawa.provider.version": observation.providerVersion,
    "masanawa.provider.readiness_state": observation.readinessState,
    "masanawa.provider.outcome": observation.outcome,
    "masanawa.provider.failure_class": observation.failureClass,
    "masanawa.provider.duration_ms": observation.durationMs,
    "masanawa.provider.timeout_ms": observation.timeoutMs,
    "masanawa.provider.cost_class": observation.costClass,
  });
}

export async function recordProviderExecutionSafely(
  observer: ProviderExecutionObserver | null | undefined,
  input: ProviderExecutionObservation,
): Promise<boolean> {
  const observation = normalizeProviderExecutionObservation(input);
  if (!observer) {
    return false;
  }
  try {
    await observer.record(observation);
    return true;
  } catch {
    return false;
  }
}

import {
  PlatformError,
  isCanonicalId,
  normalizeCapabilityKey,
  type CapabilityKey,
  type OperationId,
  type ProviderId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  privacySafeAttributes,
  type PrivacySafeTelemetryAttributes,
} from "@masanawa/telemetry";
import type {
  ProviderDefinition,
  ProviderReadiness,
} from "./model.js";

export const providerFailureKinds = [
  "timeout",
  "rate-limit",
  "unavailable",
  "authentication",
  "cost-limit",
  "invalid-response",
  "transport",
  "internal",
] as const;

export type ProviderFailureKind =
  (typeof providerFailureKinds)[number];

export const providerFailurePhases = [
  "pre-dispatch",
  "dispatch",
  "post-dispatch",
] as const;

export type ProviderFailurePhase =
  (typeof providerFailurePhases)[number];

export const providerDispatchCertainties = [
  "not-dispatched",
  "unknown",
] as const;

export type ProviderDispatchCertainty =
  (typeof providerDispatchCertainties)[number];

export interface ProviderFailure {
  readonly kind: ProviderFailureKind;
  readonly code: string;
  readonly phase: ProviderFailurePhase;
  readonly dispatchCertainty: ProviderDispatchCertainty;
  readonly retryable: boolean;
  readonly timeoutMs: number | null;
  readonly retryAfterMs: number | null;
}

export interface ProviderExecutionTelemetry {
  readonly providerId: ProviderId;
  readonly providerKey: string;
  readonly providerVersion: string;
  readonly capability: CapabilityKey;
  readonly toolVersionId: ToolVersionId | null;
  readonly operationId: OperationId | null;
  readonly outcome:
    | "succeeded"
    | "accepted"
    | "rejected"
    | "partial"
    | "unknown"
    | "failed";
  readonly latencyMs: number;
  readonly costMicros: number | null;
  readonly inputUnits: number | null;
  readonly outputUnits: number | null;
  readonly failure: ProviderFailure | null;
}

const failureKindSet = new Set<string>(providerFailureKinds);
const failurePhaseSet = new Set<string>(providerFailurePhases);
const dispatchCertaintySet = new Set<string>(
  providerDispatchCertainties,
);
const codePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function boundedCode(value: string, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 200 ||
    !codePattern.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function nullableDuration(
  value: number | null,
  name: string,
): number | null {
  if (value === null) {
    return null;
  }
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 86_400_000
  ) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function nullableCounter(
  value: number | null,
  name: string,
): number | null {
  if (value === null) {
    return null;
  }
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeProviderFailure(
  input: ProviderFailure,
): ProviderFailure {
  if (!failureKindSet.has(input.kind)) {
    throw new TypeError("provider failure kind is invalid");
  }
  if (!failurePhaseSet.has(input.phase)) {
    throw new TypeError("provider failure phase is invalid");
  }
  if (!dispatchCertaintySet.has(input.dispatchCertainty)) {
    throw new TypeError(
      "provider failure dispatch certainty is invalid",
    );
  }

  return Object.freeze({
    kind: input.kind,
    code: boundedCode(input.code, "provider failure code"),
    phase: input.phase,
    dispatchCertainty: input.dispatchCertainty,
    retryable: input.retryable === true,
    timeoutMs: nullableDuration(
      input.timeoutMs,
      "provider failure timeoutMs",
    ),
    retryAfterMs: nullableDuration(
      input.retryAfterMs,
      "provider failure retryAfterMs",
    ),
  });
}

export class ProviderExecutionError extends Error {
  readonly failure: ProviderFailure;

  constructor(failure: ProviderFailure) {
    const normalized = normalizeProviderFailure(failure);
    super(normalized.code);
    this.name = "ProviderExecutionError";
    this.failure = normalized;
  }
}

export function isProviderExecutionError(
  value: unknown,
): value is ProviderExecutionError {
  return value instanceof ProviderExecutionError;
}

export function providerFailureToPlatformError(
  failure: ProviderFailure,
  operationId?: OperationId,
): PlatformError {
  const normalized = normalizeProviderFailure(failure);
  const category =
    normalized.kind === "rate-limit"
      ? "rate-limit"
      : normalized.dispatchCertainty === "unknown"
        ? "ambiguous"
        : normalized.kind === "authentication"
          ? "authentication"
          : normalized.kind === "unavailable" ||
              normalized.kind === "timeout" ||
              normalized.kind === "transport"
            ? "unavailable"
            : "internal";

  return new PlatformError({
    code: `provider.${normalized.code}`,
    category,
    message: "Provider execution failed",
    retryable:
      normalized.dispatchCertainty === "not-dispatched" &&
      normalized.retryable,
    ...(operationId !== undefined ? { operationId } : {}),
    details: {
      kind: normalized.kind,
      phase: normalized.phase,
      dispatchCertainty: normalized.dispatchCertainty,
      ...(normalized.timeoutMs !== null
        ? { timeoutMs: normalized.timeoutMs }
        : {}),
      ...(normalized.retryAfterMs !== null
        ? { retryAfterMs: normalized.retryAfterMs }
        : {}),
    },
  });
}

export function providerReadinessTelemetryAttributes(
  provider: ProviderDefinition,
  readiness: ProviderReadiness,
): PrivacySafeTelemetryAttributes {
  if (provider.providerId !== readiness.providerId) {
    throw new TypeError(
      "provider readiness telemetry identity mismatch",
    );
  }
  return privacySafeAttributes({
    "masanawa.provider.id": provider.providerId,
    "masanawa.provider.key": provider.key,
    "masanawa.provider.version": provider.version,
    "masanawa.provider.readiness": readiness.state,
    ...(readiness.reasonCode !== null
      ? { "masanawa.provider.reason_code": readiness.reasonCode }
      : {}),
  });
}

export function normalizeProviderExecutionTelemetry(
  input: ProviderExecutionTelemetry,
): ProviderExecutionTelemetry {
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("provider telemetry providerId is invalid");
  }
  if (
    input.toolVersionId !== null &&
    !isCanonicalId("tool-version", input.toolVersionId)
  ) {
    throw new TypeError("provider telemetry toolVersionId is invalid");
  }
  if (
    input.operationId !== null &&
    !isCanonicalId("operation", input.operationId)
  ) {
    throw new TypeError("provider telemetry operationId is invalid");
  }
  if (
    !Number.isSafeInteger(input.latencyMs) ||
    input.latencyMs < 0 ||
    input.latencyMs > 86_400_000
  ) {
    throw new RangeError("provider telemetry latencyMs is invalid");
  }

  return Object.freeze({
    providerId: input.providerId,
    providerKey: boundedCode(
      input.providerKey,
      "provider telemetry providerKey",
    ),
    providerVersion: boundedCode(
      input.providerVersion,
      "provider telemetry providerVersion",
    ),
    capability: normalizeCapabilityKey(input.capability),
    toolVersionId: input.toolVersionId,
    operationId: input.operationId,
    outcome: input.outcome,
    latencyMs: input.latencyMs,
    costMicros: nullableCounter(
      input.costMicros,
      "provider telemetry costMicros",
    ),
    inputUnits: nullableCounter(
      input.inputUnits,
      "provider telemetry inputUnits",
    ),
    outputUnits: nullableCounter(
      input.outputUnits,
      "provider telemetry outputUnits",
    ),
    failure:
      input.failure === null
        ? null
        : normalizeProviderFailure(input.failure),
  });
}

export function providerExecutionTelemetryAttributes(
  input: ProviderExecutionTelemetry,
): PrivacySafeTelemetryAttributes {
  const value = normalizeProviderExecutionTelemetry(input);
  return privacySafeAttributes({
    "masanawa.provider.id": value.providerId,
    "masanawa.provider.key": value.providerKey,
    "masanawa.provider.version": value.providerVersion,
    "masanawa.capability.key": value.capability,
    "masanawa.provider.outcome": value.outcome,
    "masanawa.provider.latency_ms": value.latencyMs,
    ...(value.toolVersionId !== null
      ? { "masanawa.tool_version.id": value.toolVersionId }
      : {}),
    ...(value.operationId !== null
      ? { "masanawa.operation.id": value.operationId }
      : {}),
    ...(value.costMicros !== null
      ? { "masanawa.provider.cost_micros": value.costMicros }
      : {}),
    ...(value.inputUnits !== null
      ? { "masanawa.provider.input_units": value.inputUnits }
      : {}),
    ...(value.outputUnits !== null
      ? { "masanawa.provider.output_units": value.outputUnits }
      : {}),
    ...(value.failure !== null
      ? {
          "masanawa.provider.failure_kind": value.failure.kind,
          "masanawa.provider.failure_code": value.failure.code,
          "masanawa.provider.failure_phase": value.failure.phase,
          "masanawa.provider.dispatch_certainty":
            value.failure.dispatchCertainty,
          ...(value.failure.timeoutMs !== null
            ? {
                "masanawa.provider.timeout_ms":
                  value.failure.timeoutMs,
              }
            : {}),
          ...(value.failure.retryAfterMs !== null
            ? {
                "masanawa.provider.retry_after_ms":
                  value.failure.retryAfterMs,
              }
            : {}),
        }
      : {}),
  });
}

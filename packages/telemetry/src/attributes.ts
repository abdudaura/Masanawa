import type { TelemetryCorrelation } from "./correlation.js";

export type TelemetryAttributeValue = string | number | boolean;

export type PrivacySafeTelemetryAttributes = Readonly<
  Record<string, TelemetryAttributeValue>
>;

export interface OpenTelemetryLogCorrelation {
  readonly trace_id: string;
  readonly span_id: string;
  readonly trace_flags: string;
}

export function logCorrelationFields(
  correlation: TelemetryCorrelation,
): OpenTelemetryLogCorrelation {
  return Object.freeze({
    trace_id: correlation.trace.traceId,
    span_id: correlation.trace.spanId,
    trace_flags: correlation.trace.traceFlags,
  });
}

const defaultSafeAttributeKeys = new Set([
  "trace_id",
  "span_id",
  "trace_flags",
  "service.name",
  "service.version",
  "deployment.environment.name",
  "http.request.method",
  "http.response.status_code",
  "error.type",
  "error.code",
  "masanawa.request.id",
  "masanawa.correlation.id",
  "masanawa.operation.id",
  "masanawa.task.id",
  "masanawa.workflow_run.id",
  "masanawa.character_session.id",
]);

export function correlationAttributes(
  correlation: TelemetryCorrelation,
): PrivacySafeTelemetryAttributes {
  return Object.freeze({
    ...logCorrelationFields(correlation),
    "masanawa.request.id": correlation.requestId,
    "masanawa.correlation.id": correlation.correlationId,
    ...(correlation.operationId
      ? { "masanawa.operation.id": correlation.operationId }
      : {}),
    ...(correlation.taskId ? { "masanawa.task.id": correlation.taskId } : {}),
    ...(correlation.workflowRunId
      ? { "masanawa.workflow_run.id": correlation.workflowRunId }
      : {}),
    ...(correlation.characterSessionId
      ? { "masanawa.character_session.id": correlation.characterSessionId }
      : {}),
  });
}

export function assertPrivacySafeAttributeKey(key: string): void {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    throw new TypeError("telemetry attribute key is required");
  }
  if (!defaultSafeAttributeKeys.has(normalized)) {
    throw new TypeError(
      `telemetry attribute key is not in the default privacy-safe allowlist: ${key}`,
    );
  }
}

export function privacySafeAttributes(
  attributes: Readonly<Record<string, TelemetryAttributeValue>>,
): PrivacySafeTelemetryAttributes {
  const sanitized: Record<string, TelemetryAttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    assertPrivacySafeAttributeKey(key);
    sanitized[key] = value;
  }
  return Object.freeze(sanitized);
}

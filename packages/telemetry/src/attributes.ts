import type { TelemetryCorrelation } from "./correlation.js";

export type TelemetryAttributeValue = string | number | boolean;

export type PrivacySafeTelemetryAttributes = Readonly<
  Record<string, TelemetryAttributeValue>
>;

export function correlationAttributes(
  correlation: TelemetryCorrelation,
): PrivacySafeTelemetryAttributes {
  return Object.freeze({
    "trace.id": correlation.trace.traceId,
    "span.id": correlation.trace.spanId,
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

const forbiddenAttributeFragments = [
  "authorization",
  "cookie",
  "credential",
  "password",
  "secret",
  "token",
  "prompt",
  "message.content",
  "memory.content",
  "tool.output",
] as const;

export function assertPrivacySafeAttributeKey(key: string): void {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    throw new TypeError("telemetry attribute key is required");
  }
  if (
    forbiddenAttributeFragments.some((fragment) =>
      normalized.includes(fragment),
    )
  ) {
    throw new TypeError(`telemetry attribute key is not privacy-safe: ${key}`);
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

import {
  workflowRetryLimits,
  type WorkflowRetryDisposition,
  type WorkflowRetryFailureSignal,
  type WorkflowRetryPolicy,
} from "./retry-model.js";

const reasonCodePattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function positiveInteger(value: unknown, name: string, max: number): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 1 ||
    (value as number) > max
  ) {
    fail(`${name} must be an integer between 1 and ${max}`);
  }
  return value as number;
}

function normalizeReasonCode(value: string): string {
  if (
    !reasonCodePattern.test(value) ||
    value.length > workflowRetryLimits.maxReasonCodeLength
  ) {
    fail("reasonCode must use a stable bounded lowercase code format");
  }
  return value;
}

export function normalizeWorkflowRetryPolicy(
  input: WorkflowRetryPolicy,
): WorkflowRetryPolicy {
  const maxAttempts = positiveInteger(
    input.maxAttempts,
    "maxAttempts",
    workflowRetryLimits.maxAttempts,
  );
  const baseDelayMs = positiveInteger(
    input.baseDelayMs,
    "baseDelayMs",
    workflowRetryLimits.maxDelayMs,
  );
  const maxDelayMs = positiveInteger(
    input.maxDelayMs,
    "maxDelayMs",
    workflowRetryLimits.maxDelayMs,
  );
  const multiplier = positiveInteger(
    input.multiplier,
    "multiplier",
    workflowRetryLimits.maxMultiplier,
  );
  if (baseDelayMs > maxDelayMs) {
    fail("baseDelayMs cannot exceed maxDelayMs");
  }
  return Object.freeze({
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    multiplier,
  });
}

export function workflowRetryDelayMs(
  policy: WorkflowRetryPolicy,
  failureCount: number,
): number {
  const normalized = normalizeWorkflowRetryPolicy(policy);
  const count = positiveInteger(
    failureCount,
    "failureCount",
    workflowRetryLimits.maxAttempts,
  );

  let delay = normalized.baseDelayMs;
  for (let index = 1; index < count; index += 1) {
    if (delay >= normalized.maxDelayMs) {
      return normalized.maxDelayMs;
    }
    delay = Math.min(
      normalized.maxDelayMs,
      delay * normalized.multiplier,
    );
  }
  return Math.min(delay, normalized.maxDelayMs);
}

export function decideWorkflowRetryDisposition(
  policy: WorkflowRetryPolicy,
  signal: WorkflowRetryFailureSignal,
): WorkflowRetryDisposition {
  const normalized = normalizeWorkflowRetryPolicy(policy);
  const failureCount = positiveInteger(
    signal.failureCount,
    "failureCount",
    workflowRetryLimits.maxAttempts,
  );
  const reasonCode = normalizeReasonCode(signal.reasonCode);

  if (signal.uncertainOutcome || signal.operatorAttention) {
    return Object.freeze({
      kind: "needs-attention",
      failureCount,
      reasonCode,
    });
  }

  if (!signal.retryable || failureCount >= normalized.maxAttempts) {
    return Object.freeze({
      kind: "dead-letter",
      failureCount,
      reasonCode,
    });
  }

  return Object.freeze({
    kind: "retry-scheduled",
    failureCount,
    delayMs: workflowRetryDelayMs(normalized, failureCount),
    reasonCode,
  });
}

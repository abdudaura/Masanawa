import {
  PlatformError,
  normalizeCapabilityKey,
  type CapabilityKey,
  type OperationId,
  type ProviderId,
} from "@masanawa/contracts";

export const providerFailureKinds = [
  "readiness",
  "timeout",
  "rate-limit",
  "cost-limit",
  "authentication",
  "transport",
  "provider-rejected",
  "invalid-response",
] as const;

export type ProviderFailureKind = (typeof providerFailureKinds)[number];

export interface ProviderExecutionFailure {
  readonly kind: ProviderFailureKind;
  readonly code: string;
  readonly retryable: boolean;
  readonly dispatched: boolean;
  readonly safeMessage: string;
  readonly retryAfterMs: number | null;
}

export interface ProviderExecutionObservation {
  readonly operationId: OperationId;
  readonly providerId: ProviderId;
  readonly providerKey: string;
  readonly providerVersion: string;
  readonly capability: CapabilityKey;
  readonly outcome:
    | "succeeded"
    | "accepted"
    | "rejected"
    | "partial"
    | "unknown"
    | "not-dispatched"
    | "failed";
  readonly failure: ProviderExecutionFailure | null;
  readonly durationMs: number;
  readonly costUnits: number | null;
}

export interface ProviderExecutionObserver {
  observe(observation: ProviderExecutionObservation): void | Promise<void>;
}

const failureKindSet = new Set<string>(providerFailureKinds);
const codePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function bounded(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeProviderExecutionFailure(
  input: ProviderExecutionFailure,
): ProviderExecutionFailure {
  if (!failureKindSet.has(input.kind)) {
    throw new TypeError("provider failure kind is invalid");
  }
  const code = bounded(input.code, "provider failure code", 160).toLowerCase();
  if (!codePattern.test(code)) {
    throw new TypeError("provider failure code is invalid");
  }
  if (
    input.retryAfterMs !== null &&
    (!Number.isSafeInteger(input.retryAfterMs) || input.retryAfterMs < 0)
  ) {
    throw new RangeError("provider retryAfterMs is invalid");
  }
  return Object.freeze({
    kind: input.kind,
    code,
    retryable: input.retryable === true,
    dispatched: input.dispatched === true,
    safeMessage: bounded(input.safeMessage, "provider failure safeMessage", 300),
    retryAfterMs: input.retryAfterMs,
  });
}

export function providerFailureError(
  failure: ProviderExecutionFailure,
  operationId?: OperationId,
): PlatformError {
  const normalized = normalizeProviderExecutionFailure(failure);
  return new PlatformError({
    code: `provider.${normalized.code}`,
    category:
      normalized.kind === "authentication"
        ? "authorization"
        : normalized.kind === "rate-limit"
          ? "rate-limit"
          : normalized.kind === "readiness" ||
              normalized.kind === "cost-limit" ||
              normalized.kind === "timeout" ||
              normalized.kind === "transport"
            ? "unavailable"
            : normalized.kind === "invalid-response"
              ? "ambiguous"
              : "conflict",
    message: normalized.safeMessage,
    retryable: normalized.retryable,
    ...(operationId ? { operationId } : {}),
    details: {
      providerFailureKind: normalized.kind,
      dispatched: normalized.dispatched,
      ...(normalized.retryAfterMs === null
        ? {}
        : { retryAfterMs: normalized.retryAfterMs }),
    },
  });
}

export function normalizeProviderExecutionObservation(
  input: ProviderExecutionObservation,
): ProviderExecutionObservation {
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
    throw new RangeError("provider observation durationMs is invalid");
  }
  if (
    input.costUnits !== null &&
    (!Number.isFinite(input.costUnits) || input.costUnits < 0)
  ) {
    throw new RangeError("provider observation costUnits is invalid");
  }
  return Object.freeze({
    ...input,
    providerKey: bounded(input.providerKey, "provider observation key", 128),
    providerVersion: bounded(
      input.providerVersion,
      "provider observation version",
      128,
    ),
    capability: normalizeCapabilityKey(input.capability),
    failure:
      input.failure === null
        ? null
        : normalizeProviderExecutionFailure(input.failure),
  });
}

import {
  PlatformError,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  normalizeWorkflowExecutorLease,
  type WorkflowExecutorLease,
} from "./executor-lease.js";

export interface WorkflowExecutorHeartbeatPolicy {
  readonly renewAtFractionBps: number;
  readonly minimumSafetyMarginMs: number;
}

export type WorkflowExecutorHeartbeatDecision =
  | {
      readonly kind: "healthy";
      readonly nextCheckAt: Instant;
      readonly renewAt: Instant;
      readonly expiresAt: Instant;
    }
  | {
      readonly kind: "renew-now";
      readonly renewAt: Instant;
      readonly expiresAt: Instant;
    }
  | {
      readonly kind: "stop";
      readonly reason: "released" | "expired";
      readonly expiresAt: Instant;
    };

function boundedPolicy(
  input: WorkflowExecutorHeartbeatPolicy,
): WorkflowExecutorHeartbeatPolicy {
  if (
    !Number.isSafeInteger(input.renewAtFractionBps) ||
    input.renewAtFractionBps < 1_000 ||
    input.renewAtFractionBps > 9_000
  ) {
    throw new RangeError(
      "renewAtFractionBps must be between 1000 and 9000",
    );
  }
  if (
    !Number.isSafeInteger(input.minimumSafetyMarginMs) ||
    input.minimumSafetyMarginMs < 100 ||
    input.minimumSafetyMarginMs > 5 * 60_000
  ) {
    throw new RangeError(
      "minimumSafetyMarginMs must be between 100ms and 5 minutes",
    );
  }
  return Object.freeze({ ...input });
}

function instantMs(value: Instant): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new TypeError("Workflow executor heartbeat timestamp is invalid");
  }
  return ms;
}

function asInstant(ms: number): Instant {
  return toInstant(new Date(ms));
}

function staleTime(message: string): PlatformError {
  return new PlatformError({
    code: "workflows.executor_heartbeat_stale_time",
    category: "conflict",
    message,
    retryable: false,
  });
}

export function evaluateWorkflowExecutorHeartbeat(input: {
  readonly lease: WorkflowExecutorLease;
  readonly now: Instant;
  readonly policy: WorkflowExecutorHeartbeatPolicy;
}): WorkflowExecutorHeartbeatDecision {
  const lease = normalizeWorkflowExecutorLease(input.lease);
  const policy = boundedPolicy(input.policy);
  const now = toInstant(input.now);

  if (now < lease.renewedAt) {
    throw staleTime(
      "Workflow executor heartbeat observation moved backwards",
    );
  }

  const expiresAtMs = instantMs(lease.expiresAt);
  const renewedAtMs = instantMs(lease.renewedAt);
  const nowMs = instantMs(now);

  if (lease.state === "released") {
    return Object.freeze({
      kind: "stop" as const,
      reason: "released" as const,
      expiresAt: lease.expiresAt,
    });
  }
  if (nowMs >= expiresAtMs) {
    return Object.freeze({
      kind: "stop" as const,
      reason: "expired" as const,
      expiresAt: lease.expiresAt,
    });
  }

  const lifetimeMs = expiresAtMs - renewedAtMs;
  if (lifetimeMs <= 0) {
    throw new TypeError("Workflow executor lease lifetime is invalid");
  }

  const fractionRenewAtMs =
    renewedAtMs +
    Math.floor((lifetimeMs * policy.renewAtFractionBps) / 10_000);
  const safetyRenewAtMs =
    expiresAtMs - Math.min(policy.minimumSafetyMarginMs, lifetimeMs - 1);
  const renewAtMs = Math.min(fractionRenewAtMs, safetyRenewAtMs);

  if (nowMs >= renewAtMs) {
    return Object.freeze({
      kind: "renew-now" as const,
      renewAt: asInstant(renewAtMs),
      expiresAt: lease.expiresAt,
    });
  }

  const remainingUntilRenewMs = renewAtMs - nowMs;
  const nextCheckDeltaMs = Math.max(
    1,
    Math.min(
      Math.floor(remainingUntilRenewMs / 2),
      policy.minimumSafetyMarginMs,
    ),
  );
  const nextCheckMs = Math.min(nowMs + nextCheckDeltaMs, renewAtMs);

  return Object.freeze({
    kind: "healthy" as const,
    nextCheckAt: asInstant(nextCheckMs),
    renewAt: asInstant(renewAtMs),
    expiresAt: lease.expiresAt,
  });
}

export function createWorkflowExecutorHeartbeatPolicy(
  input: WorkflowExecutorHeartbeatPolicy,
): WorkflowExecutorHeartbeatPolicy {
  return boundedPolicy(input);
}

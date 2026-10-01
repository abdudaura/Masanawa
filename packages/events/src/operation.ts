import type {
  Instant,
  OperationId,
  TenantId,
} from "@masanawa/contracts";
import { PlatformError } from "@masanawa/contracts";

export const operationStates = [
  "prepared",
  "authorized",
  "dispatching",
  "dispatched",
  "accepted",
  "rejected",
  "partial",
  "unknown",
  "reconciling",
  "succeeded",
  "failed",
] as const;

export type OperationState = (typeof operationStates)[number];

export interface OperationRecord {
  readonly operationId: OperationId;
  readonly tenantId: TenantId;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly authorityScopeHash: string;
  readonly requestFingerprint: string;
  readonly state: OperationState;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

const allowedTransitions: Readonly<Record<OperationState, ReadonlySet<OperationState>>> = {
  prepared: new Set(["authorized", "rejected", "failed"]),
  authorized: new Set(["dispatching", "rejected", "failed"]),
  dispatching: new Set(["dispatched", "rejected", "unknown", "failed"]),
  dispatched: new Set(["accepted", "rejected", "partial", "unknown"]),
  accepted: new Set(["reconciling", "succeeded", "failed"]),
  rejected: new Set(),
  partial: new Set(["reconciling", "succeeded", "failed"]),
  unknown: new Set(["reconciling"]),
  reconciling: new Set(["accepted", "rejected", "partial", "unknown", "succeeded", "failed"]),
  succeeded: new Set(),
  failed: new Set(),
};

export function canTransitionOperation(
  from: OperationState,
  to: OperationState,
): boolean {
  return allowedTransitions[from].has(to);
}

export function assertOperationTransition(
  from: OperationState,
  to: OperationState,
): void {
  if (!canTransitionOperation(from, to)) {
    throw new PlatformError({
      code: "operation.invalid_transition",
      category: "conflict",
      message: `Operation cannot transition from ${from} to ${to}`,
      retryable: false,
      details: { from, to },
    });
  }
}

export function isTerminalOperationState(state: OperationState): boolean {
  return state === "rejected" || state === "succeeded" || state === "failed";
}

export function isAmbiguousOperationState(state: OperationState): boolean {
  return state === "partial" || state === "unknown" || state === "reconciling";
}

import { PlatformError } from "@masanawa/contracts";

export const reconciliationStatuses = [
  "open",
  "checking",
  "resolved",
  "needs-attention",
] as const;

export type ReconciliationStatus = (typeof reconciliationStatuses)[number];

const allowedReconciliationTransitions: Readonly<
  Record<ReconciliationStatus, ReadonlySet<ReconciliationStatus>>
> = {
  open: new Set(["checking", "resolved", "needs-attention"]),
  checking: new Set(["open", "resolved", "needs-attention"]),
  "needs-attention": new Set(["checking", "resolved"]),
  resolved: new Set(),
};

export function canTransitionReconciliation(
  from: ReconciliationStatus,
  to: ReconciliationStatus,
): boolean {
  return allowedReconciliationTransitions[from].has(to);
}

export function assertReconciliationTransition(
  from: ReconciliationStatus,
  to: ReconciliationStatus,
): void {
  if (!canTransitionReconciliation(from, to)) {
    throw new PlatformError({
      code: "reconciliation.invalid_transition",
      category: "conflict",
      message: `Reconciliation case cannot transition from ${from} to ${to}`,
      retryable: false,
      details: { from, to },
    });
  }
}

export function isActiveReconciliationStatus(
  status: ReconciliationStatus,
): boolean {
  return status !== "resolved";
}

/**
 * Pure account deletion lifecycle. Persistence, authentication, revocation,
 * financial reconciliation and processor cleanup belong to the integration worker.
 * The state alone never represents a completed deletion.
 */
export type AccountDeletionPhase =
  | "requested"
  | "identity-verified"
  | "awaiting-settlement"
  | "processing"
  | "completed"
  | "failed";

export interface AccountDeletionRequest {
  readonly requestId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly phase: AccountDeletionPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly outstandingObligations: readonly string[];
  readonly lastErrorCode?: string;
}

const validTransitions: Record<AccountDeletionPhase, readonly AccountDeletionPhase[]> = {
  requested: ["identity-verified", "failed"],
  "identity-verified": ["awaiting-settlement", "processing", "failed"],
  "awaiting-settlement": ["processing", "failed"],
  processing: ["awaiting-settlement", "completed", "failed"],
  failed: ["identity-verified", "awaiting-settlement", "processing"],
  completed: [],
};

export function openAccountDeletionRequest(input: {
  requestId: string;
  tenantId: string;
  userId: string;
  now: string;
}): AccountDeletionRequest {
  if (!input.requestId.trim() || !input.tenantId.trim() || !input.userId.trim()) {
    throw new Error("account_deletion.invalid_identity");
  }
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error("account_deletion.invalid_time");
  }
  return {
    ...input,
    phase: "requested",
    createdAt: input.now,
    updatedAt: input.now,
    revision: 1,
    outstandingObligations: [],
  };
}

export function transitionAccountDeletion(
  current: AccountDeletionRequest,
  input: {
    target: AccountDeletionPhase;
    expectedRevision: number;
    now: string;
    identityReauthenticated?: boolean;
    cleanupComplete?: boolean;
    outstandingObligations?: readonly string[];
    errorCode?: string;
  },
): AccountDeletionRequest {
  if (current.revision !== input.expectedRevision) {
    throw new Error("account_deletion.conflict");
  }
  if (input.target === current.phase) return current;
  if (!validTransitions[current.phase].includes(input.target)) {
    throw new Error("account_deletion.invalid_transition");
  }
  if (!Number.isFinite(Date.parse(input.now)) || Date.parse(input.now) < Date.parse(current.updatedAt)) {
    throw new Error("account_deletion.invalid_time");
  }
  if (input.target === "identity-verified" && input.identityReauthenticated !== true) {
    throw new Error("account_deletion.reauthentication_required");
  }
  const obligations = input.outstandingObligations ?? current.outstandingObligations;
  if (input.target === "completed" && (input.cleanupComplete !== true || obligations.length !== 0)) {
    throw new Error("account_deletion.cleanup_incomplete");
  }
  if (input.target === "processing" && obligations.length > 0) {
    throw new Error("account_deletion.outstanding_obligations");
  }
  if (input.target === "failed" && !input.errorCode?.trim()) {
    throw new Error("account_deletion.failure_reason_required");
  }
  return {
    ...current,
    phase: input.target,
    updatedAt: input.now,
    revision: current.revision + 1,
    outstandingObligations: [...obligations],
    lastErrorCode: input.target === "failed" ? input.errorCode : undefined,
  };
}

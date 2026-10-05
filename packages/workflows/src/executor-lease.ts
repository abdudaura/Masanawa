import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
  type TenantId,
  type WorkflowRunId,
} from "@masanawa/contracts";
import type {
  WorkflowRunState,
} from "./workflow-run.js";

export interface WorkflowExecutorLease {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly holderId: string;
  readonly fence: number;
  readonly state: "held" | "released";
  readonly acquiredAt: Instant;
  readonly renewedAt: Instant;
  readonly expiresAt: Instant;
  readonly releasedAt: Instant | null;
}

export interface WorkflowExecutorLeaseRepository {
  acquire(input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly holderId: string;
    readonly runState: WorkflowRunState;
    readonly now: Instant;
    readonly durationMs: number;
  }): Promise<WorkflowExecutorLease>;

  renew(input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly holderId: string;
    readonly fence: number;
    readonly now: Instant;
    readonly durationMs: number;
  }): Promise<WorkflowExecutorLease>;

  read(input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
  }): Promise<WorkflowExecutorLease | null>;

  release(input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly holderId: string;
    readonly fence: number;
    readonly now: Instant;
  }): Promise<WorkflowExecutorLease>;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function holderId(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("Workflow executor holderId must be a string");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(normalized)
  ) {
    throw new TypeError("Workflow executor holderId is invalid");
  }
  return normalized;
}

function fence(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("Workflow executor fence is invalid");
  }
  return value;
}

function duration(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1_000 ||
    value > 15 * 60_000
  ) {
    throw new RangeError(
      "Workflow executor lease duration must be between 1 second and 15 minutes",
    );
  }
  return value;
}

function addMs(at: Instant, durationMs: number): Instant {
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) {
    throw new TypeError("Workflow executor lease timestamp is invalid");
  }
  return toInstant(new Date(ms + durationMs));
}

function terminal(state: WorkflowRunState): boolean {
  return state === "completed" || state === "failed" || state === "cancelled";
}

export function normalizeWorkflowExecutorLease(
  input: WorkflowExecutorLease,
): WorkflowExecutorLease {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.schemaVersion !== 1
  ) {
    throw new TypeError("WorkflowExecutorLease schema is invalid");
  }
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const workflowRunId = parseCanonicalId("workflow-run", input.workflowRunId);
  const acquiredAt = toInstant(input.acquiredAt);
  const renewedAt = toInstant(input.renewedAt);
  const expiresAt = toInstant(input.expiresAt);
  const releasedAt =
    input.releasedAt === null ? null : toInstant(input.releasedAt);
  if (
    (input.state !== "held" && input.state !== "released") ||
    renewedAt < acquiredAt ||
    expiresAt <= renewedAt ||
    (input.state === "held" && releasedAt !== null) ||
    (input.state === "released" &&
      (releasedAt === null || releasedAt < renewedAt))
  ) {
    throw new TypeError("WorkflowExecutorLease lifecycle is invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId,
    workflowRunId,
    holderId: holderId(input.holderId),
    fence: fence(input.fence),
    state: input.state,
    acquiredAt,
    renewedAt,
    expiresAt,
    releasedAt,
  });
}

export function planWorkflowExecutorLeaseAcquire(input: {
  readonly current: WorkflowExecutorLease | null;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly holderId: string;
  readonly runState: WorkflowRunState;
  readonly now: Instant;
  readonly durationMs: number;
}): WorkflowExecutorLease {
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const workflowRunId = parseCanonicalId("workflow-run", input.workflowRunId);
  const requestedHolderId = holderId(input.holderId);
  const now = toInstant(input.now);
  const durationMs = duration(input.durationMs);

  if (terminal(input.runState)) {
    throw conflict(
      "workflows.executor_lease_terminal",
      "Terminal WorkflowRun cannot acquire an execution lease",
    );
  }

  if (input.current === null) {
    return normalizeWorkflowExecutorLease({
      schemaVersion: 1,
      tenantId,
      workflowRunId,
      holderId: requestedHolderId,
      fence: 1,
      state: "held",
      acquiredAt: now,
      renewedAt: now,
      expiresAt: addMs(now, durationMs),
      releasedAt: null,
    });
  }

  const current = normalizeWorkflowExecutorLease(input.current);
  if (
    current.tenantId !== tenantId ||
    current.workflowRunId !== workflowRunId
  ) {
    throw conflict(
      "workflows.executor_lease_scope_mismatch",
      "Existing executor lease belongs to different Work",
    );
  }

  if (current.state === "held" && current.expiresAt > now) {
    if (current.holderId === requestedHolderId) {
      return current;
    }
    throw conflict(
      "workflows.executor_lease_held",
      "WorkflowRun execution lease is held by another active executor",
    );
  }

  if (current.fence >= Number.MAX_SAFE_INTEGER) {
    throw conflict(
      "workflows.executor_lease_fence_exhausted",
      "WorkflowRun executor fence is exhausted",
    );
  }

  return normalizeWorkflowExecutorLease({
    schemaVersion: 1,
    tenantId,
    workflowRunId,
    holderId: requestedHolderId,
    fence: current.fence + 1,
    state: "held",
    acquiredAt: now,
    renewedAt: now,
    expiresAt: addMs(now, durationMs),
    releasedAt: null,
  });
}

export function planWorkflowExecutorLeaseRenew(input: {
  readonly current: WorkflowExecutorLease;
  readonly holderId: string;
  readonly fence: number;
  readonly now: Instant;
  readonly durationMs: number;
}): WorkflowExecutorLease {
  const current = normalizeWorkflowExecutorLease(input.current);
  const now = toInstant(input.now);
  const requestedHolderId = holderId(input.holderId);
  const requestedFence = fence(input.fence);
  const durationMs = duration(input.durationMs);

  if (
    current.state !== "held" ||
    current.holderId !== requestedHolderId ||
    current.fence !== requestedFence
  ) {
    throw conflict(
      "workflows.executor_lease_fenced",
      "Stale executor cannot renew this WorkflowRun lease",
    );
  }
  if (current.expiresAt <= now) {
    throw conflict(
      "workflows.executor_lease_expired",
      "Expired WorkflowRun executor lease cannot be renewed",
    );
  }
  if (now < current.renewedAt) {
    throw conflict(
      "workflows.executor_lease_stale_time",
      "WorkflowRun executor lease renewal time moved backwards",
    );
  }

  return normalizeWorkflowExecutorLease({
    ...current,
    renewedAt: now,
    expiresAt: addMs(now, durationMs),
  });
}

export function assertWorkflowExecutorLeaseHeld(input: {
  readonly lease: WorkflowExecutorLease;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly holderId: string;
  readonly fence: number;
  readonly at: Instant;
}): void {
  const lease = normalizeWorkflowExecutorLease(input.lease);
  const at = toInstant(input.at);
  if (
    lease.state !== "held" ||
    lease.tenantId !== parseCanonicalId("tenant", input.tenantId) ||
    lease.workflowRunId !==
      parseCanonicalId("workflow-run", input.workflowRunId) ||
    lease.holderId !== holderId(input.holderId) ||
    lease.fence !== fence(input.fence)
  ) {
    throw conflict(
      "workflows.executor_lease_fenced",
      "Executor does not hold the current WorkflowRun fence",
    );
  }
  if (lease.expiresAt <= at) {
    throw conflict(
      "workflows.executor_lease_expired",
      "WorkflowRun executor lease has expired",
    );
  }
  if (at < lease.renewedAt) {
    throw conflict(
      "workflows.executor_lease_stale_time",
      "WorkflowRun executor lease check time moved backwards",
    );
  }
}

export function planWorkflowExecutorLeaseRelease(input: {
  readonly lease: WorkflowExecutorLease;
  readonly holderId: string;
  readonly fence: number;
  readonly at: Instant;
}): WorkflowExecutorLease {
  const lease = normalizeWorkflowExecutorLease(input.lease);
  const at = toInstant(input.at);
  if (
    lease.state !== "held" ||
    lease.holderId !== holderId(input.holderId) ||
    lease.fence !== fence(input.fence)
  ) {
    throw conflict(
      "workflows.executor_lease_fenced",
      "Stale executor cannot release this WorkflowRun lease",
    );
  }
  if (at < lease.renewedAt) {
    throw conflict(
      "workflows.executor_lease_stale_time",
      "WorkflowRun executor lease release time moved backwards",
    );
  }
  return normalizeWorkflowExecutorLease({
    ...lease,
    state: "released",
    releasedAt: at,
  });
}

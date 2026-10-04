import type {
  Instant,
  TaskId,
  TenantId,
  UserId,
  WorkflowId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowRunLimits = Object.freeze({
  maxNodeKeyLength: 96,
  maxFailureCodeLength: 160,
  maxFailureMessageLength: 2_000,
  maxWaitReasonLength: 500,
  maxCancellationReasonLength: 500,
  maxTaskDepth: 32,
} as const);

export type WorkflowRunState =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskState =
  | "pending"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowRunFailure {
  readonly code: string;
  readonly message: string;
}

export interface WorkflowRun {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly initiatedByUserId: UserId | null;
  readonly state: WorkflowRunState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly startedAt: Instant | null;
  readonly terminalAt: Instant | null;
  readonly waitReason: string | null;
  readonly failure: WorkflowRunFailure | null;
  readonly cancellationReason: string | null;
}

export interface TaskLineage {
  readonly parentTaskId: TaskId | null;
  readonly rootTaskId: TaskId;
  readonly depth: number;
}

export interface WorkflowTask {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly nodeKey: string;
  readonly lineage: TaskLineage;
  readonly state: TaskState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly startedAt: Instant | null;
  readonly terminalAt: Instant | null;
  readonly waitReason: string | null;
  readonly failure: WorkflowRunFailure | null;
  readonly cancellationReason: string | null;
}

import type {
  Instant,
  OperationId,
  RequestId,
  WorkflowRunId,
} from "@masanawa/contracts";

export type WorkflowControlMode = "cancel" | "supersede";
export type WorkflowControlState =
  | "cancel-requested"
  | "cancelled"
  | "superseded";
export type WorkflowCompensationState =
  | "none"
  | "required"
  | "compensating"
  | "compensated"
  | "failed";

export interface WorkflowRunControl {
  readonly workflowRunId: WorkflowRunId;
  readonly controlRequestId: RequestId;
  readonly mode: WorkflowControlMode;
  readonly state: WorkflowControlState;
  readonly reason: string;
  readonly supersededByWorkflowRunId: WorkflowRunId | null;
  readonly compensationState: WorkflowCompensationState;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export type WorkflowCompensationStepState =
  | "planned"
  | "running"
  | "succeeded"
  | "failed";

export interface WorkflowCompensationStep {
  readonly workflowRunId: WorkflowRunId;
  readonly originalOperationId: OperationId;
  readonly compensationOperationId: OperationId;
  readonly state: WorkflowCompensationStepState;
  readonly reason: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

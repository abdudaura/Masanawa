import type {
  ApprovalId,
  Instant,
  RequestId,
  TaskId,
  TenantId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowHumanRequestLimits = Object.freeze({
  maxPromptLength: 4_000,
  maxResponseLength: 8_000,
} as const);

export type WorkflowHumanRequestKind =
  | "information"
  | "confirmation"
  | "approval";

export type WorkflowHumanRequestState =
  | "pending"
  | "answered"
  | "rejected"
  | "cancelled";

export type WorkflowHumanResponse = string | boolean | null;

export interface WorkflowHumanRequest {
  readonly tenantId: TenantId;
  readonly humanRequestId: RequestId;
  readonly workflowRunId: WorkflowRunId;
  readonly taskId: TaskId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly kind: WorkflowHumanRequestKind;
  readonly state: WorkflowHumanRequestState;
  readonly prompt: string;
  readonly approvalId: ApprovalId | null;
  readonly response: WorkflowHumanResponse;
  readonly requestedAt: Instant;
  readonly resolvedAt: Instant | null;
}

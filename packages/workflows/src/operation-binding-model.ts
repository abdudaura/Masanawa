import type {
  ExternalReceiptId,
  Instant,
  OperationId,
  TaskId,
  TenantId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export type WorkflowOperationRole =
  | "primary"
  | "verification"
  | "compensation";

export interface WorkflowOperationBinding {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly role: WorkflowOperationRole;
  readonly operationId: OperationId;
  readonly boundAt: Instant;
}

export type WorkflowOperationDisposition =
  | "pending"
  | "succeeded"
  | "failed"
  | "reconciliation-required"
  | "needs-attention";

export interface WorkflowOperationProjection {
  readonly operationId: OperationId;
  readonly disposition: WorkflowOperationDisposition;
  readonly receiptIds: readonly ExternalReceiptId[];
}

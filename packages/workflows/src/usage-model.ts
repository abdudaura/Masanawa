import type {
  EventId,
  Instant,
  OperationId,
  ProviderId,
  TaskId,
  TenantId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowUsageLimits = Object.freeze({
  maxCategoryLength: 64,
  maxProviderKeyLength: 160,
  maxModelKeyLength: 160,
  maxEvidenceKeyLength: 200,
  maxUnits: Number.MAX_SAFE_INTEGER,
  maxCostMicros: Number.MAX_SAFE_INTEGER,
  maxLatencyMs: 86_400_000,
} as const);

export type WorkflowUsageCategory =
  | "inference"
  | "tool"
  | "provider"
  | "workflow";

export interface WorkflowUsageEvidence {
  readonly usageEventId: EventId;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly taskId: TaskId | null;
  readonly operationId: OperationId | null;
  readonly providerId: ProviderId | null;
  readonly category: WorkflowUsageCategory;
  readonly providerKey: string | null;
  readonly modelKey: string | null;
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly costMicros: number;
  readonly latencyMs: number;
  readonly evidenceKey: string;
  readonly occurredAt: Instant;
}

export interface WorkflowUsageTotals {
  readonly recordCount: number;
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly costMicros: number;
  readonly latencyMs: number;
}


export interface WorkflowOperatorSummary {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly runState: string;
  readonly runRevision: number;
  readonly taskStates: Readonly<{
    readonly pending: number;
    readonly ready: number;
    readonly running: number;
    readonly waiting: number;
    readonly completed: number;
    readonly failed: number;
    readonly cancelled: number;
  }>;
  readonly retryDispositions: Readonly<{
    readonly retryScheduled: number;
    readonly retryReady: number;
    readonly deadLetter: number;
    readonly needsAttention: number;
  }>;
  readonly pendingHumanRequests: number;
  readonly operationStates: Readonly<Record<string, number>>;
  readonly usage: WorkflowUsageTotals;
}

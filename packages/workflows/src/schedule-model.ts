import type {
  Instant,
  TenantId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowScheduleLimits = Object.freeze({
  maxScheduleKeyLength: 96,
  maxNodeKeyLength: 96,
  maxIntervalMs: 365 * 24 * 60 * 60 * 1000,
  maxOccurrences: 1_000_000,
} as const);

export type WorkflowScheduleSpec =
  | {
      readonly kind: "once";
      readonly at: Instant;
    }
  | {
      readonly kind: "interval";
      readonly firstAt: Instant;
      readonly everyMs: number;
      readonly maxOccurrences: number | null;
      readonly endAt: Instant | null;
    };

export interface WorkflowSchedule {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly scheduleKey: string;
  readonly targetNodeKey: string;
  readonly spec: WorkflowScheduleSpec;
  readonly createdAt: Instant;
}

export interface WorkflowOccurrencePlan {
  readonly sequence: number;
  readonly dueAt: Instant;
}

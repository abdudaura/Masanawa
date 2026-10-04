import type {
  Instant,
  TenantId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowCheckpointLimits = Object.freeze({
  maxDepth: 8,
  maxObjectKeys: 128,
  maxArrayItems: 256,
  maxStringLength: 16_000,
  maxSectionKeys: 512,
  maxEvidenceRefs: 64,
} as const);

export type WorkflowCheckpointScalar = string | number | boolean | null;
export type WorkflowCheckpointValue =
  | WorkflowCheckpointScalar
  | readonly WorkflowCheckpointValue[]
  | Readonly<Record<string, WorkflowCheckpointValue>>;

export interface WorkflowCheckpointPayload {
  readonly runState: Readonly<Record<string, WorkflowCheckpointValue>>;
  readonly taskStates: Readonly<Record<string, WorkflowCheckpointValue>>;
  readonly executorStates: Readonly<Record<string, WorkflowCheckpointValue>>;
  readonly edgeStates: Readonly<Record<string, WorkflowCheckpointValue>>;
  readonly pendingRequestStates: Readonly<Record<string, WorkflowCheckpointValue>>;
  readonly iteration: number;
  readonly superstep: number;
  readonly evidenceRefs: readonly string[];
}

export interface WorkflowCheckpoint {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly sequence: number;
  readonly parentSequence: number | null;
  readonly workflowRunRevision: number;
  readonly payload: WorkflowCheckpointPayload;
  readonly payloadFingerprint: string;
  readonly createdAt: Instant;
}

export interface WorkflowCheckpointCompatibility {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
}

import type {
  CorrelationId,
  OperationId,
  RequestId,
  TaskId,
  TenantId,
  WorkflowRunId,
} from "@masanawa/contracts";

export const decisionLimits = Object.freeze({
  maxClassLength: 96,
  maxVersionLength: 96,
  maxInstructionsLength: 2_000,
  maxQuestions: 16,
  maxCriteriaPerQuestion: 32,
  maxPacketKeys: 64,
  maxObjectKeys: 64,
  maxArrayItems: 64,
  maxDepth: 6,
  maxStringLength: 8_000,
  maxAnswerKeyLength: 96,
  maxEvidenceRefs: 32,
  maxOperationIds: 64,
} as const);

export type DecisionRisk = "low" | "medium" | "high";
export type DecisionRollout = "shadow" | "active";

export type DecisionScalar = string | number | boolean | null;
export type DecisionValue =
  | DecisionScalar
  | readonly DecisionValue[]
  | Readonly<Record<string, DecisionValue>>;

export interface JevChoiceQuestion {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
}

export interface JevNoulQuestion {
  readonly type: "noul";
  readonly instructions: string;
  readonly criteria?: Readonly<{
    readonly true?: string;
    readonly false?: string;
  }>;
}

export interface JevScoreQuestion {
  readonly type: "score";
  readonly instructions: string;
  readonly min: number;
  readonly max: number;
  readonly criteria: readonly string[];
}

export type JevQuestion =
  | JevChoiceQuestion
  | JevNoulQuestion
  | JevScoreQuestion;

export interface DecisionDefinition {
  readonly decisionClass: string;
  readonly schemaVersion: string;
  readonly risk: DecisionRisk;
  readonly rollout: DecisionRollout;
  readonly questions: Readonly<Record<string, JevQuestion>>;
  readonly deterministicFallback: string;
}

export interface DecisionTrace {
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly taskId: TaskId | null;
  readonly workflowRunId: WorkflowRunId | null;
  readonly operationIds: readonly OperationId[];
}

export interface DecisionRequest {
  readonly decisionClass: string;
  readonly schemaVersion: string;
  readonly packet: Readonly<Record<string, DecisionValue>>;
  readonly trace: DecisionTrace;
}

export type DecisionAnswer = string | boolean | number;

export interface DecisionResult {
  readonly decisionClass: string;
  readonly schemaVersion: string;
  readonly answers: Readonly<Record<string, DecisionAnswer>>;
  readonly confidence: number | null;
  readonly evidenceRefs: readonly string[];
}

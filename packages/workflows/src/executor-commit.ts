import type {
  ApprovalId,
  WorkflowRunId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowRunScope,
  WorkflowRunState,
} from "./workflow-run.js";

export interface WorkflowExecutorFence {
  readonly holderId: string;
  readonly fence: number;
}

export interface WorkflowExecutorCommitRepository {
  transition(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRunId;
    readonly expectedRevision: number;
    readonly to: WorkflowRunState;
    readonly failureCode?: string;
    readonly pendingApprovalIds?: readonly ApprovalId[];
    readonly executor: WorkflowExecutorFence;
  }): Promise<WorkflowRun>;

  appendCheckpoint(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly expectedRunRevision: number;
    readonly checkpoint: WorkflowCheckpoint;
    readonly executor: WorkflowExecutorFence;
  }): Promise<WorkflowRun>;
}

export function normalizeWorkflowExecutorFence(
  input: WorkflowExecutorFence,
): WorkflowExecutorFence {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Workflow executor fence is invalid");
  }
  const holderId = input.holderId.trim();
  if (
    holderId.length < 1 ||
    holderId.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(holderId)
  ) {
    throw new TypeError("Workflow executor holderId is invalid");
  }
  if (!Number.isSafeInteger(input.fence) || input.fence < 1) {
    throw new RangeError("Workflow executor fence is invalid");
  }
  return Object.freeze({ holderId, fence: input.fence });
}

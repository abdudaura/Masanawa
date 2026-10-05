import type {
  AgentRunId,
  TaskId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type {
  Task,
  TaskState,
  WorkScope,
  WorkflowRun,
  WorkflowRunState,
} from "./model.js";

export interface WorkRequest {
  readonly authority: AuthorityContext;
  readonly scope: WorkScope;
}

export interface TaskCreateInput extends WorkRequest {
  readonly taskId: TaskId;
  readonly title: string;
}

export interface TaskTransitionInput extends WorkRequest {
  readonly taskId: TaskId;
  readonly expectedRevision: number;
  readonly state: TaskState;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly activeAgentRunId?: AgentRunId | null;
  readonly failureCode?: string | null;
}

export interface WorkflowRunCreateInput extends WorkRequest {
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly taskId: TaskId;
}

export interface WorkflowRunTransitionInput extends WorkRequest {
  readonly workflowRunId: WorkflowRunId;
  readonly expectedRevision: number;
  readonly state: WorkflowRunState;
  readonly checkpointRevision?: number;
  readonly activeAgentRunId?: AgentRunId | null;
  readonly failureCode?: string | null;
}

/**
 * Canonical durable Work persistence boundary.
 *
 * Implementations must scope every operation to the exact tenant/user/character/
 * relationship tuple, use expectedRevision as compare-and-swap, preserve terminal
 * history and reject lifecycle rewrites.
 */
export interface WorkflowRepository {
  createTask(input: TaskCreateInput): Promise<Task>;
  readTask(input: WorkRequest & {
    readonly taskId: TaskId;
  }): Promise<Task | null>;
  transitionTask(input: TaskTransitionInput): Promise<Task>;

  createWorkflowRun(input: WorkflowRunCreateInput): Promise<WorkflowRun>;
  readWorkflowRun(input: WorkRequest & {
    readonly workflowRunId: WorkflowRunId;
  }): Promise<WorkflowRun | null>;
  transitionWorkflowRun(input: WorkflowRunTransitionInput): Promise<WorkflowRun>;
}

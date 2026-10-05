import type {
  AgentRunId,
  Instant,
  TaskId,
  WorkflowRunId,
  WorkflowVersionId,
} from "@masanawa/contracts";
import type {
  Task,
  TaskState,
  WorkScope,
  WorkflowRun,
  WorkflowRunState,
} from "./model.js";

export interface TaskCreateInput {
  readonly scope: WorkScope;
  readonly taskId: TaskId;
  readonly title: string;
  readonly createdAt: Instant;
}

export interface TaskTransitionInput {
  readonly scope: WorkScope;
  readonly taskId: TaskId;
  readonly expectedRevision: number;
  readonly state: TaskState;
  readonly updatedAt: Instant;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly activeAgentRunId?: AgentRunId | null;
  readonly failureCode?: string | null;
}

export interface WorkflowRunCreateInput {
  readonly scope: WorkScope;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly taskId: TaskId;
  readonly createdAt: Instant;
}

export interface WorkflowRunTransitionInput {
  readonly scope: WorkScope;
  readonly workflowRunId: WorkflowRunId;
  readonly expectedRevision: number;
  readonly state: WorkflowRunState;
  readonly updatedAt: Instant;
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
  readTask(input: {
    readonly scope: WorkScope;
    readonly taskId: TaskId;
  }): Promise<Task | null>;
  transitionTask(input: TaskTransitionInput): Promise<Task>;

  createWorkflowRun(input: WorkflowRunCreateInput): Promise<WorkflowRun>;
  readWorkflowRun(input: {
    readonly scope: WorkScope;
    readonly workflowRunId: WorkflowRunId;
  }): Promise<WorkflowRun | null>;
  transitionWorkflowRun(input: WorkflowRunTransitionInput): Promise<WorkflowRun>;
}

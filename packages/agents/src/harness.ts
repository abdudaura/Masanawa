import type {
  AgentRunId,
  CharacterSessionId,
  SkillVersionId,
  TaskId,
  WorkflowRunId,
} from "@masanawa/contracts";

import type {
  AgentStrategyInput,
  AgentStrategyPresentation,
  AgentStrategyResult,
} from "./strategy.js";

/**
 * User-visible progress must correspond to real runtime state. A channel may
 * collapse phases for presentation, but the harness must never fabricate them.
 */
export type AgentHarnessProgressPhase =
  | "queued"
  | "understanding"
  | "working"
  | "waiting_approval"
  | "waiting_external"
  | "completed"
  | "failed";

export interface AgentHarnessProgress {
  readonly phase: AgentHarnessProgressPhase;
  readonly message: string;
  readonly agentRunId: AgentRunId;
  readonly taskId: TaskId | null;
  readonly workflowRunId: WorkflowRunId | null;
}

/**
 * Provider-neutral execution input around an already-admitted AgentRun.
 *
 * Authority, Task, Workflow, Skill and domain services remain canonical outside
 * this package. The harness only coordinates them through injected ports.
 */
export interface AgentHarnessRequest {
  readonly agentRunId: AgentRunId;
  readonly characterSessionId: CharacterSessionId;
  readonly skillVersionIds: readonly SkillVersionId[];
  readonly presentation: AgentStrategyPresentation;
  readonly input: AgentStrategyInput;
  readonly taskId: TaskId | null;
  readonly workflowRunId: WorkflowRunId | null;
  readonly signal?: AbortSignal;
  readonly onTextDelta?: (delta: string) => void | Promise<void>;
  readonly onProgress?: (
    progress: AgentHarnessProgress,
  ) => void | Promise<void>;
}

/**
 * Existing Task/WorkflowRun identities are the durable "Work" layer. The
 * harness does not create a parallel work store.
 */
export interface AgentHarnessResult extends AgentStrategyResult {
  readonly taskId: TaskId | null;
  readonly workflowRunId: WorkflowRunId | null;
}

/**
 * Runtime harness boundary. Implementations may compile context, select
 * authorized Skills, resume durable work and delegate bounded child AgentRuns.
 * They must not bypass domain authorization, approval, idempotency or settlement.
 */
export interface AgentHarness {
  execute(input: AgentHarnessRequest): Promise<AgentHarnessResult>;
}

import type {
  AgentHarnessProgress,
  MobileShellRepository,
  MobileShellScope,
} from "@masanawa/agents";
import type { CharacterSessionId } from "@masanawa/contracts";

export type HarnessProgressReporter = (
  progress: AgentHarnessProgress,
) => Promise<void>;

function workReference(progress: AgentHarnessProgress): string {
  return progress.taskId ?? progress.workflowRunId ?? progress.agentRunId;
}

function statusLabel(phase: AgentHarnessProgress["phase"]): string {
  switch (phase) {
    case "queued":
      return "Queued";
    case "understanding":
      return "Preparing";
    case "working":
      return "Working";
    case "waiting_approval":
      return "Approval needed";
    case "waiting_external":
      return "Waiting";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

/**
 * Projects truthful harness progress into the existing durable shell event stream.
 *
 * This adapter owns presentation only. Task/Workflow/AgentRun state remains
 * canonical in its existing service and persistence boundary.
 */
export function createAgentHarnessProgressReporter(input: {
  readonly repository: MobileShellRepository;
  readonly scope: MobileShellScope;
  readonly characterSessionId: CharacterSessionId;
}): HarnessProgressReporter {
  return async (progress) => {
    const referenceId = workReference(progress);
    await input.repository.appendEvent({
      scope: input.scope,
      characterSessionId: input.characterSessionId,
      type: "work.updated",
      payload: Object.freeze({
        referenceId,
        phase: progress.phase,
        agentRunId: progress.agentRunId,
        taskId: progress.taskId,
        workflowRunId: progress.workflowRunId,
        part: Object.freeze({
          kind: "work",
          title: "Work",
          body: progress.message,
          status: statusLabel(progress.phase),
          referenceId,
        }),
      }),
    });
  };
}

import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowResumeDisposition,
  WorkflowRun,
  WorkflowRunScope,
} from "@masanawa/workflows";

export interface AgentHarnessResumeService {
  inspect(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRun["workflowRunId"];
  }): Promise<WorkflowResumeDisposition>;
}

export interface DurableWorkExecutor {
  execute(input: {
    readonly authority: AuthorityContext;
    readonly disposition: Extract<WorkflowResumeDisposition, { readonly kind: "execute" }>;
  }): Promise<void>;
}

export interface DurableWorkReconciler {
  reconcileExternal(input: {
    readonly authority: AuthorityContext;
    readonly disposition: Extract<
      WorkflowResumeDisposition,
      { readonly kind: "reconcile-external" }
    >;
  }): Promise<void>;
}

export type AgentHarnessResumeOutcome =
  | "executed"
  | "waiting-approval"
  | "reconciliation-requested"
  | "blocked"
  | "terminal";

export function createAgentHarnessResumeCoordinator(input: {
  readonly resume: AgentHarnessResumeService;
  readonly executor: DurableWorkExecutor;
  readonly reconciler: DurableWorkReconciler;
}) {
  return Object.freeze({
    async resumeWork(request: {
      readonly authority: AuthorityContext;
      readonly scope: WorkflowRunScope;
      readonly workflowRunId: WorkflowRun["workflowRunId"];
    }): Promise<AgentHarnessResumeOutcome> {
      const disposition = await input.resume.inspect(request);
      switch (disposition.kind) {
        case "execute":
          await input.executor.execute({
            authority: request.authority,
            disposition,
          });
          return "executed";
        case "reconcile-external":
          await input.reconciler.reconcileExternal({
            authority: request.authority,
            disposition,
          });
          return "reconciliation-requested";
        case "waiting-approval":
          return "waiting-approval";
        case "blocked":
          return "blocked";
        case "terminal":
          return "terminal";
      }
    },
  });
}

import {
  PlatformError,
  type ApprovalId,
  type Instant,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowRunScope,
} from "./workflow-run.js";

export interface WorkflowGraphSnapshot {
  readonly workflowVersionId: WorkflowRun["workflowVersionId"];
  readonly graphSignature: string;
}

export interface WorkflowGraphResolver {
  resolve(input: {
    readonly authority: AuthorityContext;
    readonly run: WorkflowRun;
  }): Promise<WorkflowGraphSnapshot>;
}

export interface WorkflowApprovalResolver {
  areSatisfied(input: {
    readonly authority: AuthorityContext;
    readonly run: WorkflowRun;
    readonly approvalIds: readonly ApprovalId[];
    readonly at: Instant;
  }): Promise<boolean>;
}

export interface WorkflowResumeClock {
  now(): Instant;
}

export type WorkflowResumeDisposition =
  | {
      readonly kind: "execute";
      readonly run: WorkflowRun;
      readonly checkpoint: WorkflowCheckpoint | null;
      readonly resumeFrom: "start" | "checkpoint";
    }
  | {
      readonly kind: "waiting-approval";
      readonly run: WorkflowRun;
      readonly checkpoint: WorkflowCheckpoint;
      readonly approvalIds: readonly ApprovalId[];
    }
  | {
      readonly kind: "reconcile-external";
      readonly run: WorkflowRun;
      readonly checkpoint: WorkflowCheckpoint;
    }
  | {
      readonly kind: "blocked";
      readonly run: WorkflowRun;
      readonly reason: "running-without-checkpoint";
    }
  | {
      readonly kind: "terminal";
      readonly run: WorkflowRun;
    };

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function sameApprovals(
  left: readonly ApprovalId[],
  right: readonly ApprovalId[],
): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function assertCheckpointMatchesRun(
  run: WorkflowRun,
  checkpoint: WorkflowCheckpoint | null,
): void {
  if (run.checkpointRevision === 0) {
    if (checkpoint !== null) {
      throw conflict(
        "workflows.resume_checkpoint_unexpected",
        "WorkflowRun reports no checkpoint but a persisted checkpoint exists",
      );
    }
    return;
  }
  if (
    checkpoint === null ||
    checkpoint.workflowRunId !== run.workflowRunId ||
    checkpoint.checkpointRevision !== run.checkpointRevision
  ) {
    throw conflict(
      "workflows.resume_checkpoint_mismatch",
      "WorkflowRun and latest checkpoint do not identify the same durable state",
    );
  }
  if (!sameApprovals(checkpoint.pendingApprovalIds, run.pendingApprovalIds)) {
    throw conflict(
      "workflows.resume_approval_mismatch",
      "WorkflowRun and checkpoint disagree about pending approvals",
    );
  }
}

async function assertGraphCompatible(input: {
  readonly authority: AuthorityContext;
  readonly run: WorkflowRun;
  readonly checkpoint: WorkflowCheckpoint | null;
  readonly graphs: WorkflowGraphResolver;
}): Promise<void> {
  if (input.checkpoint === null) return;
  const graph = await input.graphs.resolve({
    authority: input.authority,
    run: input.run,
  });
  if (
    graph.workflowVersionId !== input.run.workflowVersionId ||
    graph.graphSignature !== input.checkpoint.graphSignature
  ) {
    throw conflict(
      "workflows.resume_graph_changed",
      "Persisted Work cannot resume against a different WorkflowVersion graph",
    );
  }
}

export function createWorkflowResumeService(input: {
  readonly runs: WorkflowRunRepository;
  readonly graphs: WorkflowGraphResolver;
  readonly approvals: WorkflowApprovalResolver;
  readonly clock: WorkflowResumeClock;
}) {
  return Object.freeze({
    async inspect(request: {
      readonly authority: AuthorityContext;
      readonly scope: WorkflowRunScope;
      readonly workflowRunId: WorkflowRun["workflowRunId"];
    }): Promise<WorkflowResumeDisposition> {
      const run = await input.runs.read({
        authority: request.authority,
        scope: request.scope,
        workflowRunId: request.workflowRunId,
      });
      const checkpoint = await input.runs.readLatestCheckpoint({
        authority: request.authority,
        scope: request.scope,
        workflowRunId: request.workflowRunId,
      });

      assertCheckpointMatchesRun(run, checkpoint);
      await assertGraphCompatible({
        authority: request.authority,
        run,
        checkpoint,
        graphs: input.graphs,
      });

      switch (run.state) {
        case "completed":
        case "failed":
        case "cancelled":
          return Object.freeze({ kind: "terminal", run });

        case "waiting_external":
          if (checkpoint === null) {
            throw conflict(
              "workflows.resume_external_checkpoint_missing",
              "Externally waiting Work requires a durable checkpoint before reconciliation",
            );
          }
          return Object.freeze({
            kind: "reconcile-external",
            run,
            checkpoint,
          });

        case "waiting_approval": {
          if (checkpoint === null) {
            throw conflict(
              "workflows.resume_approval_checkpoint_missing",
              "Approval-waiting Work requires a durable checkpoint",
            );
          }
          const at = input.clock.now();
          const satisfied = await input.approvals.areSatisfied({
            authority: request.authority,
            run,
            approvalIds: run.pendingApprovalIds,
            at,
          });
          if (!satisfied) {
            return Object.freeze({
              kind: "waiting-approval",
              run,
              checkpoint,
              approvalIds: Object.freeze([...run.pendingApprovalIds]),
            });
          }
          const resumed = await input.runs.transition({
            authority: request.authority,
            scope: request.scope,
            workflowRunId: run.workflowRunId,
            expectedRevision: run.revision,
            to: "running",
            updatedAt: at,
            pendingApprovalIds: [],
          });
          return Object.freeze({
            kind: "execute",
            run: resumed,
            checkpoint,
            resumeFrom: "checkpoint",
          });
        }

        case "queued": {
          const at = input.clock.now();
          const running = await input.runs.transition({
            authority: request.authority,
            scope: request.scope,
            workflowRunId: run.workflowRunId,
            expectedRevision: run.revision,
            to: "running",
            updatedAt: at,
          });
          return Object.freeze({
            kind: "execute",
            run: running,
            checkpoint,
            resumeFrom: checkpoint === null ? "start" : "checkpoint",
          });
        }

        case "running":
          if (checkpoint === null) {
            return Object.freeze({
              kind: "blocked",
              run,
              reason: "running-without-checkpoint",
            });
          }
          return Object.freeze({
            kind: "execute",
            run,
            checkpoint,
            resumeFrom: "checkpoint",
          });
      }
    },
  });
}

import type { AuthorityContext } from "@masanawa/security";
import type {
  WorkflowExecutorLease,
  WorkflowExecutorLeaseRepository,
} from "./executor-lease.js";
import type {
  WorkflowResumeDisposition,
} from "./resume.js";
import type {
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowRunScope,
} from "./workflow-run.js";

export interface WorkflowExecutionSessionClock {
  now(): WorkflowRun["updatedAt"];
}

export interface WorkflowResumeInspector {
  inspect(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRun["workflowRunId"];
  }): Promise<WorkflowResumeDisposition>;
}

export type WorkflowExecutionSessionOpenResult =
  | {
      readonly kind: "execute-session";
      readonly run: WorkflowRun;
      readonly checkpoint: WorkflowCheckpoint | null;
      readonly resumeFrom: "start" | "checkpoint";
      readonly lease: WorkflowExecutorLease;
    }
  | Exclude<WorkflowResumeDisposition, { readonly kind: "execute" }>;

function leaseDuration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 15 * 60_000) {
    throw new RangeError(
      "Workflow execution session lease duration must be between 1 second and 15 minutes",
    );
  }
  return value;
}

export function createWorkflowExecutionSessionCoordinator(input: {
  readonly resume: WorkflowResumeInspector;
  readonly leases: WorkflowExecutorLeaseRepository;
  readonly clock: WorkflowExecutionSessionClock;
  readonly leaseDurationMs: number;
}) {
  const durationMs = leaseDuration(input.leaseDurationMs);

  return Object.freeze({
    async open(request: {
      readonly authority: AuthorityContext;
      readonly scope: WorkflowRunScope;
      readonly workflowRunId: WorkflowRun["workflowRunId"];
      readonly holderId: string;
    }): Promise<WorkflowExecutionSessionOpenResult> {
      const disposition = await input.resume.inspect({
        authority: request.authority,
        scope: request.scope,
        workflowRunId: request.workflowRunId,
      });

      if (disposition.kind !== "execute") {
        return disposition;
      }

      const lease = await input.leases.acquire({
        tenantId: disposition.run.tenantId,
        workflowRunId: disposition.run.workflowRunId,
        holderId: request.holderId,
        runState: disposition.run.state,
        now: input.clock.now(),
        durationMs,
      });

      return Object.freeze({
        kind: "execute-session" as const,
        run: disposition.run,
        checkpoint: disposition.checkpoint,
        resumeFrom: disposition.resumeFrom,
        lease,
      });
    },

    async renew(session: {
      readonly lease: WorkflowExecutorLease;
    }): Promise<WorkflowExecutorLease> {
      return input.leases.renew({
        tenantId: session.lease.tenantId,
        workflowRunId: session.lease.workflowRunId,
        holderId: session.lease.holderId,
        fence: session.lease.fence,
        now: input.clock.now(),
        durationMs,
      });
    },

    async close(session: {
      readonly lease: WorkflowExecutorLease;
    }): Promise<WorkflowExecutorLease> {
      return input.leases.release({
        tenantId: session.lease.tenantId,
        workflowRunId: session.lease.workflowRunId,
        holderId: session.lease.holderId,
        fence: session.lease.fence,
        now: input.clock.now(),
      });
    },
  });
}

import {
  PlatformError,
  toInstant,
  type Instant,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import {
  assertWorkflowCheckpointCompatible,
} from "./checkpoint.js";
import type {
  WorkflowCheckpoint,
} from "./checkpoint-model.js";

export interface CanonicalWorkflowTaskLease {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly nodeKey: string;
  readonly state: "running";
  readonly revision: number;
  readonly leaseOwner: string;
  readonly leaseFence: number;
  readonly leaseExpiresAt: Instant;
}

export interface WorkflowExecutionAuthorityGuard {
  assertCurrent(input: {
    readonly lease: CanonicalWorkflowTaskLease;
    readonly at: Instant;
  }): Promise<void>;
}

export interface WorkflowExecutionCheckpointReader {
  loadLatestCompatible(input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly workflowVersionId: WorkflowVersionId;
    readonly graphSignature: string;
    readonly schemaVersion: 1;
  }): Promise<WorkflowCheckpoint | null>;
}

export interface WorkflowExecutionExternalOutcomeGuard {
  inspect(input: {
    readonly lease: CanonicalWorkflowTaskLease;
    readonly checkpoint: WorkflowCheckpoint | null;
    readonly at: Instant;
  }): Promise<
    | { readonly kind: "safe" }
    | { readonly kind: "reconcile"; readonly reason: string }
    | { readonly kind: "blocked"; readonly reason: string }
  >;
}

export interface WorkflowExecutionAdmissionClock {
  now(): Instant;
}

export type WorkflowExecutionAdmissionDecision =
  | {
      readonly kind: "execute";
      readonly lease: CanonicalWorkflowTaskLease;
      readonly checkpoint: WorkflowCheckpoint | null;
      readonly resumeFrom: "start" | "checkpoint";
    }
  | {
      readonly kind: "reconcile";
      readonly lease: CanonicalWorkflowTaskLease;
      readonly checkpoint: WorkflowCheckpoint | null;
      readonly reason: string;
    }
  | {
      readonly kind: "blocked";
      readonly lease: CanonicalWorkflowTaskLease;
      readonly reason:
        | "lease-expired"
        | "external-block"
        | "invalid-lease";
      readonly detail?: string;
    };

function boundedReason(value: string, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 500) {
    throw new TypeError(`${name} must be non-empty and at most 500 characters`);
  }
  return normalized;
}

function validateLease(
  lease: CanonicalWorkflowTaskLease,
): CanonicalWorkflowTaskLease {
  if (lease.state !== "running") {
    throw new TypeError("Workflow execution candidate must be a running leased Task");
  }
  if (
    typeof lease.leaseOwner !== "string" ||
    !lease.leaseOwner.trim() ||
    lease.leaseOwner.length > 200
  ) {
    throw new TypeError("Workflow Task leaseOwner is invalid");
  }
  if (!Number.isSafeInteger(lease.leaseFence) || lease.leaseFence < 1) {
    throw new RangeError("Workflow Task leaseFence is invalid");
  }
  if (!Number.isSafeInteger(lease.revision) || lease.revision < 1) {
    throw new RangeError("Workflow Task revision is invalid");
  }
  if (
    typeof lease.nodeKey !== "string" ||
    !lease.nodeKey.trim() ||
    lease.nodeKey.length > 96
  ) {
    throw new TypeError("Workflow Task nodeKey is invalid");
  }
  toInstant(lease.leaseExpiresAt);
  return Object.freeze({
    ...lease,
    leaseOwner: lease.leaseOwner.trim(),
  });
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

export function createWorkflowExecutionAdmissionCoordinator(input: {
  readonly authority: WorkflowExecutionAuthorityGuard;
  readonly checkpoints: WorkflowExecutionCheckpointReader;
  readonly externalOutcomes: WorkflowExecutionExternalOutcomeGuard;
  readonly clock: WorkflowExecutionAdmissionClock;
}) {
  return Object.freeze({
    async inspect(rawLease: CanonicalWorkflowTaskLease): Promise<
      WorkflowExecutionAdmissionDecision
    > {
      const lease = validateLease(rawLease);
      const at = toInstant(input.clock.now());

      if (at >= lease.leaseExpiresAt) {
        return Object.freeze({
          kind: "blocked" as const,
          lease,
          reason: "lease-expired" as const,
        });
      }

      await input.authority.assertCurrent({ lease, at });

      const checkpoint = await input.checkpoints.loadLatestCompatible({
        tenantId: lease.tenantId,
        workflowRunId: lease.workflowRunId,
        workflowVersionId: lease.workflowVersionId,
        graphSignature: lease.graphSignature,
        schemaVersion: 1,
      });

      if (checkpoint !== null) {
        try {
          assertWorkflowCheckpointCompatible(checkpoint, {
            schemaVersion: 1,
            tenantId: lease.tenantId,
            workflowRunId: lease.workflowRunId,
            workflowVersionId: lease.workflowVersionId,
            graphSignature: lease.graphSignature,
          });
        } catch {
          throw conflict(
            "workflows.execution_checkpoint_incompatible",
            "Latest Workflow checkpoint is incompatible with the leased Task",
          );
        }
      }

      const external = await input.externalOutcomes.inspect({
        lease,
        checkpoint,
        at,
      });

      if (external.kind === "reconcile") {
        return Object.freeze({
          kind: "reconcile" as const,
          lease,
          checkpoint,
          reason: boundedReason(
            external.reason,
            "external reconciliation reason",
          ),
        });
      }

      if (external.kind === "blocked") {
        return Object.freeze({
          kind: "blocked" as const,
          lease,
          reason: "external-block" as const,
          detail: boundedReason(external.reason, "external block reason"),
        });
      }

      return Object.freeze({
        kind: "execute" as const,
        lease,
        checkpoint,
        resumeFrom: checkpoint === null ? "start" : "checkpoint",
      });
    },
  });
}

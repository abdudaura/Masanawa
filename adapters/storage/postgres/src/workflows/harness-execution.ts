import { PlatformError } from "@masanawa/contracts";
import {
  createWorkflowCheckpoint,
  projectWorkflowOperationTruth,
  type WorkflowCheckpoint,
  type WorkflowExecutionCheckpointReader,
  type WorkflowExecutionExternalOutcomeGuard,
} from "@masanawa/workflows";
import type { Pool } from "pg";
import {
  loadLatestCompatibleWorkflowCheckpoint,
} from "./checkpoints.js";
import {
  loadWorkflowTaskOperationTruth,
} from "./operations.js";

export function createPostgresWorkflowExecutionCheckpointReader(
  pool: Pool,
): WorkflowExecutionCheckpointReader {
  return Object.freeze({
    async loadLatestCompatible(input) {
      const record = await loadLatestCompatibleWorkflowCheckpoint(pool, input);
      if (record === null) return null;
      return createWorkflowCheckpoint({
        schemaVersion: record.schemaVersion,
        tenantId: record.tenantId,
        workflowRunId: record.workflowRunId,
        workflowVersionId: record.workflowVersionId,
        graphSignature: record.graphSignature,
        sequence: record.sequence,
        parentSequence: record.parentSequence,
        workflowRunRevision: record.workflowRunRevision,
        payload: record.payload as WorkflowCheckpoint["payload"],
        payloadFingerprint: record.payloadFingerprint,
        createdAt: record.createdAt,
      });
    },
  });
}

function isMissingOperationBinding(error: unknown): boolean {
  return (
    error instanceof PlatformError &&
    error.code === "workflows.operation_binding_not_found"
  );
}

export function createPostgresWorkflowExecutionExternalOutcomeGuard(
  pool: Pool,
): WorkflowExecutionExternalOutcomeGuard {
  return Object.freeze({
    async inspect(input) {
      let truth;
      try {
        truth = await loadWorkflowTaskOperationTruth(pool, {
          tenantId: input.lease.tenantId,
          taskId: input.lease.taskId,
          role: "primary",
        });
      } catch (error) {
        if (isMissingOperationBinding(error)) {
          return Object.freeze({ kind: "safe" as const });
        }
        throw error;
      }

      const projection = projectWorkflowOperationTruth({
        operationId: truth.binding.operationId,
        operationState: truth.operationState,
        reconciliationStatus: truth.reconciliationStatus,
        receiptIds: truth.receiptIds,
      });

      switch (projection.disposition) {
        case "reconciliation-required":
          return Object.freeze({
            kind: "reconcile" as const,
            reason: "canonical Operation outcome requires reconciliation",
          });
        case "needs-attention":
          return Object.freeze({
            kind: "reconcile" as const,
            reason: "canonical Operation requires human attention",
          });
        case "pending":
          return Object.freeze({
            kind: "blocked" as const,
            reason: "canonical Operation is still in flight",
          });
        case "succeeded":
        case "failed":
          return Object.freeze({ kind: "safe" as const });
      }
    },
  });
}

import {
  type CanonicalOperationState,
  type CanonicalReconciliationStatus,
  type WorkflowOperationBinding,
  type WorkflowOperationProjection,
} from "./operation-binding-model.js";

const graphSignaturePattern = /^sha256:[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

export function createWorkflowOperationBinding(
  input: WorkflowOperationBinding,
): WorkflowOperationBinding {
  if (!graphSignaturePattern.test(input.graphSignature)) {
    fail("workflow operation graphSignature must be canonical sha256");
  }
  if (!["primary", "verification", "compensation"].includes(input.role)) {
    fail("workflow operation role is not supported");
  }
  return Object.freeze({ ...input });
}

export function projectWorkflowOperationTruth(input: {
  readonly operationId: WorkflowOperationBinding["operationId"];
  readonly operationState: CanonicalOperationState;
  readonly reconciliationStatus: CanonicalReconciliationStatus | null;
  readonly receiptIds: WorkflowOperationProjection["receiptIds"];
}): WorkflowOperationProjection {
  let disposition: WorkflowOperationProjection["disposition"];

  if (input.reconciliationStatus === "needs-attention") {
    disposition = "needs-attention";
  } else if (
    input.operationState === "partial" ||
    input.operationState === "unknown" ||
    input.operationState === "reconciling" ||
    input.reconciliationStatus === "open" ||
    input.reconciliationStatus === "checking"
  ) {
    disposition = "reconciliation-required";
  } else if (input.operationState === "succeeded") {
    disposition = "succeeded";
  } else if (
    input.operationState === "rejected" ||
    input.operationState === "failed"
  ) {
    disposition = "failed";
  } else {
    disposition = "pending";
  }

  return Object.freeze({
    operationId: input.operationId,
    disposition,
    receiptIds: Object.freeze([...new Set(input.receiptIds)]),
  });
}

import type {
  WorkflowCompensationStepState,
  WorkflowControlMode,
  WorkflowControlState,
} from "./control-model.js";

export function terminalWorkflowControlState(
  mode: WorkflowControlMode,
): Extract<WorkflowControlState, "cancelled" | "superseded"> {
  return mode === "supersede" ? "superseded" : "cancelled";
}

const compensationTransitions: Readonly<
  Record<WorkflowCompensationStepState, ReadonlySet<WorkflowCompensationStepState>>
> = Object.freeze({
  planned: new Set(["running", "failed"]),
  running: new Set(["succeeded", "failed"]),
  succeeded: new Set(),
  failed: new Set(),
});

export function canTransitionWorkflowCompensation(
  from: WorkflowCompensationStepState,
  to: WorkflowCompensationStepState,
): boolean {
  return compensationTransitions[from].has(to);
}

export function assertWorkflowCompensationTransition(
  from: WorkflowCompensationStepState,
  to: WorkflowCompensationStepState,
): void {
  if (!canTransitionWorkflowCompensation(from, to)) {
    throw new TypeError(
      `illegal workflow compensation transition: ${from} -> ${to}`,
    );
  }
}

export function isImmediatelyCancellableTaskState(
  state: string,
): boolean {
  return state === "pending" || state === "ready" || state === "waiting";
}

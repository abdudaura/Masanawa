import type { WorkflowVersion } from "./model.js";
import {
  workflowRunLimits,
  type TaskState,
  type WorkflowRun,
  type WorkflowRunFailure,
  type WorkflowRunState,
  type WorkflowTask,
} from "./run-model.js";

const nodeKeyPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;
const failureCodePattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;
const graphSignaturePattern = /^sha256:[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function boundedString(
  value: unknown,
  name: string,
  maxLength: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.length === 0) ||
    value.length > maxLength
  ) {
    fail(`${name} must be ${allowEmpty ? "a" : "a non-empty"} string no longer than ${maxLength} characters`);
  }
  return value;
}

function positiveRevision(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(`${name} must be a positive safe integer`);
  }
  return value as number;
}

function assertGraphSignature(value: string): void {
  if (!graphSignaturePattern.test(value)) {
    fail("graphSignature must be a canonical sha256 signature");
  }
}

function normalizeFailure(
  failure: WorkflowRunFailure | null,
): WorkflowRunFailure | null {
  if (failure === null) {
    return null;
  }
  const code = boundedString(
    failure.code,
    "failure.code",
    workflowRunLimits.maxFailureCodeLength,
  );
  if (!failureCodePattern.test(code)) {
    fail("failure.code must use a stable lowercase code format");
  }
  return Object.freeze({
    code,
    message: boundedString(
      failure.message,
      "failure.message",
      workflowRunLimits.maxFailureMessageLength,
      true,
    ),
  });
}


function assertChronology(
  createdAt: string,
  updatedAt: string,
  startedAt: string | null,
  terminalAt: string | null,
  name: string,
): void {
  if (updatedAt < createdAt) {
    fail(`${name}.updatedAt cannot precede createdAt`);
  }
  if (startedAt !== null && (startedAt < createdAt || startedAt > updatedAt)) {
    fail(`${name}.startedAt must fall between createdAt and updatedAt`);
  }
  if (terminalAt !== null && (terminalAt < createdAt || terminalAt > updatedAt)) {
    fail(`${name}.terminalAt must fall between createdAt and updatedAt`);
  }
}

function assertRunShape(run: WorkflowRun): void {
  positiveRevision(run.revision, "workflowRun.revision");
  assertGraphSignature(run.graphSignature);
  if (!["pending", "running", "waiting", "completed", "failed", "cancelled"].includes(run.state)) {
    fail("WorkflowRun state is not supported");
  }

  const terminal = ["completed", "failed", "cancelled"].includes(run.state);
  const requiresStartedAt = ["running", "waiting", "completed", "failed"].includes(run.state);
  if (run.state === "pending" && run.startedAt !== null) {
    fail("pending WorkflowRun cannot have startedAt");
  }
  if (requiresStartedAt && run.startedAt === null) {
    fail("started WorkflowRun state requires startedAt");
  }
  if (terminal !== (run.terminalAt !== null)) {
    fail("WorkflowRun terminalAt must match terminal state");
  }
  if ((run.state === "waiting") !== (run.waitReason !== null)) {
    fail("WorkflowRun waitReason must exist only while waiting");
  }
  if ((run.state === "failed") !== (run.failure !== null)) {
    fail("WorkflowRun failure must exist only while failed");
  }
  if ((run.state === "cancelled") !== (run.cancellationReason !== null)) {
    fail("WorkflowRun cancellationReason must exist only while cancelled");
  }
  assertChronology(
    run.createdAt,
    run.updatedAt,
    run.startedAt,
    run.terminalAt,
    "workflowRun",
  );
}

function assertTaskShape(task: WorkflowTask): void {
  positiveRevision(task.revision, "task.revision");
  assertGraphSignature(task.graphSignature);
  if (!["pending", "ready", "running", "waiting", "completed", "failed", "cancelled"].includes(task.state)) {
    fail("Task state is not supported");
  }

  if (
    task.lineage.depth < 0 ||
    task.lineage.depth > workflowRunLimits.maxTaskDepth ||
    !Number.isSafeInteger(task.lineage.depth)
  ) {
    fail(`task lineage depth must be between 0 and ${workflowRunLimits.maxTaskDepth}`);
  }
  if (task.lineage.depth === 0) {
    if (
      task.lineage.parentTaskId !== null ||
      task.lineage.rootTaskId !== task.taskId
    ) {
      fail("root task lineage must self-root and have no parent");
    }
  } else if (
    task.lineage.parentTaskId === null ||
    task.lineage.rootTaskId === task.taskId
  ) {
    fail("child task lineage requires a parent and distinct root");
  }

  const terminal = ["completed", "failed", "cancelled"].includes(task.state);
  if (task.state === "pending" && task.startedAt !== null) {
    fail("pending Task cannot have startedAt");
  }
  if (["running", "waiting", "completed", "failed"].includes(task.state) && task.startedAt === null) {
    fail("started Task states require startedAt");
  }
  if (terminal !== (task.terminalAt !== null)) {
    fail("Task terminalAt must match terminal state");
  }
  if ((task.state === "waiting") !== (task.waitReason !== null)) {
    fail("Task waitReason must exist only while waiting");
  }
  if ((task.state === "failed") !== (task.failure !== null)) {
    fail("Task failure must exist only while failed");
  }
  if ((task.state === "cancelled") !== (task.cancellationReason !== null)) {
    fail("Task cancellationReason must exist only while cancelled");
  }
  assertChronology(
    task.createdAt,
    task.updatedAt,
    task.startedAt,
    task.terminalAt,
    "task",
  );
}

export function createWorkflowRun(
  input: WorkflowRun,
): WorkflowRun {
  const normalized: WorkflowRun = Object.freeze({
    ...input,
    revision: positiveRevision(input.revision, "workflowRun.revision"),
    waitReason:
      input.waitReason === null
        ? null
        : boundedString(
            input.waitReason,
            "waitReason",
            workflowRunLimits.maxWaitReasonLength,
          ),
    failure: normalizeFailure(input.failure),
    cancellationReason:
      input.cancellationReason === null
        ? null
        : boundedString(
            input.cancellationReason,
            "cancellationReason",
            workflowRunLimits.maxCancellationReasonLength,
          ),
  });
  assertRunShape(normalized);
  return normalized;
}

export function createWorkflowTask(
  input: WorkflowTask,
): WorkflowTask {
  const nodeKey = boundedString(
    input.nodeKey,
    "task.nodeKey",
    workflowRunLimits.maxNodeKeyLength,
  );
  if (!nodeKeyPattern.test(nodeKey)) {
    fail("task.nodeKey must use a stable lowercase key format");
  }

  const normalized: WorkflowTask = Object.freeze({
    ...input,
    nodeKey,
    lineage: Object.freeze({ ...input.lineage }),
    revision: positiveRevision(input.revision, "task.revision"),
    waitReason:
      input.waitReason === null
        ? null
        : boundedString(
            input.waitReason,
            "waitReason",
            workflowRunLimits.maxWaitReasonLength,
          ),
    failure: normalizeFailure(input.failure),
    cancellationReason:
      input.cancellationReason === null
        ? null
        : boundedString(
            input.cancellationReason,
            "cancellationReason",
            workflowRunLimits.maxCancellationReasonLength,
          ),
  });
  assertTaskShape(normalized);
  return normalized;
}

const runTransitions: Readonly<Record<WorkflowRunState, readonly WorkflowRunState[]>> =
  Object.freeze({
    pending: Object.freeze(["running", "failed", "cancelled"]),
    running: Object.freeze(["waiting", "completed", "failed", "cancelled"]),
    waiting: Object.freeze(["running", "completed", "failed", "cancelled"]),
    completed: Object.freeze([]),
    failed: Object.freeze([]),
    cancelled: Object.freeze([]),
  });

const taskTransitions: Readonly<Record<TaskState, readonly TaskState[]>> =
  Object.freeze({
    pending: Object.freeze(["ready", "failed", "cancelled"]),
    ready: Object.freeze(["running", "failed", "cancelled"]),
    running: Object.freeze(["waiting", "completed", "failed", "cancelled"]),
    waiting: Object.freeze(["ready", "running", "completed", "failed", "cancelled"]),
    completed: Object.freeze([]),
    failed: Object.freeze([]),
    cancelled: Object.freeze([]),
  });

export interface StateTransitionOptions {
  readonly expectedRevision: number;
  readonly at: WorkflowRun["updatedAt"];
  readonly waitReason?: string;
  readonly failure?: WorkflowRunFailure;
  readonly cancellationReason?: string;
}

function transitionMetadata(
  nextState: WorkflowRunState | TaskState,
  options: StateTransitionOptions,
): Pick<
  WorkflowRun,
  "terminalAt" | "waitReason" | "failure" | "cancellationReason"
> {
  return {
    terminalAt: ["completed", "failed", "cancelled"].includes(nextState)
      ? options.at
      : null,
    waitReason:
      nextState === "waiting"
        ? boundedString(
            options.waitReason,
            "waitReason",
            workflowRunLimits.maxWaitReasonLength,
          )
        : null,
    failure:
      nextState === "failed"
        ? normalizeFailure(options.failure ?? null) ??
          fail("failure metadata is required when entering failed state")
        : null,
    cancellationReason:
      nextState === "cancelled"
        ? boundedString(
            options.cancellationReason,
            "cancellationReason",
            workflowRunLimits.maxCancellationReasonLength,
          )
        : null,
  };
}

export function transitionWorkflowRun(
  current: WorkflowRun,
  nextState: WorkflowRunState,
  options: StateTransitionOptions,
): WorkflowRun {
  const admitted = createWorkflowRun(current);
  if (admitted.revision !== options.expectedRevision) {
    fail("WorkflowRun revision conflict");
  }
  if (!runTransitions[admitted.state].includes(nextState)) {
    fail(`illegal WorkflowRun transition: ${admitted.state} -> ${nextState}`);
  }

  const metadata = transitionMetadata(nextState, options);
  return createWorkflowRun({
    ...admitted,
    state: nextState,
    revision: admitted.revision + 1,
    updatedAt: options.at,
    startedAt:
      admitted.startedAt ??
      (nextState === "running" || nextState === "waiting" || ["completed", "failed"].includes(nextState)
        ? options.at
        : null),
    ...metadata,
  });
}

export function transitionWorkflowTask(
  current: WorkflowTask,
  nextState: TaskState,
  options: StateTransitionOptions,
): WorkflowTask {
  const admitted = createWorkflowTask(current);
  if (admitted.revision !== options.expectedRevision) {
    fail("Task revision conflict");
  }
  if (!taskTransitions[admitted.state].includes(nextState)) {
    fail(`illegal Task transition: ${admitted.state} -> ${nextState}`);
  }

  const metadata = transitionMetadata(nextState, options);
  return createWorkflowTask({
    ...admitted,
    state: nextState,
    revision: admitted.revision + 1,
    updatedAt: options.at,
    startedAt:
      admitted.startedAt ??
      (nextState === "running" || nextState === "waiting" || ["completed", "failed"].includes(nextState)
        ? options.at
        : null),
    ...metadata,
  });
}

export function assertTaskBelongsToRun(
  task: WorkflowTask,
  run: WorkflowRun,
): void {
  if (
    task.tenantId !== run.tenantId ||
    task.workflowRunId !== run.workflowRunId ||
    task.workflowVersionId !== run.workflowVersionId ||
    task.graphSignature !== run.graphSignature
  ) {
    fail("Task is not pinned to the supplied WorkflowRun identity/version/graph");
  }
}


export function assertWorkflowRunMatchesVersion(
  run: WorkflowRun,
  version: WorkflowVersion,
): void {
  if (
    run.tenantId !== version.tenantId ||
    run.workflowId !== version.workflowId ||
    run.workflowVersionId !== version.workflowVersionId ||
    run.graphSignature !== version.graphSignature
  ) {
    fail("WorkflowRun is not pinned to the supplied WorkflowVersion identity/graph");
  }
}

export function assertChildTaskLineage(
  child: WorkflowTask,
  parent: WorkflowTask,
): void {
  if (
    child.tenantId !== parent.tenantId ||
    child.workflowRunId !== parent.workflowRunId ||
    child.workflowVersionId !== parent.workflowVersionId ||
    child.graphSignature !== parent.graphSignature
  ) {
    fail("Child Task is not bound to the same WorkflowRun/version/graph as parent");
  }
  if (
    child.lineage.parentTaskId !== parent.taskId ||
    child.lineage.rootTaskId !== parent.lineage.rootTaskId ||
    child.lineage.depth !== parent.lineage.depth + 1
  ) {
    fail("Task lineage does not match the supplied parent Task");
  }
}

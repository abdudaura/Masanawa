import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type AgentRunId,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TaskId,
  type TenantId,
  type UserId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";

export const taskStates = [
  "queued",
  "running",
  "waiting_approval",
  "waiting_external",
  "completed",
  "failed",
  "cancelled",
] as const;
export type TaskState = (typeof taskStates)[number];

export const workflowRunStates = [
  "queued",
  "running",
  "waiting_approval",
  "waiting_external",
  "completed",
  "failed",
  "cancelled",
] as const;
export type WorkflowRunState = (typeof workflowRunStates)[number];

export interface WorkScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface Task extends WorkScope {
  readonly schemaVersion: 1;
  readonly taskId: TaskId;
  readonly title: string;
  readonly state: TaskState;
  readonly workflowRunId: WorkflowRunId | null;
  readonly activeAgentRunId: AgentRunId | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly completedAt: Instant | null;
  readonly failureCode: string | null;
}

export interface WorkflowRun extends WorkScope {
  readonly schemaVersion: 1;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly taskId: TaskId;
  readonly state: WorkflowRunState;
  readonly checkpointRevision: number;
  readonly activeAgentRunId: AgentRunId | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly completedAt: Instant | null;
  readonly failureCode: string | null;
}

function exactKeys(value: object, allowed: readonly string[], name: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} is invalid`);
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new TypeError(`${name} has unknown fields`);
}

function boundedText(value: string, name: string, max: number): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function boundedFailureCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 160 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("failureCode is invalid");
  }
  return normalized;
}

function revision(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeWorkScope(input: WorkScope): WorkScope {
  exactKeys(
    input,
    ["tenantId", "userId", "characterId", "relationshipId"],
    "Work scope",
  );
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId),
  });
}

function assertTerminal(
  state: TaskState | WorkflowRunState,
  completedAt: Instant | null,
  failureCode: string | null,
  updatedAt: Instant,
): void {
  const terminal = state === "completed" || state === "failed" || state === "cancelled";
  if (!terminal) {
    if (completedAt !== null || failureCode !== null) {
      throw new TypeError("Active Work lifecycle is inconsistent");
    }
    return;
  }
  if (completedAt === null || completedAt !== updatedAt) {
    throw new TypeError("Terminal Work requires completedAt equal to updatedAt");
  }
  if (state === "failed" && failureCode === null) {
    throw new TypeError("Failed Work requires failureCode");
  }
  if (state !== "failed" && failureCode !== null) {
    throw new TypeError("Only failed Work may carry failureCode");
  }
}

export function normalizeTask(input: Task): Task {
  exactKeys(
    input,
    [
      "schemaVersion",
      "tenantId",
      "userId",
      "characterId",
      "relationshipId",
      "taskId",
      "title",
      "state",
      "workflowRunId",
      "activeAgentRunId",
      "revision",
      "createdAt",
      "updatedAt",
      "completedAt",
      "failureCode",
    ],
    "Task",
  );
  if (input.schemaVersion !== 1 || !taskStates.includes(input.state)) {
    throw new TypeError("Task schema or state is invalid");
  }
  const scope = normalizeWorkScope({
    tenantId: input.tenantId,
    userId: input.userId,
    characterId: input.characterId,
    relationshipId: input.relationshipId,
  });
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  const completedAt = input.completedAt === null ? null : toInstant(input.completedAt);
  if (updatedAt < createdAt) throw new TypeError("Task timestamps are invalid");
  const failureCode =
    input.failureCode === null ? null : boundedFailureCode(input.failureCode);
  assertTerminal(input.state, completedAt, failureCode, updatedAt);
  return Object.freeze({
    ...scope,
    schemaVersion: 1,
    taskId: parseCanonicalId("task", input.taskId),
    title: boundedText(input.title, "Task title", 240),
    state: input.state,
    workflowRunId:
      input.workflowRunId === null
        ? null
        : parseCanonicalId("workflow-run", input.workflowRunId),
    activeAgentRunId:
      input.activeAgentRunId === null
        ? null
        : parseCanonicalId("agent-run", input.activeAgentRunId),
    revision: revision(input.revision, "Task revision"),
    createdAt,
    updatedAt,
    completedAt,
    failureCode,
  });
}

export function normalizeWorkflowRun(input: WorkflowRun): WorkflowRun {
  exactKeys(
    input,
    [
      "schemaVersion",
      "tenantId",
      "userId",
      "characterId",
      "relationshipId",
      "workflowRunId",
      "workflowVersionId",
      "taskId",
      "state",
      "checkpointRevision",
      "activeAgentRunId",
      "revision",
      "createdAt",
      "updatedAt",
      "completedAt",
      "failureCode",
    ],
    "WorkflowRun",
  );
  if (input.schemaVersion !== 1 || !workflowRunStates.includes(input.state)) {
    throw new TypeError("WorkflowRun schema or state is invalid");
  }
  const scope = normalizeWorkScope({
    tenantId: input.tenantId,
    userId: input.userId,
    characterId: input.characterId,
    relationshipId: input.relationshipId,
  });
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  const completedAt = input.completedAt === null ? null : toInstant(input.completedAt);
  if (updatedAt < createdAt) throw new TypeError("WorkflowRun timestamps are invalid");
  const failureCode =
    input.failureCode === null ? null : boundedFailureCode(input.failureCode);
  assertTerminal(input.state, completedAt, failureCode, updatedAt);
  if (!Number.isSafeInteger(input.checkpointRevision) || input.checkpointRevision < 0) {
    throw new RangeError("WorkflowRun checkpointRevision is invalid");
  }
  return Object.freeze({
    ...scope,
    schemaVersion: 1,
    workflowRunId: parseCanonicalId("workflow-run", input.workflowRunId),
    workflowVersionId: parseCanonicalId("workflow-version", input.workflowVersionId),
    taskId: parseCanonicalId("task", input.taskId),
    state: input.state,
    checkpointRevision: input.checkpointRevision,
    activeAgentRunId:
      input.activeAgentRunId === null
        ? null
        : parseCanonicalId("agent-run", input.activeAgentRunId),
    revision: revision(input.revision, "WorkflowRun revision"),
    createdAt,
    updatedAt,
    completedAt,
    failureCode,
  });
}

export function canTransitionWork(
  from: TaskState | WorkflowRunState,
  to: TaskState | WorkflowRunState,
): boolean {
  if (from === to) return true;
  if (["completed", "failed", "cancelled"].includes(from)) return false;
  if (to === "queued") return false;
  return true;
}


export type WorkAction =
  | "task.create"
  | "task.read"
  | "task.update"
  | "run.create"
  | "run.read"
  | "run.update";

/**
 * Work references never grant permission. Every repository operation rechecks
 * the current authority against the exact relationship-scoped Work owner.
 */
export function assertWorkAccess(
  authority: AuthorityContext,
  scope: WorkScope,
  action: WorkAction,
  at: Instant,
): void {
  const capability = `workflows.${action}`;
  const valid =
    authority.tenantId === scope.tenantId &&
    authority.capabilities.includes(capability) &&
    authority.resourceScope.relationshipIds?.includes(scope.relationshipId) &&
    (authority.principal.kind === "user"
      ? authority.principal.userId === scope.userId
      : authority.capabilities.includes("workflows.manage-other")) &&
    authority.issuedAt <= at &&
    (!authority.expiresAt || authority.expiresAt > at);
  if (!valid) {
    throw new PlatformError({
      code: "workflows.work_access_denied",
      category: "authorization",
      message: "Current authority does not allow this Work operation",
      retryable: false,
    });
  }
}

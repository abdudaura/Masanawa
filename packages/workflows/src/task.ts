import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TaskId,
  type TenantId,
  type UserId,
  type WorkflowRunId,
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

export interface TaskScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface Task extends TaskScope {
  readonly schemaVersion: 1;
  readonly taskId: TaskId;
  readonly title: string;
  readonly state: TaskState;
  readonly workflowRunId: WorkflowRunId | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly completedAt: Instant | null;
  readonly failureCode: string | null;
}

const terminalTaskStates = new Set<TaskState>([
  "completed",
  "failed",
  "cancelled",
]);

const taskTransitions: Readonly<Record<TaskState, readonly TaskState[]>> =
  Object.freeze({
    queued: Object.freeze(["running", "failed", "cancelled"]),
    running: Object.freeze([
      "waiting_approval",
      "waiting_external",
      "completed",
      "failed",
      "cancelled",
    ]),
    waiting_approval: Object.freeze(["running", "failed", "cancelled"]),
    waiting_external: Object.freeze([
      "running",
      "completed",
      "failed",
      "cancelled",
    ]),
    completed: Object.freeze([]),
    failed: Object.freeze([]),
    cancelled: Object.freeze([]),
  });

function exactKeys(value: object, keys: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Task value is invalid");
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) throw new TypeError("Task value has unknown fields");
}

function boundedText(value: string, name: string, max: number): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (
    normalized.length < 1 ||
    normalized.length > max ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function boundedCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 160 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("Task failureCode is invalid");
  }
  return normalized;
}

function assertRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Task revision is invalid");
  }
}

export function normalizeTaskScope(input: TaskScope): TaskScope {
  exactKeys(input, ["tenantId", "userId", "characterId", "relationshipId"]);
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId),
  });
}

export function normalizeTask(input: Task): Task {
  exactKeys(input, [
    "schemaVersion",
    "tenantId",
    "userId",
    "characterId",
    "relationshipId",
    "taskId",
    "title",
    "state",
    "workflowRunId",
    "revision",
    "createdAt",
    "updatedAt",
    "completedAt",
    "failureCode",
  ]);
  if (input.schemaVersion !== 1 || !taskStates.includes(input.state)) {
    throw new TypeError("Task schema or state is invalid");
  }
  assertRevision(input.revision);
  const scope = normalizeTaskScope({
    tenantId: input.tenantId,
    userId: input.userId,
    characterId: input.characterId,
    relationshipId: input.relationshipId,
  });
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  const completedAt =
    input.completedAt === null ? null : toInstant(input.completedAt);
  const terminal = terminalTaskStates.has(input.state);

  if (
    updatedAt < createdAt ||
    (terminal && (completedAt === null || completedAt !== updatedAt)) ||
    (!terminal && completedAt !== null) ||
    (input.state === "failed" && input.failureCode === null) ||
    (input.state !== "failed" && input.failureCode !== null)
  ) {
    throw new TypeError("Task lifecycle is inconsistent");
  }

  return Object.freeze({
    ...scope,
    schemaVersion: 1,
    taskId: parseCanonicalId("task", input.taskId),
    title: boundedText(input.title, "Task title", 160),
    state: input.state,
    workflowRunId:
      input.workflowRunId === null
        ? null
        : parseCanonicalId("workflow-run", input.workflowRunId),
    revision: input.revision,
    createdAt,
    updatedAt,
    completedAt,
    failureCode:
      input.failureCode === null ? null : boundedCode(input.failureCode),
  });
}

export function assertTaskTransition(from: TaskState, to: TaskState): void {
  if (!taskStates.includes(from) || !taskStates.includes(to)) {
    throw new TypeError("Task state is invalid");
  }
  if (!taskTransitions[from].includes(to)) {
    throw new PlatformError({
      code: "workflows.task_transition_invalid",
      category: "conflict",
      message: `Task cannot transition from ${from} to ${to}`,
      retryable: false,
    });
  }
}

export type TaskAction = "create" | "read" | "update" | "cancel";

export function assertTaskAccess(
  authority: AuthorityContext,
  task: Pick<Task, keyof TaskScope | "taskId">,
  action: TaskAction,
  at: Instant,
): void {
  const taskScope = authority.resourceScope.taskIds;
  const scopedTask =
    action === "create" ||
    taskScope === undefined ||
    taskScope.includes(task.taskId);
  const valid =
    authority.tenantId === task.tenantId &&
    authority.capabilities.includes(`workflows.task.${action}`) &&
    authority.resourceScope.relationshipIds?.includes(task.relationshipId) === true &&
    (authority.principal.kind === "user"
      ? authority.principal.userId === task.userId
      : authority.capabilities.includes("workflows.task.manage-other")) &&
    authority.issuedAt <= at &&
    (!authority.expiresAt || authority.expiresAt > at) &&
    scopedTask;

  if (!valid) {
    throw new PlatformError({
      code: "workflows.task_access_denied",
      category: "authorization",
      message: "Current authority does not allow this Task operation",
      retryable: false,
    });
  }
}

export interface TaskRepository {
  create(input: {
    readonly authority: AuthorityContext;
    readonly task: Task;
  }): Promise<Task>;

  read(input: {
    readonly authority: AuthorityContext;
    readonly scope: TaskScope;
    readonly taskId: TaskId;
  }): Promise<Task>;

  listForRelationship(input: {
    readonly authority: AuthorityContext;
    readonly scope: TaskScope;
    readonly states?: readonly TaskState[];
    readonly limit: number;
  }): Promise<readonly Task[]>;

  transition(input: {
    readonly authority: AuthorityContext;
    readonly scope: TaskScope;
    readonly taskId: TaskId;
    readonly expectedRevision: number;
    readonly to: TaskState;
    readonly updatedAt: Instant;
    readonly failureCode?: string;
    readonly workflowRunId?: WorkflowRunId | null;
  }): Promise<Task>;
}

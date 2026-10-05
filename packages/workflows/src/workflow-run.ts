import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type ApprovalId,
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

export interface WorkflowRunScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface WorkflowRun extends WorkflowRunScope {
  readonly schemaVersion: 1;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly taskId: TaskId | null;
  readonly state: WorkflowRunState;
  readonly revision: number;
  readonly checkpointRevision: number;
  readonly pendingApprovalIds: readonly ApprovalId[];
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly completedAt: Instant | null;
  readonly failureCode: string | null;
}

export interface WorkflowCheckpoint {
  readonly schemaVersion: 1;
  readonly workflowRunId: WorkflowRunId;
  readonly checkpointRevision: number;
  readonly graphSignature: string;
  readonly committedState: Readonly<Record<string, JsonValue>>;
  readonly executorState: Readonly<Record<string, JsonValue>>;
  readonly edgeState: Readonly<Record<string, JsonValue>>;
  readonly pendingApprovalIds: readonly ApprovalId[];
  readonly createdAt: Instant;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<Record<string, JsonValue>>;

const terminalStates = new Set<WorkflowRunState>([
  "completed",
  "failed",
  "cancelled",
]);

const transitions: Readonly<Record<WorkflowRunState, readonly WorkflowRunState[]>> =
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
    throw new TypeError("Workflow value is invalid");
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    throw new TypeError("Workflow value has unknown fields");
  }
}

function assertRevision(value: number, name: string, allowZero = false): void {
  const min = allowZero ? 0 : 1;
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError(`${name} is invalid`);
  }
}

function boundedCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 160 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("Workflow failureCode is invalid");
  }
  return normalized;
}

function graphSignature(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 256 ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError("Workflow graphSignature is invalid");
  }
  return normalized;
}

function approvalIds(values: readonly ApprovalId[]): readonly ApprovalId[] {
  if (!Array.isArray(values) || values.length > 64) {
    throw new RangeError("Workflow approval references exceed their bound");
  }
  const parsed = values.map((value) => parseCanonicalId("approval", value));
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError("Workflow approval references must be unique");
  }
  return Object.freeze(parsed.sort());
}

function normalizeJsonValue(
  value: unknown,
  depth: number,
  budget: { remaining: number },
): JsonValue {
  if (depth > 16 || --budget.remaining < 0) {
    throw new RangeError("Workflow checkpoint state exceeds its bound");
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    if (typeof value === "string" && value.length > 64_000) {
      throw new RangeError("Workflow checkpoint string exceeds its bound");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Workflow checkpoint number must be finite");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 1024) {
      throw new RangeError("Workflow checkpoint array exceeds its bound");
    }
    return Object.freeze(
      value.map((item) => normalizeJsonValue(item, depth + 1, budget)),
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Workflow checkpoint object must be plain");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 512) {
      throw new RangeError("Workflow checkpoint object exceeds its bound");
    }
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of entries) {
      if (!key || key.length > 256 || /[\r\n\0]/u.test(key)) {
        throw new TypeError("Workflow checkpoint key is invalid");
      }
      result[key] = normalizeJsonValue(item, depth + 1, budget);
    }
    return Object.freeze(result);
  }
  throw new TypeError("Workflow checkpoint contains a non-JSON value");
}

function normalizeJsonRecord(
  value: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  const normalized = normalizeJsonValue(value, 0, { remaining: 10_000 });
  if (
    normalized === null ||
    Array.isArray(normalized) ||
    typeof normalized !== "object"
  ) {
    throw new TypeError("Workflow checkpoint state must be an object");
  }
  return normalized;
}

export function normalizeWorkflowRunScope(
  input: WorkflowRunScope,
): WorkflowRunScope {
  exactKeys(input, ["tenantId", "userId", "characterId", "relationshipId"]);
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId),
  });
}

export function normalizeWorkflowRun(input: WorkflowRun): WorkflowRun {
  exactKeys(input, [
    "schemaVersion",
    "tenantId",
    "userId",
    "characterId",
    "relationshipId",
    "workflowRunId",
    "workflowVersionId",
    "taskId",
    "state",
    "revision",
    "checkpointRevision",
    "pendingApprovalIds",
    "createdAt",
    "updatedAt",
    "completedAt",
    "failureCode",
  ]);
  if (
    input.schemaVersion !== 1 ||
    !workflowRunStates.includes(input.state)
  ) {
    throw new TypeError("WorkflowRun schema or state is invalid");
  }
  assertRevision(input.revision, "WorkflowRun revision");
  assertRevision(
    input.checkpointRevision,
    "WorkflowRun checkpointRevision",
    true,
  );
  const scope = normalizeWorkflowRunScope(input);
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  const completedAt =
    input.completedAt === null ? null : toInstant(input.completedAt);
  const pending = approvalIds(input.pendingApprovalIds);
  const terminal = terminalStates.has(input.state);

  if (
    updatedAt < createdAt ||
    (terminal && (completedAt === null || completedAt !== updatedAt)) ||
    (!terminal && completedAt !== null) ||
    (input.state === "failed" && input.failureCode === null) ||
    (input.state !== "failed" && input.failureCode !== null) ||
    (input.state === "waiting_approval" && pending.length === 0) ||
    (input.state !== "waiting_approval" && pending.length > 0)
  ) {
    throw new TypeError("WorkflowRun lifecycle is inconsistent");
  }

  return Object.freeze({
    ...scope,
    schemaVersion: 1,
    workflowRunId: parseCanonicalId("workflow-run", input.workflowRunId),
    workflowVersionId: parseCanonicalId(
      "workflow-version",
      input.workflowVersionId,
    ),
    taskId:
      input.taskId === null ? null : parseCanonicalId("task", input.taskId),
    state: input.state,
    revision: input.revision,
    checkpointRevision: input.checkpointRevision,
    pendingApprovalIds: pending,
    createdAt,
    updatedAt,
    completedAt,
    failureCode:
      input.failureCode === null ? null : boundedCode(input.failureCode),
  });
}

export function normalizeWorkflowCheckpoint(
  input: WorkflowCheckpoint,
): WorkflowCheckpoint {
  exactKeys(input, [
    "schemaVersion",
    "workflowRunId",
    "checkpointRevision",
    "graphSignature",
    "committedState",
    "executorState",
    "edgeState",
    "pendingApprovalIds",
    "createdAt",
  ]);
  if (input.schemaVersion !== 1) {
    throw new TypeError("Workflow checkpoint schema is invalid");
  }
  assertRevision(input.checkpointRevision, "Workflow checkpointRevision");
  return Object.freeze({
    schemaVersion: 1,
    workflowRunId: parseCanonicalId("workflow-run", input.workflowRunId),
    checkpointRevision: input.checkpointRevision,
    graphSignature: graphSignature(input.graphSignature),
    committedState: normalizeJsonRecord(input.committedState),
    executorState: normalizeJsonRecord(input.executorState),
    edgeState: normalizeJsonRecord(input.edgeState),
    pendingApprovalIds: approvalIds(input.pendingApprovalIds),
    createdAt: toInstant(input.createdAt),
  });
}

export function assertWorkflowRunTransition(
  from: WorkflowRunState,
  to: WorkflowRunState,
): void {
  if (!workflowRunStates.includes(from) || !workflowRunStates.includes(to)) {
    throw new TypeError("WorkflowRun state is invalid");
  }
  if (!transitions[from].includes(to)) {
    throw new PlatformError({
      code: "workflows.run_transition_invalid",
      category: "conflict",
      message: `WorkflowRun cannot transition from ${from} to ${to}`,
      retryable: false,
    });
  }
}

export type WorkflowRunAction =
  | "create"
  | "read"
  | "update"
  | "checkpoint"
  | "cancel";

export function assertWorkflowRunAccess(
  authority: AuthorityContext,
  run: Pick<WorkflowRun, keyof WorkflowRunScope | "workflowRunId">,
  action: WorkflowRunAction,
  at: Instant,
): void {
  const scopedRun =
    action === "create" ||
    authority.resourceScope.workflowRunIds?.includes(run.workflowRunId) === true;
  const valid =
    authority.tenantId === run.tenantId &&
    authority.capabilities.includes(`workflows.run.${action}`) &&
    authority.resourceScope.relationshipIds?.includes(run.relationshipId) === true &&
    (authority.principal.kind === "user"
      ? authority.principal.userId === run.userId
      : authority.capabilities.includes("workflows.run.manage-other")) &&
    authority.issuedAt <= at &&
    (!authority.expiresAt || authority.expiresAt > at) &&
    scopedRun;

  if (!valid) {
    throw new PlatformError({
      code: "workflows.run_access_denied",
      category: "authorization",
      message: "Current authority does not allow this WorkflowRun operation",
      retryable: false,
    });
  }
}

export interface WorkflowRunRepository {
  create(input: {
    readonly authority: AuthorityContext;
    readonly run: WorkflowRun;
  }): Promise<WorkflowRun>;

  read(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRunId;
  }): Promise<WorkflowRun>;

  listForRelationship(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly states?: readonly WorkflowRunState[];
    readonly limit: number;
  }): Promise<readonly WorkflowRun[]>;

  transition(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRunId;
    readonly expectedRevision: number;
    readonly to: WorkflowRunState;
    readonly updatedAt: Instant;
    readonly failureCode?: string;
    readonly pendingApprovalIds?: readonly ApprovalId[];
  }): Promise<WorkflowRun>;

  appendCheckpoint(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly expectedRunRevision: number;
    readonly checkpoint: WorkflowCheckpoint;
  }): Promise<WorkflowRun>;

  readLatestCheckpoint(input: {
    readonly authority: AuthorityContext;
    readonly scope: WorkflowRunScope;
    readonly workflowRunId: WorkflowRunId;
  }): Promise<WorkflowCheckpoint | null>;
}

import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type AgentRunId,
  type CharacterSessionId,
  type CharacterVersionId,
  type CorrelationId,
  type Instant,
  type OperationId,
  type RequestId,
  type TaskId,
  type TenantId,
  type UserId,
  type CharacterId,
  type RelationshipId,
  type WorkflowRunId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";

export const agentRunStates = ["running", "completed", "failed"] as const;
export type AgentRunState = (typeof agentRunStates)[number];

export interface AgentRunScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface AgentRunLineage {
  readonly parentAgentRunId: AgentRunId | null;
  readonly rootAgentRunId: AgentRunId;
  readonly depth: number;
}

export interface AgentRunTraceReferences {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly taskId: TaskId | null;
  readonly workflowRunId: WorkflowRunId | null;
  readonly operationIds: readonly OperationId[];
}

export interface AgentRun extends AgentRunScope {
  readonly schemaVersion: 1;
  readonly agentRunId: AgentRunId;
  readonly characterSessionId: CharacterSessionId;
  readonly characterVersionId: CharacterVersionId;
  readonly lineage: AgentRunLineage;
  readonly trace: AgentRunTraceReferences;
  readonly state: AgentRunState;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly completedAt: Instant | null;
  readonly failureCode: string | null;
}

function exactKeys(value: object, keys: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("AgentRun value is invalid");
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    throw new TypeError("AgentRun value has unknown fields");
  }
}

function boundedCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 160 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("AgentRun failureCode is invalid");
  }
  return normalized;
}

export function normalizeAgentRunScope(input: AgentRunScope): AgentRunScope {
  exactKeys(input, ["tenantId", "userId", "characterId", "relationshipId"]);
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId),
  });
}

export function normalizeAgentRunLineage(
  input: AgentRunLineage,
  agentRunId: AgentRunId,
): AgentRunLineage {
  exactKeys(input, ["parentAgentRunId", "rootAgentRunId", "depth"]);
  if (!Number.isSafeInteger(input.depth) || input.depth < 0 || input.depth > 32) {
    throw new RangeError("AgentRun lineage depth is invalid");
  }
  const parentAgentRunId =
    input.parentAgentRunId === null
      ? null
      : parseCanonicalId("agent-run", input.parentAgentRunId);
  const rootAgentRunId = parseCanonicalId("agent-run", input.rootAgentRunId);

  if (
    (input.depth === 0 &&
      (parentAgentRunId !== null || rootAgentRunId !== agentRunId)) ||
    (input.depth > 0 &&
      (parentAgentRunId === null || rootAgentRunId === agentRunId))
  ) {
    throw new TypeError("AgentRun lineage is inconsistent");
  }

  return Object.freeze({
    parentAgentRunId,
    rootAgentRunId,
    depth: input.depth,
  });
}

export function normalizeAgentRunTraceReferences(
  input: AgentRunTraceReferences,
): AgentRunTraceReferences {
  exactKeys(input, [
    "requestId",
    "correlationId",
    "taskId",
    "workflowRunId",
    "operationIds",
  ]);
  if (!Array.isArray(input.operationIds) || input.operationIds.length > 64) {
    throw new RangeError("AgentRun operation references exceed their bound");
  }
  const operationIds = input.operationIds.map((id) =>
    parseCanonicalId("operation", id),
  );
  if (new Set(operationIds).size !== operationIds.length) {
    throw new TypeError("AgentRun operation references must be unique");
  }
  return Object.freeze({
    requestId: parseCanonicalId("request", input.requestId),
    correlationId: parseCanonicalId("correlation", input.correlationId),
    taskId:
      input.taskId === null ? null : parseCanonicalId("task", input.taskId),
    workflowRunId:
      input.workflowRunId === null
        ? null
        : parseCanonicalId("workflow-run", input.workflowRunId),
    operationIds: Object.freeze(operationIds.sort()),
  });
}

export function normalizeAgentRun(input: AgentRun): AgentRun {
  exactKeys(input, [
    "schemaVersion",
    "tenantId",
    "userId",
    "characterId",
    "relationshipId",
    "agentRunId",
    "characterSessionId",
    "characterVersionId",
    "lineage",
    "trace",
    "state",
    "startedAt",
    "updatedAt",
    "completedAt",
    "failureCode",
  ]);
  if (input.schemaVersion !== 1 || !agentRunStates.includes(input.state)) {
    throw new TypeError("AgentRun schema or state is invalid");
  }

  const scope = normalizeAgentRunScope({
    tenantId: input.tenantId,
    userId: input.userId,
    characterId: input.characterId,
    relationshipId: input.relationshipId,
  });
  const agentRunId = parseCanonicalId("agent-run", input.agentRunId);
  const startedAt = toInstant(input.startedAt);
  const updatedAt = toInstant(input.updatedAt);
  const completedAt =
    input.completedAt === null ? null : toInstant(input.completedAt);
  if (
    updatedAt < startedAt ||
    (input.state === "running" &&
      (completedAt !== null || input.failureCode !== null)) ||
    (input.state === "completed" &&
      (completedAt === null ||
        completedAt !== updatedAt ||
        input.failureCode !== null)) ||
    (input.state === "failed" &&
      (completedAt === null ||
        completedAt !== updatedAt ||
        input.failureCode === null))
  ) {
    throw new TypeError("AgentRun lifecycle is inconsistent");
  }

  return Object.freeze({
    ...scope,
    schemaVersion: 1,
    agentRunId,
    characterSessionId: parseCanonicalId(
      "character-session",
      input.characterSessionId,
    ),
    characterVersionId: parseCanonicalId(
      "character-version",
      input.characterVersionId,
    ),
    lineage: normalizeAgentRunLineage(input.lineage, agentRunId),
    trace: normalizeAgentRunTraceReferences(input.trace),
    state: input.state,
    startedAt,
    updatedAt,
    completedAt,
    failureCode:
      input.failureCode === null ? null : boundedCode(input.failureCode),
  });
}

export type AgentRunAction = "create" | "read" | "finish";

export function assertAgentRunAccess(
  authority: AuthorityContext,
  scope: AgentRunScope,
  action: AgentRunAction,
  trace: AgentRunTraceReferences,
  at: Instant,
): void {
  const valid =
    authority.tenantId === scope.tenantId &&
    authority.capabilities.includes(`agents.run.${action}`) &&
    authority.resourceScope.relationshipIds?.includes(scope.relationshipId) &&
    (authority.principal.kind === "user"
      ? authority.principal.userId === scope.userId
      : authority.capabilities.includes("agents.run.manage-other")) &&
    authority.issuedAt <= at &&
    (!authority.expiresAt || authority.expiresAt > at) &&
    (trace.taskId === null ||
      authority.resourceScope.taskIds?.includes(trace.taskId)) &&
    (trace.workflowRunId === null ||
      authority.resourceScope.workflowRunIds?.includes(trace.workflowRunId));

  if (!valid) {
    throw new PlatformError({
      code: "agents.run_access_denied",
      category: "authorization",
      message: "Current authority does not allow this AgentRun operation",
      retryable: false,
    });
  }
}

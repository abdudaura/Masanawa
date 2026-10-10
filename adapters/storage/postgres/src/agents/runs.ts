import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  assertAgentRunAccess,
  normalizeAgentRun,
  normalizeAgentRunLineage,
  normalizeAgentRunScope,
  normalizeAgentRunTraceReferences,
  type AgentRun,
  type AgentRunAction,
  type AgentRunRepository,
  type AgentRunRequest,
  type CreateAgentRunInput,
  type FinishAgentRunInput,
} from "@masanawa/agents";
import {
  assertCurrentAuthority,
  canonicalJson,
  createAuthorityContext,
} from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";

interface RunRow {
  tenant_id: AgentRun["tenantId"];
  agent_run_id: AgentRun["agentRunId"];
  user_id: AgentRun["userId"];
  character_id: AgentRun["characterId"];
  relationship_id: AgentRun["relationshipId"];
  character_session_id: AgentRun["characterSessionId"];
  character_version_id: AgentRun["characterVersionId"];
  parent_agent_run_id: AgentRun["lineage"]["parentAgentRunId"];
  root_agent_run_id: AgentRun["lineage"]["rootAgentRunId"];
  lineage_depth: number;
  request_id: AgentRun["trace"]["requestId"];
  correlation_id: AgentRun["trace"]["correlationId"];
  task_id: AgentRun["trace"]["taskId"];
  workflow_run_id: AgentRun["trace"]["workflowRunId"];
  operation_ids: AgentRun["trace"]["operationIds"];
  state: AgentRun["state"];
  failure_code: string | null;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface SessionRow {
  tenant_id: AgentRun["tenantId"];
  character_session_id: AgentRun["characterSessionId"];
  user_id: AgentRun["userId"];
  character_id: AgentRun["characterId"];
  relationship_id: AgentRun["relationshipId"];
  character_version_id: AgentRun["characterVersionId"];
  state: "active" | "closed";
  revision: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  closed_at: Date | null;
  close_reason: "ended" | "reset" | null;
  successor_session_id: AgentRun["characterSessionId"] | null;
  bindings: unknown;
  schema_version: 1;
}

function sameAdmission(
  run: AgentRun,
  input: CreateAgentRunInput,
): boolean {
  return (
    run.tenantId === input.scope.tenantId &&
    run.userId === input.scope.userId &&
    run.characterId === input.scope.characterId &&
    run.relationshipId === input.scope.relationshipId &&
    run.agentRunId === input.agentRunId &&
    run.characterSessionId === input.characterSessionId &&
    run.characterVersionId === input.characterVersionId &&
    JSON.stringify(run.lineage) === JSON.stringify(input.lineage) &&
    JSON.stringify(run.trace) === JSON.stringify(input.trace)
  );
}

function rowToRun(row: RunRow): AgentRun {
  return normalizeAgentRun({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    userId: row.user_id,
    characterId: row.character_id,
    relationshipId: row.relationship_id,
    agentRunId: row.agent_run_id,
    characterSessionId: row.character_session_id,
    characterVersionId: row.character_version_id,
    lineage: {
      parentAgentRunId: row.parent_agent_run_id,
      rootAgentRunId: row.root_agent_run_id,
      depth: row.lineage_depth,
    },
    trace: {
      requestId: row.request_id,
      correlationId: row.correlation_id,
      taskId: row.task_id,
      workflowRunId: row.workflow_run_id,
      operationIds: row.operation_ids,
    },
    state: row.state,
    startedAt: toInstant(row.started_at),
    updatedAt: toInstant(row.updated_at),
    completedAt:
      row.completed_at === null ? null : toInstant(row.completed_at),
    failureCode: row.failure_code,
  });
}

function conflict(message = "AgentRun changed or conflicted"): PlatformError {
  return new PlatformError({
    code: "agents.run_conflict",
    category: "conflict",
    message,
    retryable: false,
  });
}

function missing(): PlatformError {
  return new PlatformError({
    code: "agents.run_not_found",
    category: "not-found",
    message: "AgentRun was not found in the authorized relationship",
    retryable: false,
  });
}

async function clock(client: PoolClient): Promise<Instant> {
  const result = await client.query<{ at: Date }>(
    "SELECT clock_timestamp() AS at",
  );
  return toInstant(result.rows[0]!.at);
}

function capture(raw: AgentRunRequest): AgentRunRequest {
  const authority = Object.freeze({
    ...createAuthorityContext({
      ...raw.authority,
      issuedAt: toInstant(raw.authority.issuedAt),
      ...(raw.authority.expiresAt
        ? { expiresAt: toInstant(raw.authority.expiresAt) }
        : {}),
    }),
    authorityContextId: parseCanonicalId(
      "authority-context",
      raw.authority.authorityContextId,
    ),
    principal: Object.freeze({ ...raw.authority.principal }),
  });

  return Object.freeze({
    authority,
    scope: normalizeAgentRunScope(raw.scope),
    agentRunId: parseCanonicalId("agent-run", raw.agentRunId),
  });
}

function admissionTrace(request: AgentRunRequest): AgentRun["trace"] {
  return normalizeAgentRunTraceReferences({
    requestId: parseCanonicalId("request", request.authority.requestId),
    correlationId: parseCanonicalId(
      "correlation",
      request.authority.correlationId,
    ),
    taskId: null,
    workflowRunId: null,
    operationIds: [],
  });
}

async function admit(
  client: PoolClient,
  request: AgentRunRequest,
  action: AgentRunAction,
  trace: AgentRun["trace"],
): Promise<void> {
  const at = await clock(client);
  assertAgentRunAccess(request.authority, request.scope, action, trace, at);
  await assertCurrentAuthority(
    request.authority,
    createPostgresCurrentAuthoritySource(client),
    at,
  );
}

async function loadSession(
  client: PoolClient,
  input: CreateAgentRunInput,
): Promise<SessionRow> {
  const scope = input.scope;
  const result = await client.query<SessionRow>(
    `SELECT *
       FROM agents.character_sessions
      WHERE tenant_id = $1
        AND character_session_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      FOR SHARE`,
    [
      scope.tenantId,
      input.characterSessionId,
      scope.userId,
      scope.characterId,
      scope.relationshipId,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "agents.session_not_found",
      category: "not-found",
      message: "CharacterSession was not found for AgentRun admission",
      retryable: false,
    });
  }

  const at = await clock(client);
  if (
    row.character_version_id !== input.characterVersionId ||
    row.state !== "active" ||
    toInstant(row.expires_at) <= at
  ) {
    throw conflict("CharacterSession cannot admit this AgentRun");
  }
  return row;
}

async function loadRun(
  client: PoolClient,
  request: AgentRunRequest,
  write: boolean,
): Promise<RunRow> {
  const scope = request.scope;
  const result = await client.query<RunRow>(
    `SELECT *
       FROM agents.agent_runs
      WHERE tenant_id = $1
        AND agent_run_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      ${write ? "FOR UPDATE" : ""}`,
    [
      scope.tenantId,
      request.agentRunId,
      scope.userId,
      scope.characterId,
      scope.relationshipId,
    ],
  );
  if (!result.rows[0]) throw missing();
  return result.rows[0];
}

async function validateLineage(
  client: PoolClient,
  input: CreateAgentRunInput,
): Promise<void> {
  const lineage = input.lineage;
  if (lineage.depth === 0) return;

  const parentId = lineage.parentAgentRunId;
  if (parentId === null) throw conflict("AgentRun parent is required");
  const result = await client.query<RunRow>(
    `SELECT *
       FROM agents.agent_runs
      WHERE tenant_id = $1 AND agent_run_id = $2
      FOR SHARE`,
    [input.scope.tenantId, parentId],
  );
  const parent = result.rows[0];
  if (
    !parent ||
    parent.user_id !== input.scope.userId ||
    parent.character_id !== input.scope.characterId ||
    parent.relationship_id !== input.scope.relationshipId ||
    parent.character_session_id !== input.characterSessionId ||
    parent.root_agent_run_id !== lineage.rootAgentRunId ||
    parent.lineage_depth + 1 !== lineage.depth
  ) {
    throw conflict("AgentRun lineage does not match its parent");
  }
}

export function createPostgresAgentRunRepository(
  pool: Pool,
): AgentRunRepository {
  return Object.freeze({
    async create(raw: CreateAgentRunInput) {
      const request = capture(raw);
      const characterSessionId = parseCanonicalId(
        "character-session",
        raw.characterSessionId,
      );
      const characterVersionId = parseCanonicalId(
        "character-version",
        raw.characterVersionId,
      );
      const lineage = normalizeAgentRunLineage(
        raw.lineage,
        request.agentRunId,
      );
      const trace = normalizeAgentRunTraceReferences(raw.trace);
      const input = {
        ...request,
        characterSessionId,
        characterVersionId,
        lineage,
        trace,
      };

      return withTransaction(pool, async (client) => {
        await admit(client, request, "create", trace);

        const replay = await client.query<RunRow>(
          `SELECT *
             FROM agents.agent_runs
            WHERE tenant_id = $1 AND agent_run_id = $2
            FOR SHARE`,
          [input.scope.tenantId, input.agentRunId],
        );
        if (replay.rows[0]) {
          const existing = rowToRun(replay.rows[0]);
          if (!sameAdmission(existing, input)) throw conflict();
          await admit(client, request, "create", existing.trace);
          return existing;
        }

        await loadSession(client, input);
        await validateLineage(client, input);
        const at = await clock(client);

        const result = await client.query<RunRow>(
          `INSERT INTO agents.agent_runs(
             tenant_id, agent_run_id, user_id, character_id, relationship_id,
             character_session_id, character_version_id,
             parent_agent_run_id, root_agent_run_id, lineage_depth,
             request_id, correlation_id, task_id, workflow_run_id,
             operation_ids, state, started_at, updated_at
           )
           VALUES(
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             $15::jsonb,'running',$16,$16
           )
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            input.scope.tenantId,
            input.agentRunId,
            input.scope.userId,
            input.scope.characterId,
            input.scope.relationshipId,
            input.characterSessionId,
            input.characterVersionId,
            input.lineage.parentAgentRunId,
            input.lineage.rootAgentRunId,
            input.lineage.depth,
            input.trace.requestId,
            input.trace.correlationId,
            input.trace.taskId,
            input.trace.workflowRunId,
            canonicalJson(input.trace.operationIds),
            at,
          ],
        );

        if (!result.rows[0]) {
          const byRun = await client.query<RunRow>(
            `SELECT *
               FROM agents.agent_runs
              WHERE tenant_id = $1 AND agent_run_id = $2
              FOR SHARE`,
            [input.scope.tenantId, input.agentRunId],
          );
          const existing = byRun.rows[0];
          if (!existing) {
            const byRequest = await client.query<{ agent_run_id: string }>(
              `SELECT agent_run_id
                 FROM agents.agent_runs
                WHERE tenant_id = $1 AND request_id = $2
                FOR SHARE`,
              [input.scope.tenantId, input.trace.requestId],
            );
            if (byRequest.rows[0]) {
              throw conflict("Request is already bound to another AgentRun");
            }
            throw conflict();
          }
          const normalized = rowToRun(existing);
          if (!sameAdmission(normalized, input)) throw conflict();
          return normalized;
        }

        assertAgentRunAccess(
          request.authority,
          request.scope,
          "create",
          trace,
          await clock(client),
        );
        return rowToRun(result.rows[0]);
      });
    },

    async read(raw: AgentRunRequest) {
      const request = capture(raw);
      return withTransaction(
        pool,
        async (client) => {
          await admit(client, request, "read", admissionTrace(request));
          const row = await loadRun(client, request, false);
          const run = rowToRun(row);
          await admit(client, request, "read", run.trace);
          return run;
        },
        // Authority revocation fencing acquires FOR SHARE on policy state.
        // PostgreSQL forbids row locks in READ ONLY transactions, even when
        // the AgentRun itself is queried without a lock.
        { isolation: "repeatable read" },
      );
    },

    async finish(raw: FinishAgentRunInput) {
      const request = capture(raw);
      const outcome =
        raw.outcome.state === "failed"
          ? Object.freeze({
              state: "failed" as const,
              failureCode: raw.outcome.failureCode.trim().toLowerCase(),
            })
          : Object.freeze({ state: "completed" as const });

      return withTransaction(pool, async (client) => {
        await admit(client, request, "finish", admissionTrace(request));
        const current = rowToRun(await loadRun(client, request, true));
        await admit(client, request, "finish", current.trace);
        if (current.state !== "running") {
          if (
            current.state === outcome.state &&
            (outcome.state !== "failed" ||
              current.failureCode === outcome.failureCode)
          ) {
            return current;
          }
          throw conflict("AgentRun is already terminal");
        }

        const at = await clock(client);
        const result = await client.query<RunRow>(
          `UPDATE agents.agent_runs
              SET state = $3,
                  failure_code = $4,
                  completed_at = $5,
                  updated_at = $5
            WHERE tenant_id = $1
              AND agent_run_id = $2
              AND state = 'running'
            RETURNING *`,
          [
            request.scope.tenantId,
            request.agentRunId,
            outcome.state,
            outcome.state === "failed" ? outcome.failureCode : null,
            at,
          ],
        );
        if (!result.rows[0]) throw conflict();

        await admit(client, request, "finish", current.trace);
        return rowToRun(result.rows[0]);
      });
    },
  });
}

/** Reuses canonical trace/authority admission inside a composing transaction. */
export async function readPostgresAgentRunForContext(client: PoolClient,
  raw: AgentRunRequest): Promise<AgentRun> {
  const request = capture(raw);
  await admit(client, request, "read", admissionTrace(request));
  const run = rowToRun(await loadRun(client, request, false));
  await admit(client, request, "read", run.trace);
  return run;
}


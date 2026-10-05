import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  assertWorkAccess,
  canTransitionWork,
  normalizeTask,
  normalizeWorkScope,
  normalizeWorkflowRun,
  type Task,
  type TaskCreateInput,
  type TaskTransitionInput,
  type WorkflowRepository,
  type WorkflowRun,
  type WorkflowRunCreateInput,
  type WorkflowRunTransitionInput,
  type WorkRequest,
} from "@masanawa/workflows";
import {
  assertCurrentAuthority,
  createAuthorityContext,
} from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";

interface TaskRow {
  tenant_id: Task["tenantId"];
  task_id: Task["taskId"];
  user_id: Task["userId"];
  character_id: Task["characterId"];
  relationship_id: Task["relationshipId"];
  title: string;
  state: Task["state"];
  workflow_run_id: Task["workflowRunId"];
  active_agent_run_id: Task["activeAgentRunId"];
  revision: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  failure_code: string | null;
}

interface WorkflowRunRow {
  tenant_id: WorkflowRun["tenantId"];
  workflow_run_id: WorkflowRun["workflowRunId"];
  workflow_version_id: WorkflowRun["workflowVersionId"];
  task_id: WorkflowRun["taskId"];
  user_id: WorkflowRun["userId"];
  character_id: WorkflowRun["characterId"];
  relationship_id: WorkflowRun["relationshipId"];
  state: WorkflowRun["state"];
  checkpoint_revision: string;
  active_agent_run_id: WorkflowRun["activeAgentRunId"];
  revision: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  failure_code: string | null;
}

function task(row: TaskRow): Task {
  return normalizeTask({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    userId: row.user_id,
    characterId: row.character_id,
    relationshipId: row.relationship_id,
    title: row.title,
    state: row.state,
    workflowRunId: row.workflow_run_id,
    activeAgentRunId: row.active_agent_run_id,
    revision: Number(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    completedAt: row.completed_at === null ? null : toInstant(row.completed_at),
    failureCode: row.failure_code,
  });
}

function workflowRun(row: WorkflowRunRow): WorkflowRun {
  return normalizeWorkflowRun({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    taskId: row.task_id,
    userId: row.user_id,
    characterId: row.character_id,
    relationshipId: row.relationship_id,
    state: row.state,
    checkpointRevision: Number(row.checkpoint_revision),
    activeAgentRunId: row.active_agent_run_id,
    revision: Number(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    completedAt: row.completed_at === null ? null : toInstant(row.completed_at),
    failureCode: row.failure_code,
  });
}

function conflict(message = "Work changed or cannot accept this transition"): PlatformError {
  return new PlatformError({
    code: "workflows.work_conflict",
    category: "conflict",
    message,
    retryable: false,
  });
}

async function clock(client: PoolClient): Promise<Instant> {
  const result = await client.query<{ at: Date }>("SELECT clock_timestamp() AS at");
  return toInstant(result.rows[0]!.at);
}

function capture(input: WorkRequest): WorkRequest {
  const authority = Object.freeze({
    ...createAuthorityContext({
      ...input.authority,
      issuedAt: toInstant(input.authority.issuedAt),
      ...(input.authority.expiresAt
        ? { expiresAt: toInstant(input.authority.expiresAt) }
        : {}),
    }),
    authorityContextId: parseCanonicalId(
      "authority-context",
      input.authority.authorityContextId,
    ),
    principal: Object.freeze({ ...input.authority.principal }),
  });
  return Object.freeze({
    authority,
    scope: normalizeWorkScope(input.scope),
  });
}

async function admit(
  client: PoolClient,
  request: WorkRequest,
  action: Parameters<typeof assertWorkAccess>[2],
): Promise<void> {
  const at = await clock(client);
  assertWorkAccess(request.authority, request.scope, action, at);
  await assertCurrentAuthority(
    request.authority,
    createPostgresCurrentAuthoritySource(client),
    at,
  );
}

async function assertActiveRelationship(
  client: PoolClient,
  request: WorkRequest,
): Promise<void> {
  const s = request.scope;
  const result = await client.query<{ state: string }>(
    `SELECT state
       FROM identity.relationships
      WHERE tenant_id = $1
        AND relationship_id = $2
        AND user_id = $3
        AND character_id = $4
      FOR SHARE`,
    [s.tenantId, s.relationshipId, s.userId, s.characterId],
  );
  if (result.rows[0]?.state !== "active") {
    throw new PlatformError({
      code: "workflows.relationship_unavailable",
      category: "authorization",
      message: "The relationship cannot admit new Work",
      retryable: false,
    });
  }
}

async function loadTask(
  client: PoolClient,
  request: WorkRequest,
  taskId: Task["taskId"],
  write: boolean,
): Promise<TaskRow | null> {
  const s = request.scope;
  const result = await client.query<TaskRow>(
    `SELECT *
       FROM workflows.tasks
      WHERE tenant_id = $1
        AND task_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [s.tenantId, taskId, s.userId, s.characterId, s.relationshipId],
  );
  return result.rows[0] ?? null;
}

async function loadRun(
  client: PoolClient,
  request: WorkRequest,
  workflowRunId: WorkflowRun["workflowRunId"],
  write: boolean,
): Promise<WorkflowRunRow | null> {
  const s = request.scope;
  const result = await client.query<WorkflowRunRow>(
    `SELECT *
       FROM workflows.workflow_runs
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [s.tenantId, workflowRunId, s.userId, s.characterId, s.relationshipId],
  );
  return result.rows[0] ?? null;
}

function terminal(state: Task["state"] | WorkflowRun["state"]): boolean {
  return state === "completed" || state === "failed" || state === "cancelled";
}

export function createPostgresWorkflowRepository(pool: Pool): WorkflowRepository {
  return Object.freeze({
    async createTask(raw: TaskCreateInput) {
      const request = capture(raw);
      const taskId = parseCanonicalId("task", raw.taskId);
      const title = raw.title.trim().replace(/\s+/gu, " ");
      if (!title || title.length > 240 || /[\r\n\0]/u.test(title)) {
        throw new TypeError("Task title is invalid");
      }
      return withTransaction(pool, async (client) => {
        await admit(client, request, "task.create");
        await assertActiveRelationship(client, request);
        const existing = await loadTask(client, request, taskId, false);
        if (existing) {
          const current = task(existing);
          if (current.title !== title) throw conflict("Task id already has different input");
          return current;
        }
        const at = await clock(client);
        const s = request.scope;
        const result = await client.query<TaskRow>(
          `INSERT INTO workflows.tasks(
             tenant_id, task_id, user_id, character_id, relationship_id,
             title, state, revision, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,'queued',1,$7,$7)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [s.tenantId, taskId, s.userId, s.characterId, s.relationshipId, title, at],
        );
        if (!result.rows[0]) throw conflict();
        await admit(client, request, "task.create");
        return task(result.rows[0]);
      });
    },

    async readTask(raw) {
      const request = capture(raw);
      const taskId = parseCanonicalId("task", raw.taskId);
      return withTransaction(
        pool,
        async (client) => {
          await admit(client, request, "task.read");
          const row = await loadTask(client, request, taskId, false);
          if (!row) return null;
          await admit(client, request, "task.read");
          return task(row);
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async transitionTask(raw: TaskTransitionInput) {
      const request = capture(raw);
      const taskId = parseCanonicalId("task", raw.taskId);
      if (!Number.isSafeInteger(raw.expectedRevision) || raw.expectedRevision < 1) {
        throw new RangeError("Task expectedRevision is invalid");
      }
      return withTransaction(pool, async (client) => {
        await admit(client, request, "task.update");
        await assertActiveRelationship(client, request);
        const row = await loadTask(client, request, taskId, true);
        if (!row) throw conflict("Task was not found");
        const current = task(row);
        if (
          current.revision !== raw.expectedRevision ||
          !canTransitionWork(current.state, raw.state)
        ) {
          throw conflict();
        }
        const at = await clock(client);
        const nextWorkflowRunId =
          raw.workflowRunId === undefined
            ? current.workflowRunId
            : raw.workflowRunId === null
              ? null
              : parseCanonicalId("workflow-run", raw.workflowRunId);
        const nextAgentRunId =
          raw.activeAgentRunId === undefined
            ? current.activeAgentRunId
            : raw.activeAgentRunId === null
              ? null
              : parseCanonicalId("agent-run", raw.activeAgentRunId);
        const failureCode =
          raw.state === "failed"
            ? (raw.failureCode ?? "").trim().toLowerCase()
            : null;
        if (raw.state === "failed" && !failureCode) {
          throw new TypeError("Failed Task requires failureCode");
        }
        const completedAt = terminal(raw.state) ? at : null;
        const result = await client.query<TaskRow>(
          `UPDATE workflows.tasks
              SET state = $4,
                  workflow_run_id = $5,
                  active_agent_run_id = $6,
                  revision = revision + 1,
                  updated_at = $7,
                  completed_at = $8,
                  failure_code = $9
            WHERE tenant_id = $1
              AND task_id = $2
              AND revision = $3
            RETURNING *`,
          [
            request.scope.tenantId,
            taskId,
            raw.expectedRevision,
            raw.state,
            nextWorkflowRunId,
            nextAgentRunId,
            at,
            completedAt,
            failureCode,
          ],
        );
        if (!result.rows[0]) throw conflict();
        await admit(client, request, "task.update");
        return task(result.rows[0]);
      });
    },

    async createWorkflowRun(raw: WorkflowRunCreateInput) {
      const request = capture(raw);
      const workflowRunId = parseCanonicalId("workflow-run", raw.workflowRunId);
      const workflowVersionId = parseCanonicalId("workflow-version", raw.workflowVersionId);
      const taskId = parseCanonicalId("task", raw.taskId);
      return withTransaction(pool, async (client) => {
        await admit(client, request, "run.create");
        await assertActiveRelationship(client, request);
        const owner = await loadTask(client, request, taskId, true);
        if (!owner || terminal(owner.state)) throw conflict("Task cannot admit WorkflowRun");
        const existing = await loadRun(client, request, workflowRunId, false);
        if (existing) {
          const current = workflowRun(existing);
          if (
            current.taskId !== taskId ||
            current.workflowVersionId !== workflowVersionId
          ) {
            throw conflict("WorkflowRun id already has different input");
          }
          return current;
        }
        const at = await clock(client);
        const s = request.scope;
        const result = await client.query<WorkflowRunRow>(
          `INSERT INTO workflows.workflow_runs(
             tenant_id, workflow_run_id, workflow_version_id, task_id,
             user_id, character_id, relationship_id, state,
             checkpoint_revision, revision, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',0,1,$8,$8)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            s.tenantId,
            workflowRunId,
            workflowVersionId,
            taskId,
            s.userId,
            s.characterId,
            s.relationshipId,
            at,
          ],
        );
        if (!result.rows[0]) throw conflict();
        await admit(client, request, "run.create");
        return workflowRun(result.rows[0]);
      });
    },

    async readWorkflowRun(raw) {
      const request = capture(raw);
      const workflowRunId = parseCanonicalId("workflow-run", raw.workflowRunId);
      return withTransaction(
        pool,
        async (client) => {
          await admit(client, request, "run.read");
          const row = await loadRun(client, request, workflowRunId, false);
          if (!row) return null;
          await admit(client, request, "run.read");
          return workflowRun(row);
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async transitionWorkflowRun(raw: WorkflowRunTransitionInput) {
      const request = capture(raw);
      const workflowRunId = parseCanonicalId("workflow-run", raw.workflowRunId);
      if (!Number.isSafeInteger(raw.expectedRevision) || raw.expectedRevision < 1) {
        throw new RangeError("WorkflowRun expectedRevision is invalid");
      }
      return withTransaction(pool, async (client) => {
        await admit(client, request, "run.update");
        await assertActiveRelationship(client, request);
        const row = await loadRun(client, request, workflowRunId, true);
        if (!row) throw conflict("WorkflowRun was not found");
        const current = workflowRun(row);
        if (
          current.revision !== raw.expectedRevision ||
          !canTransitionWork(current.state, raw.state)
        ) {
          throw conflict();
        }
        const checkpointRevision =
          raw.checkpointRevision === undefined
            ? current.checkpointRevision
            : raw.checkpointRevision;
        if (
          !Number.isSafeInteger(checkpointRevision) ||
          checkpointRevision < current.checkpointRevision
        ) {
          throw new RangeError("WorkflowRun checkpointRevision cannot move backward");
        }
        const nextAgentRunId =
          raw.activeAgentRunId === undefined
            ? current.activeAgentRunId
            : raw.activeAgentRunId === null
              ? null
              : parseCanonicalId("agent-run", raw.activeAgentRunId);
        const failureCode =
          raw.state === "failed"
            ? (raw.failureCode ?? "").trim().toLowerCase()
            : null;
        if (raw.state === "failed" && !failureCode) {
          throw new TypeError("Failed WorkflowRun requires failureCode");
        }
        const at = await clock(client);
        const completedAt = terminal(raw.state) ? at : null;
        const result = await client.query<WorkflowRunRow>(
          `UPDATE workflows.workflow_runs
              SET state = $4,
                  checkpoint_revision = $5,
                  active_agent_run_id = $6,
                  revision = revision + 1,
                  updated_at = $7,
                  completed_at = $8,
                  failure_code = $9
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND revision = $3
            RETURNING *`,
          [
            request.scope.tenantId,
            workflowRunId,
            raw.expectedRevision,
            raw.state,
            checkpointRevision,
            nextAgentRunId,
            at,
            completedAt,
            failureCode,
          ],
        );
        if (!result.rows[0]) throw conflict();
        await admit(client, request, "run.update");
        return workflowRun(result.rows[0]);
      });
    },
  });
}

import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  assertTaskAccess,
  assertTaskTransition,
  assertWorkflowRunAccess,
  assertWorkflowRunTransition,
  normalizeTask,
  normalizeTaskScope,
  normalizeWorkflowCheckpoint,
  normalizeWorkflowRun,
  normalizeWorkflowRunScope,
  type Task,
  type TaskRepository,
  type TaskScope,
  type TaskState,
  type WorkflowCheckpoint,
  type WorkflowRun,
  type WorkflowRunRepository,
  type WorkflowRunScope,
  type WorkflowRunState,
} from "@masanawa/workflows";
import {
  assertCurrentAuthority,
  canonicalJson,
  createAuthorityContext,
  type AuthorityContext,
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
  revision: string;
  checkpoint_revision: string;
  pending_approval_ids: WorkflowRun["pendingApprovalIds"];
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  failure_code: string | null;
}

interface CheckpointRow {
  workflow_run_id: WorkflowCheckpoint["workflowRunId"];
  checkpoint_revision: string;
  graph_signature: string;
  committed_state: WorkflowCheckpoint["committedState"];
  executor_state: WorkflowCheckpoint["executorState"];
  edge_state: WorkflowCheckpoint["edgeState"];
  pending_approval_ids: WorkflowCheckpoint["pendingApprovalIds"];
  created_at: Date;
}

function captureAuthority(raw: AuthorityContext): AuthorityContext {
  return Object.freeze({
    ...createAuthorityContext({
      ...raw,
      issuedAt: toInstant(raw.issuedAt),
      ...(raw.expiresAt ? { expiresAt: toInstant(raw.expiresAt) } : {}),
    }),
    authorityContextId: parseCanonicalId(
      "authority-context",
      raw.authorityContextId,
    ),
    principal: Object.freeze({ ...raw.principal }),
  });
}

async function clock(client: PoolClient): Promise<Instant> {
  const result = await client.query<{ at: Date }>(
    "SELECT clock_timestamp() AS at",
  );
  return toInstant(result.rows[0]!.at);
}

function taskFromRow(row: TaskRow): Task {
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
    revision: Number(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    completedAt:
      row.completed_at === null ? null : toInstant(row.completed_at),
    failureCode: row.failure_code,
  });
}

function runFromRow(row: WorkflowRunRow): WorkflowRun {
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
    revision: Number(row.revision),
    checkpointRevision: Number(row.checkpoint_revision),
    pendingApprovalIds: row.pending_approval_ids,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    completedAt:
      row.completed_at === null ? null : toInstant(row.completed_at),
    failureCode: row.failure_code,
  });
}

function checkpointFromRow(row: CheckpointRow): WorkflowCheckpoint {
  return normalizeWorkflowCheckpoint({
    schemaVersion: 1,
    workflowRunId: row.workflow_run_id,
    checkpointRevision: Number(row.checkpoint_revision),
    graphSignature: row.graph_signature,
    committedState: row.committed_state,
    executorState: row.executor_state,
    edgeState: row.edge_state,
    pendingApprovalIds: row.pending_approval_ids,
    createdAt: toInstant(row.created_at),
  });
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function missing(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "not-found",
    message,
    retryable: false,
  });
}

async function currentAuthority(
  client: PoolClient,
  authority: AuthorityContext,
): Promise<Instant> {
  const at = await clock(client);
  await assertCurrentAuthority(
    authority,
    createPostgresCurrentAuthoritySource(client),
    at,
  );
  return at;
}

function sameTask(left: Task, right: Task): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function sameRun(left: WorkflowRun, right: WorkflowRun): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function sameCheckpoint(
  left: WorkflowCheckpoint,
  right: WorkflowCheckpoint,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

async function loadTask(
  client: PoolClient,
  scope: TaskScope,
  taskId: Task["taskId"],
  write: boolean,
): Promise<Task> {
  const result = await client.query<TaskRow>(
    `SELECT *
       FROM workflows.tasks
      WHERE tenant_id = $1
        AND task_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [
      scope.tenantId,
      taskId,
      scope.userId,
      scope.characterId,
      scope.relationshipId,
    ],
  );
  if (!result.rows[0]) {
    throw missing(
      "workflows.task_not_found",
      "Task was not found in the authorized relationship",
    );
  }
  return taskFromRow(result.rows[0]);
}

async function loadRun(
  client: PoolClient,
  scope: WorkflowRunScope,
  workflowRunId: WorkflowRun["workflowRunId"],
  write: boolean,
): Promise<WorkflowRun> {
  const result = await client.query<WorkflowRunRow>(
    `SELECT *
       FROM workflows.workflow_runs
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [
      scope.tenantId,
      workflowRunId,
      scope.userId,
      scope.characterId,
      scope.relationshipId,
    ],
  );
  if (!result.rows[0]) {
    throw missing(
      "workflows.run_not_found",
      "WorkflowRun was not found in the authorized relationship",
    );
  }
  return runFromRow(result.rows[0]);
}

function assertListAuthority(
  authority: AuthorityContext,
  scope: TaskScope | WorkflowRunScope,
  capability: "workflows.task.read" | "workflows.run.read",
  at: Instant,
): void {
  const valid =
    authority.tenantId === scope.tenantId &&
    authority.capabilities.includes(capability) &&
    authority.resourceScope.relationshipIds?.includes(scope.relationshipId) ===
      true &&
    (authority.principal.kind === "user"
      ? authority.principal.userId === scope.userId
      : authority.capabilities.includes(
          capability === "workflows.task.read"
            ? "workflows.task.manage-other"
            : "workflows.run.manage-other",
        )) &&
    authority.issuedAt <= at &&
    (!authority.expiresAt || authority.expiresAt > at);

  if (!valid) {
    throw new PlatformError({
      code: "workflows.list_access_denied",
      category: "authorization",
      message: "Current authority does not allow listing Work",
      retryable: false,
    });
  }
}

function taskTerminal(state: TaskState): boolean {
  return state === "completed" || state === "failed" || state === "cancelled";
}

function runTerminal(state: WorkflowRunState): boolean {
  return state === "completed" || state === "failed" || state === "cancelled";
}

export function createPostgresTaskRepository(pool: Pool): TaskRepository {
  return Object.freeze({
    async create(raw) {
      const authority = captureAuthority(raw.authority);
      const task = normalizeTask(raw.task);
      return withTransaction(pool, async (client) => {
        const at = await currentAuthority(client, authority);
        assertTaskAccess(authority, task, "create", at);

        const inserted = await client.query<TaskRow>(
          `INSERT INTO workflows.tasks(
             tenant_id, task_id, user_id, character_id, relationship_id,
             title, state, workflow_run_id, revision,
             created_at, updated_at, completed_at, failure_code
           )
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (tenant_id, task_id) DO NOTHING
           RETURNING *`,
          [
            task.tenantId,
            task.taskId,
            task.userId,
            task.characterId,
            task.relationshipId,
            task.title,
            task.state,
            task.workflowRunId,
            task.revision,
            task.createdAt,
            task.updatedAt,
            task.completedAt,
            task.failureCode,
          ],
        );
        if (inserted.rows[0]) {
          await currentAuthority(client, authority);
          return taskFromRow(inserted.rows[0]);
        }

        const existing = await loadTask(
          client,
          task,
          task.taskId,
          false,
        );
        if (!sameTask(existing, task)) {
          throw conflict(
            "workflows.task_conflict",
            "Task identity is already bound to different work",
          );
        }
        assertTaskAccess(
          authority,
          existing,
          "create",
          await currentAuthority(client, authority),
        );
        return existing;
      });
    },

    async read(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeTaskScope(raw.scope);
      const taskId = parseCanonicalId("task", raw.taskId);
      return withTransaction(
        pool,
        async (client) => {
          await currentAuthority(client, authority);
          const task = await loadTask(client, scope, taskId, false);
          assertTaskAccess(
            authority,
            task,
            "read",
            await currentAuthority(client, authority),
          );
          return task;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listForRelationship(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeTaskScope(raw.scope);
      if (!Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 200) {
        throw new RangeError("Task list limit is invalid");
      }
      const states =
        raw.states === undefined
          ? null
          : Object.freeze([...new Set(raw.states)]);
      if (
        states !== null &&
        states.some(
          (state) =>
            ![
              "queued",
              "running",
              "waiting_approval",
              "waiting_external",
              "completed",
              "failed",
              "cancelled",
            ].includes(state),
        )
      ) {
        throw new TypeError("Task list state is invalid");
      }

      return withTransaction(
        pool,
        async (client) => {
          const at = await currentAuthority(client, authority);
          assertListAuthority(authority, scope, "workflows.task.read", at);
          const result = await client.query<TaskRow>(
            `SELECT *
               FROM workflows.tasks
              WHERE tenant_id = $1
                AND user_id = $2
                AND character_id = $3
                AND relationship_id = $4
                AND ($5::text[] IS NULL OR state = ANY($5::text[]))
              ORDER BY updated_at DESC, task_id DESC
              LIMIT $6`,
            [
              scope.tenantId,
              scope.userId,
              scope.characterId,
              scope.relationshipId,
              states,
              raw.limit,
            ],
          );
          const tasks = result.rows.map(taskFromRow);
          for (const task of tasks) {
            assertTaskAccess(authority, task, "read", at);
          }
          return Object.freeze(tasks);
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async transition(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeTaskScope(raw.scope);
      const taskId = parseCanonicalId("task", raw.taskId);
      if (
        !Number.isSafeInteger(raw.expectedRevision) ||
        raw.expectedRevision < 1
      ) {
        throw new RangeError("Task expectedRevision is invalid");
      }

      return withTransaction(pool, async (client) => {
        await currentAuthority(client, authority);
        const current = await loadTask(client, scope, taskId, true);
        const at = await currentAuthority(client, authority);
        assertTaskAccess(
          authority,
          current,
          raw.to === "cancelled" ? "cancel" : "update",
          at,
        );
        if (current.revision !== raw.expectedRevision) {
          throw conflict(
            "workflows.task_conflict",
            "Task revision changed before transition",
          );
        }
        assertTaskTransition(current.state, raw.to);

        const failureCode =
          raw.to === "failed"
            ? raw.failureCode?.trim().toLowerCase()
            : null;
        if (raw.to === "failed" && !failureCode) {
          throw new TypeError("Failed Task requires failureCode");
        }
        if (raw.to !== "failed" && raw.failureCode !== undefined) {
          throw new TypeError("failureCode is only valid for failed Task");
        }
        const workflowRunId =
          raw.workflowRunId === undefined
            ? current.workflowRunId
            : raw.workflowRunId === null
              ? null
              : parseCanonicalId("workflow-run", raw.workflowRunId);
        const completedAt = taskTerminal(raw.to) ? at : null;

        const result = await client.query<TaskRow>(
          `UPDATE workflows.tasks
              SET state = $4,
                  workflow_run_id = $5,
                  revision = revision + 1,
                  updated_at = $6,
                  completed_at = $7,
                  failure_code = $8
            WHERE tenant_id = $1
              AND task_id = $2
              AND revision = $3
            RETURNING *`,
          [
            scope.tenantId,
            taskId,
            raw.expectedRevision,
            raw.to,
            workflowRunId,
            at,
            completedAt,
            failureCode,
          ],
        );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.task_conflict",
            "Task changed before transition",
          );
        }
        const updated = taskFromRow(result.rows[0]);
        assertTaskAccess(
          authority,
          updated,
          raw.to === "cancelled" ? "cancel" : "update",
          await currentAuthority(client, authority),
        );
        return updated;
      });
    },
  });
}

export function createPostgresWorkflowRunRepository(
  pool: Pool,
): WorkflowRunRepository {
  return Object.freeze({
    async create(raw) {
      const authority = captureAuthority(raw.authority);
      const run = normalizeWorkflowRun(raw.run);
      return withTransaction(pool, async (client) => {
        const at = await currentAuthority(client, authority);
        assertWorkflowRunAccess(authority, run, "create", at);

        const inserted = await client.query<WorkflowRunRow>(
          `INSERT INTO workflows.workflow_runs(
             tenant_id, workflow_run_id, workflow_version_id, task_id,
             user_id, character_id, relationship_id, state,
             revision, checkpoint_revision, pending_approval_ids,
             created_at, updated_at, completed_at, failure_code
           )
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
           ON CONFLICT (tenant_id, workflow_run_id) DO NOTHING
           RETURNING *`,
          [
            run.tenantId,
            run.workflowRunId,
            run.workflowVersionId,
            run.taskId,
            run.userId,
            run.characterId,
            run.relationshipId,
            run.state,
            run.revision,
            run.checkpointRevision,
            canonicalJson(run.pendingApprovalIds),
            run.createdAt,
            run.updatedAt,
            run.completedAt,
            run.failureCode,
          ],
        );
        if (inserted.rows[0]) {
          await currentAuthority(client, authority);
          return runFromRow(inserted.rows[0]);
        }

        const existing = await loadRun(
          client,
          run,
          run.workflowRunId,
          false,
        );
        if (!sameRun(existing, run)) {
          throw conflict(
            "workflows.run_conflict",
            "WorkflowRun identity is already bound to different work",
          );
        }
        assertWorkflowRunAccess(
          authority,
          existing,
          "create",
          await currentAuthority(client, authority),
        );
        return existing;
      });
    },

    async read(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      const workflowRunId = parseCanonicalId(
        "workflow-run",
        raw.workflowRunId,
      );
      return withTransaction(
        pool,
        async (client) => {
          await currentAuthority(client, authority);
          const run = await loadRun(client, scope, workflowRunId, false);
          assertWorkflowRunAccess(
            authority,
            run,
            "read",
            await currentAuthority(client, authority),
          );
          return run;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listForRelationship(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      if (!Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 200) {
        throw new RangeError("WorkflowRun list limit is invalid");
      }
      const states =
        raw.states === undefined
          ? null
          : Object.freeze([...new Set(raw.states)]);
      if (
        states !== null &&
        states.some(
          (state) =>
            ![
              "queued",
              "running",
              "waiting_approval",
              "waiting_external",
              "completed",
              "failed",
              "cancelled",
            ].includes(state),
        )
      ) {
        throw new TypeError("WorkflowRun list state is invalid");
      }

      return withTransaction(
        pool,
        async (client) => {
          const at = await currentAuthority(client, authority);
          assertListAuthority(authority, scope, "workflows.run.read", at);
          const result = await client.query<WorkflowRunRow>(
            `SELECT *
               FROM workflows.workflow_runs
              WHERE tenant_id = $1
                AND user_id = $2
                AND character_id = $3
                AND relationship_id = $4
                AND ($5::text[] IS NULL OR state = ANY($5::text[]))
              ORDER BY updated_at DESC, workflow_run_id DESC
              LIMIT $6`,
            [
              scope.tenantId,
              scope.userId,
              scope.characterId,
              scope.relationshipId,
              states,
              raw.limit,
            ],
          );
          const runs = result.rows.map(runFromRow);
          for (const run of runs) {
            assertWorkflowRunAccess(authority, run, "read", at);
          }
          return Object.freeze(runs);
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async transition(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      const workflowRunId = parseCanonicalId(
        "workflow-run",
        raw.workflowRunId,
      );
      if (
        !Number.isSafeInteger(raw.expectedRevision) ||
        raw.expectedRevision < 1
      ) {
        throw new RangeError("WorkflowRun expectedRevision is invalid");
      }

      return withTransaction(pool, async (client) => {
        await currentAuthority(client, authority);
        const current = await loadRun(
          client,
          scope,
          workflowRunId,
          true,
        );
        const at = await currentAuthority(client, authority);
        assertWorkflowRunAccess(
          authority,
          current,
          raw.to === "cancelled" ? "cancel" : "update",
          at,
        );
        if (current.revision !== raw.expectedRevision) {
          throw conflict(
            "workflows.run_conflict",
            "WorkflowRun revision changed before transition",
          );
        }
        assertWorkflowRunTransition(current.state, raw.to);

        const failureCode =
          raw.to === "failed"
            ? raw.failureCode?.trim().toLowerCase()
            : null;
        if (raw.to === "failed" && !failureCode) {
          throw new TypeError("Failed WorkflowRun requires failureCode");
        }
        if (raw.to !== "failed" && raw.failureCode !== undefined) {
          throw new TypeError(
            "failureCode is only valid for failed WorkflowRun",
          );
        }
        const pendingApprovalIds =
          raw.to === "waiting_approval"
            ? Object.freeze([...(raw.pendingApprovalIds ?? [])])
            : Object.freeze([]);
        if (
          raw.to === "waiting_approval" &&
          pendingApprovalIds.length === 0
        ) {
          throw new TypeError(
            "waiting_approval requires pendingApprovalIds",
          );
        }
        const completedAt = runTerminal(raw.to) ? at : null;

        const result = await client.query<WorkflowRunRow>(
          `UPDATE workflows.workflow_runs
              SET state = $4,
                  revision = revision + 1,
                  pending_approval_ids = $5::jsonb,
                  updated_at = $6,
                  completed_at = $7,
                  failure_code = $8
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND revision = $3
            RETURNING *`,
          [
            scope.tenantId,
            workflowRunId,
            raw.expectedRevision,
            raw.to,
            canonicalJson(pendingApprovalIds),
            at,
            completedAt,
            failureCode,
          ],
        );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.run_conflict",
            "WorkflowRun changed before transition",
          );
        }
        const updated = runFromRow(result.rows[0]);
        assertWorkflowRunAccess(
          authority,
          updated,
          raw.to === "cancelled" ? "cancel" : "update",
          await currentAuthority(client, authority),
        );
        return updated;
      });
    },

    async appendCheckpoint(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      const checkpoint = normalizeWorkflowCheckpoint(raw.checkpoint);
      if (
        !Number.isSafeInteger(raw.expectedRunRevision) ||
        raw.expectedRunRevision < 1
      ) {
        throw new RangeError("WorkflowRun expectedRunRevision is invalid");
      }

      return withTransaction(pool, async (client) => {
        await currentAuthority(client, authority);
        const current = await loadRun(
          client,
          scope,
          checkpoint.workflowRunId,
          true,
        );
        const at = await currentAuthority(client, authority);
        assertWorkflowRunAccess(
          authority,
          current,
          "checkpoint",
          at,
        );

        const prior = await client.query<CheckpointRow>(
          `SELECT workflow_run_id, checkpoint_revision, graph_signature,
                  committed_state, executor_state, edge_state,
                  pending_approval_ids, created_at
             FROM workflows.workflow_checkpoints
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND checkpoint_revision = $3
            FOR SHARE`,
          [
            scope.tenantId,
            checkpoint.workflowRunId,
            checkpoint.checkpointRevision,
          ],
        );
        if (prior.rows[0]) {
          const existing = checkpointFromRow(prior.rows[0]);
          if (!sameCheckpoint(existing, checkpoint)) {
            throw conflict(
              "workflows.checkpoint_conflict",
              "Checkpoint revision is already bound to different state",
            );
          }
          return current;
        }

        if (
          current.revision !== raw.expectedRunRevision ||
          checkpoint.checkpointRevision !== current.checkpointRevision + 1 ||
          runTerminal(current.state)
        ) {
          throw conflict(
            "workflows.checkpoint_conflict",
            "WorkflowRun cannot accept this checkpoint",
          );
        }
        if (
          canonicalJson(checkpoint.pendingApprovalIds) !==
          canonicalJson(current.pendingApprovalIds)
        ) {
          throw conflict(
            "workflows.checkpoint_approval_mismatch",
            "Checkpoint approvals do not match WorkflowRun state",
          );
        }

        await client.query(
          `INSERT INTO workflows.workflow_checkpoints(
             tenant_id, workflow_run_id, checkpoint_revision,
             graph_signature, committed_state, executor_state, edge_state,
             pending_approval_ids, created_at
           )
           VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
          [
            scope.tenantId,
            checkpoint.workflowRunId,
            checkpoint.checkpointRevision,
            checkpoint.graphSignature,
            canonicalJson(checkpoint.committedState),
            canonicalJson(checkpoint.executorState),
            canonicalJson(checkpoint.edgeState),
            canonicalJson(checkpoint.pendingApprovalIds),
            checkpoint.createdAt,
          ],
        );

        const result = await client.query<WorkflowRunRow>(
          `UPDATE workflows.workflow_runs
              SET checkpoint_revision = $4,
                  revision = revision + 1,
                  updated_at = $5
            WHERE tenant_id = $1
              AND workflow_run_id = $2
              AND revision = $3
            RETURNING *`,
          [
            scope.tenantId,
            checkpoint.workflowRunId,
            raw.expectedRunRevision,
            checkpoint.checkpointRevision,
            at,
          ],
        );
        if (!result.rows[0]) {
          throw conflict(
            "workflows.checkpoint_conflict",
            "WorkflowRun changed before checkpoint commit",
          );
        }
        const updated = runFromRow(result.rows[0]);
        assertWorkflowRunAccess(
          authority,
          updated,
          "checkpoint",
          await currentAuthority(client, authority),
        );
        return updated;
      });
    },

    async readLatestCheckpoint(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      const workflowRunId = parseCanonicalId(
        "workflow-run",
        raw.workflowRunId,
      );
      return withTransaction(
        pool,
        async (client) => {
          await currentAuthority(client, authority);
          const run = await loadRun(client, scope, workflowRunId, false);
          assertWorkflowRunAccess(
            authority,
            run,
            "read",
            await currentAuthority(client, authority),
          );
          const result = await client.query<CheckpointRow>(
            `SELECT workflow_run_id, checkpoint_revision, graph_signature,
                    committed_state, executor_state, edge_state,
                    pending_approval_ids, created_at
               FROM workflows.workflow_checkpoints
              WHERE tenant_id = $1 AND workflow_run_id = $2
              ORDER BY checkpoint_revision DESC
              LIMIT 1`,
            [scope.tenantId, workflowRunId],
          );
          return result.rows[0]
            ? checkpointFromRow(result.rows[0])
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}

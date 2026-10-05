import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  assertWorkflowExecutorLeaseHeld,
  assertWorkflowRunAccess,
  assertWorkflowRunTransition,
  normalizeWorkflowCheckpoint,
  normalizeWorkflowExecutorFence,
  normalizeWorkflowExecutorLease,
  normalizeWorkflowRun,
  normalizeWorkflowRunScope,
  type WorkflowCheckpoint,
  type WorkflowExecutorCommitRepository,
  type WorkflowRun,
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

interface RunRow {
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

interface LeaseRow {
  tenant_id: WorkflowRun["tenantId"];
  workflow_run_id: WorkflowRun["workflowRunId"];
  holder_id: string;
  fence: string;
  state: "held" | "released";
  acquired_at: Date;
  renewed_at: Date;
  expires_at: Date;
  released_at: Date | null;
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

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
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

function runFromRow(row: RunRow): WorkflowRun {
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
    completedAt: row.completed_at === null ? null : toInstant(row.completed_at),
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

async function loadRunForUpdate(
  client: PoolClient,
  scope: WorkflowRunScope,
  workflowRunId: WorkflowRun["workflowRunId"],
): Promise<WorkflowRun> {
  const result = await client.query<RunRow>(
    `SELECT *
       FROM workflows.workflow_runs
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND user_id = $3
        AND character_id = $4
        AND relationship_id = $5
      FOR UPDATE`,
    [
      scope.tenantId,
      workflowRunId,
      scope.userId,
      scope.characterId,
      scope.relationshipId,
    ],
  );
  if (!result.rows[0]) {
    throw conflict(
      "workflows.run_not_found",
      "WorkflowRun was not found in the authorized relationship",
    );
  }
  return runFromRow(result.rows[0]);
}

async function assertFence(
  client: PoolClient,
  run: WorkflowRun,
  executor: { readonly holderId: string; readonly fence: number },
  at: Instant,
): Promise<void> {
  const result = await client.query<LeaseRow>(
    `SELECT *
       FROM workflows.workflow_executor_leases
      WHERE tenant_id = $1
        AND workflow_run_id = $2
      FOR UPDATE`,
    [run.tenantId, run.workflowRunId],
  );
  if (!result.rows[0]) {
    throw conflict(
      "workflows.executor_lease_missing",
      "WorkflowRun has no executor lease",
    );
  }
  const row = result.rows[0];
  const lease = normalizeWorkflowExecutorLease({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    holderId: row.holder_id,
    fence: Number(row.fence),
    state: row.state,
    acquiredAt: toInstant(row.acquired_at),
    renewedAt: toInstant(row.renewed_at),
    expiresAt: toInstant(row.expires_at),
    releasedAt: row.released_at === null ? null : toInstant(row.released_at),
  });
  assertWorkflowExecutorLeaseHeld({
    lease,
    tenantId: run.tenantId,
    workflowRunId: run.workflowRunId,
    holderId: executor.holderId,
    fence: executor.fence,
    at,
  });
}

function runTerminal(state: WorkflowRunState): boolean {
  return state === "completed" || state === "failed" || state === "cancelled";
}

export function createPostgresWorkflowExecutorCommitRepository(
  pool: Pool,
): WorkflowExecutorCommitRepository {
  return Object.freeze({
    async transition(raw) {
      const authority = captureAuthority(raw.authority);
      const scope = normalizeWorkflowRunScope(raw.scope);
      const workflowRunId = parseCanonicalId(
        "workflow-run",
        raw.workflowRunId,
      );
      const executor = normalizeWorkflowExecutorFence(raw.executor);
      if (
        !Number.isSafeInteger(raw.expectedRevision) ||
        raw.expectedRevision < 1
      ) {
        throw new RangeError("WorkflowRun expectedRevision is invalid");
      }

      return withTransaction(pool, async (client) => {
        await currentAuthority(client, authority);
        const current = await loadRunForUpdate(client, scope, workflowRunId);
        const at = await currentAuthority(client, authority);
        assertWorkflowRunAccess(
          authority,
          current,
          raw.to === "cancelled" ? "cancel" : "update",
          at,
        );
        await assertFence(client, current, executor, at);

        if (current.revision !== raw.expectedRevision) {
          throw conflict(
            "workflows.run_conflict",
            "WorkflowRun revision changed before fenced transition",
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

        const result = await client.query<RunRow>(
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
            "WorkflowRun changed before fenced transition commit",
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
      const executor = normalizeWorkflowExecutorFence(raw.executor);
      if (
        !Number.isSafeInteger(raw.expectedRunRevision) ||
        raw.expectedRunRevision < 1
      ) {
        throw new RangeError("WorkflowRun expectedRunRevision is invalid");
      }

      return withTransaction(pool, async (client) => {
        await currentAuthority(client, authority);
        const current = await loadRunForUpdate(
          client,
          scope,
          checkpoint.workflowRunId,
        );
        const at = await currentAuthority(client, authority);
        assertWorkflowRunAccess(authority, current, "checkpoint", at);
        await assertFence(client, current, executor, at);

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
          if (canonicalJson(existing) !== canonicalJson(checkpoint)) {
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
            "WorkflowRun cannot accept this fenced checkpoint",
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

        const result = await client.query<RunRow>(
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
            "WorkflowRun changed before fenced checkpoint commit",
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
  });
}

import { fileURLToPath } from "node:url";
import {
  PlatformError,
  createCanonicalId,
  toInstant,
  type CorrelationId,
  type EventId,
  type Instant,
  type RequestId,
  type TaskId,
  type TenantId,
  type UserId,
  type WorkflowId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { enqueueOutbox } from "../events/outbox.js";
import type { MigrationRoot } from "../migrations.js";
import { withTransaction } from "../transaction.js";

export type PersistedWorkflowRunState =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type PersistedTaskState =
  | "pending"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowRunRecord {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly initiatedByUserId: UserId | null;
  readonly state: PersistedWorkflowRunState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly startedAt: Instant | null;
  readonly terminalAt: Instant | null;
  readonly waitReason: string | null;
  readonly failure: Readonly<{ code: string; message: string }> | null;
  readonly cancellationReason: string | null;
}

export interface TaskRecord {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly nodeKey: string;
  readonly lineage: Readonly<{
    parentTaskId: TaskId | null;
    rootTaskId: TaskId;
    depth: number;
  }>;
  readonly state: PersistedTaskState;
  readonly revision: number;
  readonly admissionRequestId: RequestId;
  readonly admissionFingerprint: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly startedAt: Instant | null;
  readonly terminalAt: Instant | null;
  readonly waitReason: string | null;
  readonly failure: Readonly<{ code: string; message: string }> | null;
  readonly cancellationReason: string | null;
}

export interface AdmitWorkflowTaskInput {
  readonly task: Omit<TaskRecord, "admissionFingerprint">;
  readonly correlationId: CorrelationId;
  readonly causationId: EventId | null;
  readonly destination: string;
  readonly availableAt: Instant;
}

interface WorkflowRunRow {
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  workflow_id: WorkflowId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  initiated_by_user_id: UserId | null;
  state: PersistedWorkflowRunState;
  revision: string;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  terminal_at: Date | null;
  wait_reason: string | null;
  failure_code: string | null;
  failure_message: string | null;
  cancellation_reason: string | null;
}

interface TaskRow {
  tenant_id: TenantId;
  task_id: TaskId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  node_key: string;
  parent_task_id: TaskId | null;
  root_task_id: TaskId;
  lineage_depth: number;
  state: PersistedTaskState;
  revision: string;
  admission_request_id: RequestId;
  admission_fingerprint: string;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  terminal_at: Date | null;
  wait_reason: string | null;
  failure_code: string | null;
  failure_message: string | null;
  cancellation_reason: string | null;
}

function runRecord(row: WorkflowRunRow): WorkflowRunRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowId: row.workflow_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    initiatedByUserId: row.initiated_by_user_id,
    state: row.state,
    revision: Number(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    startedAt: row.started_at ? toInstant(row.started_at) : null,
    terminalAt: row.terminal_at ? toInstant(row.terminal_at) : null,
    waitReason: row.wait_reason,
    failure:
      row.failure_code === null
        ? null
        : Object.freeze({
            code: row.failure_code,
            message: row.failure_message ?? "",
          }),
    cancellationReason: row.cancellation_reason,
  });
}

function taskRecord(row: TaskRow): TaskRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    nodeKey: row.node_key,
    lineage: Object.freeze({
      parentTaskId: row.parent_task_id,
      rootTaskId: row.root_task_id,
      depth: row.lineage_depth,
    }),
    state: row.state,
    revision: Number(row.revision),
    admissionRequestId: row.admission_request_id,
    admissionFingerprint: row.admission_fingerprint,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    startedAt: row.started_at ? toInstant(row.started_at) : null,
    terminalAt: row.terminal_at ? toInstant(row.terminal_at) : null,
    waitReason: row.wait_reason,
    failure:
      row.failure_code === null
        ? null
        : Object.freeze({
            code: row.failure_code,
            message: row.failure_message ?? "",
          }),
    cancellationReason: row.cancellation_reason,
  });
}

const runColumns = `
  tenant_id, workflow_run_id, workflow_id, workflow_version_id, graph_signature,
  initiated_by_user_id, state, revision, created_at, updated_at, started_at,
  terminal_at, wait_reason, failure_code, failure_message, cancellation_reason
`;

const taskColumns = `
  tenant_id, task_id, workflow_run_id, workflow_version_id, graph_signature,
  node_key, parent_task_id, root_task_id, lineage_depth, state, revision,
  admission_request_id, admission_fingerprint, created_at, updated_at, started_at,
  terminal_at, wait_reason, failure_code, failure_message, cancellation_reason
`;

export function workflowMigrationRoots(): readonly MigrationRoot[] {
  return Object.freeze([
    Object.freeze({
      owner: "workflows",
      directory: fileURLToPath(
        new URL("../../../../../packages/workflows/migrations/", import.meta.url),
      ),
    }),
  ]);
}

export async function createWorkflowRunRecord(
  client: PoolClient,
  input: WorkflowRunRecord,
): Promise<WorkflowRunRecord> {
  const inserted = await client.query<WorkflowRunRow>(
    `INSERT INTO workflows.workflow_runs (
       tenant_id, workflow_run_id, workflow_id, workflow_version_id,
       graph_signature, initiated_by_user_id, state, revision, created_at,
       updated_at, started_at, terminal_at, wait_reason, failure_code,
       failure_message, cancellation_reason
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )
     ON CONFLICT (tenant_id, workflow_run_id) DO NOTHING
     RETURNING ${runColumns}`,
    [
      input.tenantId,
      input.workflowRunId,
      input.workflowId,
      input.workflowVersionId,
      input.graphSignature,
      input.initiatedByUserId,
      input.state,
      input.revision,
      input.createdAt,
      input.updatedAt,
      input.startedAt,
      input.terminalAt,
      input.waitReason,
      input.failure?.code ?? null,
      input.failure?.message ?? null,
      input.cancellationReason,
    ],
  );
  if (inserted.rowCount === 1) {
    return runRecord(inserted.rows[0]!);
  }

  const existing = await client.query<WorkflowRunRow>(
    `SELECT ${runColumns}
       FROM workflows.workflow_runs
      WHERE tenant_id = $1 AND workflow_run_id = $2`,
    [input.tenantId, input.workflowRunId],
  );
  const row = existing.rows[0];
  if (!row) {
    throw new Error("WorkflowRun insert conflict could not be reconciled");
  }
  const current = runRecord(row);
  const fingerprint = (value: WorkflowRunRecord) =>
    fingerprintCanonicalJson({
      ...value,
      failure: value.failure,
    });
  if (fingerprint(current) !== fingerprint(input)) {
    throw new PlatformError({
      code: "workflows.run_conflict",
      category: "conflict",
      message: "WorkflowRun identity is already bound to different durable state",
      retryable: false,
    });
  }
  return current;
}

function taskAdmissionFingerprint(input: AdmitWorkflowTaskInput): string {
  return fingerprintCanonicalJson({
    task: {
      ...input.task,
      failure: input.task.failure,
    },
    correlationId: input.correlationId,
    causationId: input.causationId,
    destination: input.destination,
    availableAt: input.availableAt,
  });
}

async function loadTaskByRequest(
  client: PoolClient,
  tenantId: TenantId,
  requestId: RequestId,
): Promise<TaskRecord | null> {
  const result = await client.query<TaskRow>(
    `SELECT ${taskColumns}
       FROM workflows.tasks
      WHERE tenant_id = $1 AND admission_request_id = $2`,
    [tenantId, requestId],
  );
  return result.rows[0] ? taskRecord(result.rows[0]) : null;
}

export async function admitWorkflowTask(
  pool: Pool,
  input: AdmitWorkflowTaskInput,
): Promise<Readonly<{ task: TaskRecord; outboxEventId: string }>> {
  if (!input.destination.trim()) {
    throw new TypeError("workflow task destination is required");
  }
  const admissionFingerprint = taskAdmissionFingerprint(input);

  return withTransaction(pool, async (client) => {
    const inserted = await client.query<TaskRow>(
      `INSERT INTO workflows.tasks (
         tenant_id, task_id, workflow_run_id, workflow_version_id,
         graph_signature, node_key, parent_task_id, root_task_id,
         lineage_depth, state, revision, admission_request_id,
         admission_fingerprint, created_at, updated_at, started_at,
         terminal_at, wait_reason, failure_code, failure_message,
         cancellation_reason
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
       )
       ON CONFLICT DO NOTHING
       RETURNING ${taskColumns}`,
      [
        input.task.tenantId,
        input.task.taskId,
        input.task.workflowRunId,
        input.task.workflowVersionId,
        input.task.graphSignature,
        input.task.nodeKey,
        input.task.lineage.parentTaskId,
        input.task.lineage.rootTaskId,
        input.task.lineage.depth,
        input.task.state,
        input.task.revision,
        input.task.admissionRequestId,
        admissionFingerprint,
        input.task.createdAt,
        input.task.updatedAt,
        input.task.startedAt,
        input.task.terminalAt,
        input.task.waitReason,
        input.task.failure?.code ?? null,
        input.task.failure?.message ?? null,
        input.task.cancellationReason,
      ],
    );

    if (inserted.rowCount !== 1) {
      const existing = await loadTaskByRequest(
        client,
        input.task.tenantId,
        input.task.admissionRequestId,
      );
      if (
        !existing ||
        existing.taskId !== input.task.taskId ||
        existing.admissionFingerprint !== admissionFingerprint
      ) {
        throw new PlatformError({
          code: "workflows.task_admission_conflict",
          category: "conflict",
          message: "Task admission request is already bound to different durable work",
          retryable: false,
        });
      }

      const outbox = await client.query<{ outbox_event_id: string }>(
        `SELECT outbox_event_id
           FROM events.outbox
          WHERE tenant_id = $1
            AND aggregate_type = 'workflow-task'
            AND aggregate_id = $2
            AND event_type = 'workflow.task.ready.v1'
          ORDER BY created_at
          LIMIT 1`,
        [existing.tenantId, existing.taskId],
      );
      const outboxEventId = outbox.rows[0]?.outbox_event_id;
      if (!outboxEventId) {
        throw new PlatformError({
          code: "workflows.task_outbox_missing",
          category: "conflict",
          message: "Durable Task admission exists without its outbox record",
          retryable: false,
        });
      }
      return Object.freeze({ task: existing, outboxEventId });
    }

    const task = taskRecord(inserted.rows[0]!);
    const eventId = createCanonicalId("event");
    const outboxEventId = await enqueueOutbox(client, {
      tenantId: task.tenantId,
      eventId,
      eventType: "workflow.task.ready.v1",
      schemaVersion: 1,
      aggregateType: "workflow-task",
      aggregateId: task.taskId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      destination: input.destination,
      availableAt: input.availableAt,
      payload: {
        taskId: task.taskId,
        workflowRunId: task.workflowRunId,
        workflowVersionId: task.workflowVersionId,
        graphSignature: task.graphSignature,
        nodeKey: task.nodeKey,
        admissionRequestId: task.admissionRequestId,
      },
    });

    return Object.freeze({ task, outboxEventId });
  });
}

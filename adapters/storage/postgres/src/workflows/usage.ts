import { createHash } from "node:crypto";
import {
  PlatformError,
  toInstant,
  type EventId,
  type Instant,
  type OperationId,
  type ProviderId,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";

export type WorkflowUsageCategory =
  | "inference"
  | "tool"
  | "provider"
  | "workflow";

export interface WorkflowUsageEvidenceRecord {
  readonly usageEventId: EventId;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly taskId: TaskId | null;
  readonly operationId: OperationId | null;
  readonly providerId: ProviderId | null;
  readonly category: WorkflowUsageCategory;
  readonly providerKey: string | null;
  readonly modelKey: string | null;
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly costMicros: number;
  readonly latencyMs: number;
  readonly evidenceKey: string;
  readonly occurredAt: Instant;
  readonly evidenceFingerprint: string;
}

export interface WorkflowOperatorSummaryRecord {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly runState: string;
  readonly runRevision: number;
  readonly taskStates: Readonly<{
    pending: number;
    ready: number;
    running: number;
    waiting: number;
    completed: number;
    failed: number;
    cancelled: number;
  }>;
  readonly retryDispositions: Readonly<{
    retryScheduled: number;
    retryReady: number;
    deadLetter: number;
    needsAttention: number;
  }>;
  readonly pendingHumanRequests: number;
  readonly operationStates: Readonly<Record<string, number>>;
  readonly usage: Readonly<{
    recordCount: number;
    inputUnits: number;
    outputUnits: number;
    costMicros: number;
    latencyMs: number;
  }>;
}

interface UsageRow {
  usage_event_id: EventId;
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  task_id: TaskId | null;
  operation_id: OperationId | null;
  provider_id: ProviderId | null;
  category: WorkflowUsageCategory;
  provider_key: string | null;
  model_key: string | null;
  input_units: string;
  output_units: string;
  cost_micros: string;
  latency_ms: string;
  evidence_key: string;
  evidence_fingerprint: string;
  occurred_at: Date;
}

const stableKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function boundedOptionalKey(
  value: string | null,
  name: string,
  max: number,
): string | null {
  if (value === null) return null;
  if (!value || value.length > max || !stableKeyPattern.test(value)) {
    fail(`${name} must use a stable bounded key format`);
  }
  return value;
}

function nonNegativeSafeInteger(
  value: number,
  name: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    fail(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function structuralFingerprint(
  input: Omit<WorkflowUsageEvidenceRecord, "evidenceFingerprint">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        usageEventId: input.usageEventId,
        tenantId: input.tenantId,
        workflowRunId: input.workflowRunId,
        taskId: input.taskId,
        operationId: input.operationId,
        providerId: input.providerId,
        category: input.category,
        providerKey: input.providerKey,
        modelKey: input.modelKey,
        inputUnits: input.inputUnits,
        outputUnits: input.outputUnits,
        costMicros: input.costMicros,
        latencyMs: input.latencyMs,
        evidenceKey: input.evidenceKey,
        occurredAt: input.occurredAt,
      }),
      "utf8",
    )
    .digest("hex");
}

function normalizeInput(
  input: WorkflowUsageEvidenceRecord,
): WorkflowUsageEvidenceRecord {
  if (!["inference", "tool", "provider", "workflow"].includes(input.category)) {
    fail("usage category is not supported");
  }
  const evidenceKey = boundedOptionalKey(input.evidenceKey, "evidenceKey", 200);
  if (evidenceKey === null) fail("evidenceKey is required");

  const normalized = Object.freeze({
    ...input,
    providerKey: boundedOptionalKey(input.providerKey, "providerKey", 160),
    modelKey: boundedOptionalKey(input.modelKey, "modelKey", 160),
    inputUnits: nonNegativeSafeInteger(input.inputUnits, "inputUnits"),
    outputUnits: nonNegativeSafeInteger(input.outputUnits, "outputUnits"),
    costMicros: nonNegativeSafeInteger(input.costMicros, "costMicros"),
    latencyMs: nonNegativeSafeInteger(input.latencyMs, "latencyMs", 86_400_000),
    evidenceKey,
  });

  if (
    structuralFingerprint({
      usageEventId: normalized.usageEventId,
      tenantId: normalized.tenantId,
      workflowRunId: normalized.workflowRunId,
      taskId: normalized.taskId,
      operationId: normalized.operationId,
      providerId: normalized.providerId,
      category: normalized.category,
      providerKey: normalized.providerKey,
      modelKey: normalized.modelKey,
      inputUnits: normalized.inputUnits,
      outputUnits: normalized.outputUnits,
      costMicros: normalized.costMicros,
      latencyMs: normalized.latencyMs,
      evidenceKey: normalized.evidenceKey,
      occurredAt: normalized.occurredAt,
    }) !== normalized.evidenceFingerprint
  ) {
    fail("workflow usage evidence fingerprint does not match measured values");
  }
  return normalized;
}

function usageRecord(row: UsageRow): WorkflowUsageEvidenceRecord {
  return Object.freeze({
    usageEventId: row.usage_event_id,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    taskId: row.task_id,
    operationId: row.operation_id,
    providerId: row.provider_id,
    category: row.category,
    providerKey: row.provider_key,
    modelKey: row.model_key,
    inputUnits: Number(row.input_units),
    outputUnits: Number(row.output_units),
    costMicros: Number(row.cost_micros),
    latencyMs: Number(row.latency_ms),
    evidenceKey: row.evidence_key,
    occurredAt: toInstant(row.occurred_at),
    evidenceFingerprint: row.evidence_fingerprint,
  });
}

const usageColumns = `
  usage_event_id, tenant_id, workflow_run_id, task_id, operation_id,
  provider_id, category, provider_key, model_key, input_units::text,
  output_units::text, cost_micros::text, latency_ms::text, evidence_key,
  evidence_fingerprint, occurred_at
`;

export async function appendWorkflowUsageEvidence(
  client: PoolClient,
  raw: WorkflowUsageEvidenceRecord,
): Promise<WorkflowUsageEvidenceRecord> {
  const input = normalizeInput(raw);

  const inserted = await client.query<UsageRow>(
    `INSERT INTO workflows.usage_evidence (
       tenant_id, usage_event_id, workflow_run_id, task_id, operation_id,
       provider_id, category, provider_key, model_key, input_units,
       output_units, cost_micros, latency_ms, evidence_key,
       evidence_fingerprint, occurred_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT DO NOTHING
     RETURNING ${usageColumns}`,
    [
      input.tenantId,
      input.usageEventId,
      input.workflowRunId,
      input.taskId,
      input.operationId,
      input.providerId,
      input.category,
      input.providerKey,
      input.modelKey,
      input.inputUnits,
      input.outputUnits,
      input.costMicros,
      input.latencyMs,
      input.evidenceKey,
      input.evidenceFingerprint,
      input.occurredAt,
    ],
  );
  if (inserted.rowCount === 1) {
    return usageRecord(inserted.rows[0]!);
  }

  const existing = await client.query<UsageRow>(
    `SELECT ${usageColumns}
       FROM workflows.usage_evidence
      WHERE tenant_id = $1
        AND (usage_event_id = $2 OR evidence_key = $3)
      ORDER BY usage_event_id`,
    [input.tenantId, input.usageEventId, input.evidenceKey],
  );
  if (
    existing.rowCount !== 1 ||
    existing.rows[0]!.evidence_fingerprint !== input.evidenceFingerprint ||
    existing.rows[0]!.usage_event_id !== input.usageEventId ||
    existing.rows[0]!.evidence_key !== input.evidenceKey
  ) {
    throw new PlatformError({
      code: "workflows.usage_conflict",
      category: "conflict",
      message: "Workflow usage evidence identity is already bound to different measurements",
      retryable: false,
    });
  }
  return usageRecord(existing.rows[0]!);
}

function emptyTaskStates() {
  return {
    pending: 0,
    ready: 0,
    running: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
}

export async function readWorkflowOperatorSummary(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
  },
): Promise<WorkflowOperatorSummaryRecord> {
  const run = await pool.query<{
    workflow_version_id: WorkflowVersionId;
    graph_signature: string;
    state: string;
    revision: string;
  }>(
    `SELECT workflow_version_id, graph_signature, state, revision::text
       FROM workflows.workflow_runs
      WHERE tenant_id = $1 AND workflow_run_id = $2`,
    [input.tenantId, input.workflowRunId],
  );
  const runRow = run.rows[0];
  if (!runRow) {
    throw new PlatformError({
      code: "workflows.run_not_found",
      category: "not-found",
      message: "WorkflowRun does not exist in the requested tenant",
      retryable: false,
    });
  }

  const taskRows = await pool.query<{ state: string; count: string }>(
    `SELECT state, count(*)::text AS count
       FROM workflows.tasks
      WHERE tenant_id = $1 AND workflow_run_id = $2
      GROUP BY state
      ORDER BY state`,
    [input.tenantId, input.workflowRunId],
  );
  const taskStates = emptyTaskStates();
  for (const row of taskRows.rows) {
    if (row.state in taskStates) {
      taskStates[row.state as keyof typeof taskStates] = Number(row.count);
    }
  }

  const retryRows = await pool.query<{ disposition: string; count: string }>(
    `SELECT r.disposition, count(*)::text AS count
       FROM workflows.task_retry_state AS r
       JOIN workflows.tasks AS t
         ON t.tenant_id = r.tenant_id
        AND t.task_id = r.task_id
      WHERE t.tenant_id = $1 AND t.workflow_run_id = $2
      GROUP BY r.disposition
      ORDER BY r.disposition`,
    [input.tenantId, input.workflowRunId],
  );
  const retryDispositions = {
    retryScheduled: 0,
    retryReady: 0,
    deadLetter: 0,
    needsAttention: 0,
  };
  for (const row of retryRows.rows) {
    if (row.disposition === "retry-scheduled") {
      retryDispositions.retryScheduled = Number(row.count);
    } else if (row.disposition === "retry-ready") {
      retryDispositions.retryReady = Number(row.count);
    } else if (row.disposition === "dead-letter") {
      retryDispositions.deadLetter = Number(row.count);
    } else if (row.disposition === "needs-attention") {
      retryDispositions.needsAttention = Number(row.count);
    }
  }

  const human = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM workflows.human_requests
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND state = 'pending'`,
    [input.tenantId, input.workflowRunId],
  );

  const operations = await pool.query<{ state: string; count: string }>(
    `SELECT o.state, count(*)::text AS count
       FROM workflows.task_operation_bindings AS b
       JOIN events.operations AS o
         ON o.operation_id = b.operation_id
        AND o.tenant_id = b.tenant_id
      WHERE b.tenant_id = $1
        AND b.workflow_run_id = $2
      GROUP BY o.state
      ORDER BY o.state`,
    [input.tenantId, input.workflowRunId],
  );
  const operationStates: Record<string, number> = {};
  for (const row of operations.rows) {
    operationStates[row.state] = Number(row.count);
  }

  const usage = await pool.query<{
    record_count: string;
    input_units: string;
    output_units: string;
    cost_micros: string;
    latency_ms: string;
  }>(
    `SELECT
       count(*)::text AS record_count,
       COALESCE(sum(input_units), 0)::text AS input_units,
       COALESCE(sum(output_units), 0)::text AS output_units,
       COALESCE(sum(cost_micros), 0)::text AS cost_micros,
       COALESCE(sum(latency_ms), 0)::text AS latency_ms
       FROM workflows.usage_evidence
      WHERE tenant_id = $1 AND workflow_run_id = $2`,
    [input.tenantId, input.workflowRunId],
  );
  const usageRow = usage.rows[0]!;

  return Object.freeze({
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    workflowVersionId: runRow.workflow_version_id,
    graphSignature: runRow.graph_signature,
    runState: runRow.state,
    runRevision: Number(runRow.revision),
    taskStates: Object.freeze(taskStates),
    retryDispositions: Object.freeze(retryDispositions),
    pendingHumanRequests: Number(human.rows[0]!.count),
    operationStates: Object.freeze(operationStates),
    usage: Object.freeze({
      recordCount: Number(usageRow.record_count),
      inputUnits: Number(usageRow.input_units),
      outputUnits: Number(usageRow.output_units),
      costMicros: Number(usageRow.cost_micros),
      latencyMs: Number(usageRow.latency_ms),
    }),
  });
}

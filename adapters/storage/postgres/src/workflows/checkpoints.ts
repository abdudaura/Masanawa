import {
  PlatformError,
  toInstant,
  type Instant,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export interface WorkflowCheckpointRecord {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly sequence: number;
  readonly parentSequence: number | null;
  readonly workflowRunRevision: number;
  readonly payload: unknown;
  readonly payloadFingerprint: string;
  readonly createdAt: Instant;
}

interface CheckpointRow {
  schema_version: 1;
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  sequence: string;
  parent_sequence: string | null;
  workflow_run_revision: string;
  payload: unknown;
  payload_fingerprint: string;
  created_at: Date;
}

function checkpoint(row: CheckpointRow): WorkflowCheckpointRecord {
  return Object.freeze({
    schemaVersion: 1,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    sequence: Number(row.sequence),
    parentSequence:
      row.parent_sequence === null ? null : Number(row.parent_sequence),
    workflowRunRevision: Number(row.workflow_run_revision),
    payload: row.payload,
    payloadFingerprint: row.payload_fingerprint,
    createdAt: toInstant(row.created_at),
  });
}

const checkpointColumns = `
  schema_version,
  tenant_id,
  workflow_run_id,
  workflow_version_id,
  graph_signature,
  sequence,
  parent_sequence,
  workflow_run_revision,
  payload,
  payload_fingerprint,
  created_at
`;

export async function appendWorkflowCheckpoint(
  pool: Pool,
  input: WorkflowCheckpointRecord,
): Promise<WorkflowCheckpointRecord> {
  if (input.schemaVersion !== 1) {
    throw new TypeError("unsupported WorkflowCheckpoint schemaVersion");
  }
  const calculatedFingerprint = fingerprintCanonicalJson(input.payload);
  if (calculatedFingerprint !== input.payloadFingerprint) {
    throw new TypeError("checkpoint payload fingerprint does not match payload");
  }

  return withTransaction(pool, async (client) => {
    const run = await client.query<{
      workflow_version_id: WorkflowVersionId;
      graph_signature: string;
      revision: string;
    }>(
      `SELECT workflow_version_id, graph_signature, revision::text
         FROM workflows.workflow_runs
        WHERE tenant_id = $1 AND workflow_run_id = $2
        FOR SHARE`,
      [input.tenantId, input.workflowRunId],
    );
    const currentRun = run.rows[0];
    if (
      !currentRun ||
      currentRun.workflow_version_id !== input.workflowVersionId ||
      currentRun.graph_signature !== input.graphSignature
    ) {
      throw new PlatformError({
        code: "workflows.checkpoint_incompatible",
        category: "conflict",
        message: "Checkpoint does not match the durable WorkflowRun version/graph",
        retryable: false,
      });
    }
    if (Number(currentRun.revision) !== input.workflowRunRevision) {
      throw new PlatformError({
        code: "workflows.checkpoint_stale_revision",
        category: "conflict",
        message: "Checkpoint does not describe the current committed WorkflowRun revision",
        retryable: false,
      });
    }

    const inserted = await client.query<CheckpointRow>(
      `INSERT INTO workflows.checkpoints (
         schema_version,
         tenant_id,
         workflow_run_id,
         workflow_version_id,
         graph_signature,
         sequence,
         parent_sequence,
         workflow_run_revision,
         payload,
         payload_fingerprint,
         created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       ON CONFLICT (tenant_id, workflow_run_id, sequence) DO NOTHING
       RETURNING ${checkpointColumns}`,
      [
        input.schemaVersion,
        input.tenantId,
        input.workflowRunId,
        input.workflowVersionId,
        input.graphSignature,
        input.sequence,
        input.parentSequence,
        input.workflowRunRevision,
        JSON.stringify(input.payload),
        input.payloadFingerprint,
        input.createdAt,
      ],
    );
    if (inserted.rowCount === 1) {
      return checkpoint(inserted.rows[0]!);
    }

    const existing = await client.query<CheckpointRow>(
      `SELECT ${checkpointColumns}
         FROM workflows.checkpoints
        WHERE tenant_id = $1
          AND workflow_run_id = $2
          AND sequence = $3`,
      [input.tenantId, input.workflowRunId, input.sequence],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error("Checkpoint insert conflict could not be reconciled");
    }
    const current = checkpoint(row);
    if (
      current.workflowVersionId !== input.workflowVersionId ||
      current.graphSignature !== input.graphSignature ||
      current.parentSequence !== input.parentSequence ||
      current.workflowRunRevision !== input.workflowRunRevision ||
      current.payloadFingerprint !== input.payloadFingerprint
    ) {
      throw new PlatformError({
        code: "workflows.checkpoint_conflict",
        category: "conflict",
        message: "Checkpoint sequence is already bound to different durable state",
        retryable: false,
      });
    }
    return current;
  });
}

export async function loadLatestCompatibleWorkflowCheckpoint(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly workflowVersionId: WorkflowVersionId;
    readonly graphSignature: string;
    readonly schemaVersion: 1;
  },
): Promise<WorkflowCheckpointRecord | null> {
  const result = await pool.query<CheckpointRow>(
    `SELECT ${checkpointColumns}
       FROM workflows.checkpoints
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND workflow_version_id = $3
        AND graph_signature = $4
        AND schema_version = $5
      ORDER BY sequence DESC
      LIMIT 1`,
    [
      input.tenantId,
      input.workflowRunId,
      input.workflowVersionId,
      input.graphSignature,
      input.schemaVersion,
    ],
  );
  return result.rows[0] ? checkpoint(result.rows[0]) : null;
}

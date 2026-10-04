import {
  PlatformError,
  type Instant,
  type OperationId,
  type RequestId,
  type TenantId,
  type WorkflowId,
  type WorkflowRunId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export type PersistedWorkflowControlMode = "cancel" | "supersede";
export type PersistedWorkflowControlState =
  | "cancel-requested"
  | "cancelled"
  | "superseded";
export type PersistedWorkflowCompensationState =
  | "none"
  | "required"
  | "compensating"
  | "compensated"
  | "failed";

export interface WorkflowRunControlRecord {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly controlRequestId: RequestId;
  readonly commandFingerprint: string;
  readonly mode: PersistedWorkflowControlMode;
  readonly state: PersistedWorkflowControlState;
  readonly reason: string;
  readonly supersededByWorkflowRunId: WorkflowRunId | null;
  readonly compensationState: PersistedWorkflowCompensationState;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface WorkflowCompensationStepRecord {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly originalOperationId: OperationId;
  readonly compensationOperationId: OperationId;
  readonly stepFingerprint: string;
  readonly state: "planned" | "running" | "succeeded" | "failed";
  readonly reason: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

interface ControlRow {
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  control_request_id: RequestId;
  command_fingerprint: string;
  mode: PersistedWorkflowControlMode;
  state: PersistedWorkflowControlState;
  reason: string;
  superseded_by_workflow_run_id: WorkflowRunId | null;
  compensation_state: PersistedWorkflowCompensationState;
  created_at: Date;
  updated_at: Date;
}

interface CompensationRow {
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  original_operation_id: OperationId;
  compensation_operation_id: OperationId;
  step_fingerprint: string;
  state: "planned" | "running" | "succeeded" | "failed";
  reason: string;
  created_at: Date;
  updated_at: Date;
}

const controlColumns = `
  tenant_id, workflow_run_id, control_request_id, command_fingerprint,
  mode, state, reason, superseded_by_workflow_run_id, compensation_state,
  created_at, updated_at
`;

const compensationColumns = `
  tenant_id, workflow_run_id, original_operation_id,
  compensation_operation_id, step_fingerprint, state, reason,
  created_at, updated_at
`;

function controlRecord(row: ControlRow): WorkflowRunControlRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    controlRequestId: row.control_request_id,
    commandFingerprint: row.command_fingerprint,
    mode: row.mode,
    state: row.state,
    reason: row.reason,
    supersededByWorkflowRunId: row.superseded_by_workflow_run_id,
    compensationState: row.compensation_state,
    createdAt: row.created_at.toISOString() as Instant,
    updatedAt: row.updated_at.toISOString() as Instant,
  });
}

function compensationRecord(
  row: CompensationRow,
): WorkflowCompensationStepRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    originalOperationId: row.original_operation_id,
    compensationOperationId: row.compensation_operation_id,
    stepFingerprint: row.step_fingerprint,
    state: row.state,
    reason: row.reason,
    createdAt: row.created_at.toISOString() as Instant,
    updatedAt: row.updated_at.toISOString() as Instant,
  });
}

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(
      `${name} must be non-empty and no longer than ${max} characters`,
    );
  }
  return value;
}

function terminalControlState(
  mode: PersistedWorkflowControlMode,
): Extract<PersistedWorkflowControlState, "cancelled" | "superseded"> {
  return mode === "supersede" ? "superseded" : "cancelled";
}

async function loadControl(
  client: PoolClient,
  tenantId: TenantId,
  workflowRunId: WorkflowRunId,
  forUpdate = false,
): Promise<WorkflowRunControlRecord | null> {
  const result = await client.query<ControlRow>(
    `SELECT ${controlColumns}
       FROM workflows.workflow_run_controls
      WHERE tenant_id = $1 AND workflow_run_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, workflowRunId],
  );
  return result.rows[0] ? controlRecord(result.rows[0]) : null;
}

async function cancelImmediatelyStoppableTasks(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly reason: string;
    readonly at: Instant;
  },
): Promise<number> {
  const result = await client.query(
    `UPDATE workflows.tasks
        SET state = 'cancelled',
            revision = revision + 1,
            updated_at = $4,
            terminal_at = $4,
            wait_reason = NULL,
            failure_code = NULL,
            failure_message = NULL,
            cancellation_reason = $3,
            lease_owner = NULL,
            leased_at = NULL,
            heartbeat_at = NULL,
            lease_expires_at = NULL
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND state IN ('pending', 'ready', 'waiting')`,
    [input.tenantId, input.workflowRunId, input.reason, input.at],
  );
  return result.rowCount ?? 0;
}

async function runningTaskCount(
  client: PoolClient,
  tenantId: TenantId,
  workflowRunId: WorkflowRunId,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM workflows.tasks
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND state = 'running'`,
    [tenantId, workflowRunId],
  );
  return Number(result.rows[0]!.count);
}

async function finalizeControlIfDrained(
  client: PoolClient,
  control: WorkflowRunControlRecord,
  at: Instant,
): Promise<WorkflowRunControlRecord> {
  if (control.state !== "cancel-requested") {
    return control;
  }
  if (
    (await runningTaskCount(
      client,
      control.tenantId,
      control.workflowRunId,
    )) !== 0
  ) {
    return control;
  }

  await cancelImmediatelyStoppableTasks(client, {
    tenantId: control.tenantId,
    workflowRunId: control.workflowRunId,
    reason: control.reason,
    at,
  });

  const run = await client.query<{ state: string }>(
    `SELECT state
       FROM workflows.workflow_runs
      WHERE tenant_id = $1
        AND workflow_run_id = $2
      FOR UPDATE`,
    [control.tenantId, control.workflowRunId],
  );
  const runState = run.rows[0]?.state;
  if (!runState) {
    throw new PlatformError({
      code: "workflows.run_not_found",
      category: "not-found",
      message: "WorkflowRun does not exist",
      retryable: false,
    });
  }
  if (runState === "completed" || runState === "failed") {
    throw new PlatformError({
      code: "workflows.control_run_terminal",
      category: "conflict",
      message: "WorkflowRun became terminal before cancellation finalization",
      retryable: false,
    });
  }

  if (runState !== "cancelled") {
    await client.query(
      `UPDATE workflows.workflow_runs
          SET state = 'cancelled',
              revision = revision + 1,
              updated_at = $3,
              terminal_at = $3,
              wait_reason = NULL,
              failure_code = NULL,
              failure_message = NULL,
              cancellation_reason = $4
        WHERE tenant_id = $1
          AND workflow_run_id = $2`,
      [
        control.tenantId,
        control.workflowRunId,
        at,
        control.reason,
      ],
    );
  }

  const state = terminalControlState(control.mode);
  const updated = await client.query<ControlRow>(
    `UPDATE workflows.workflow_run_controls
        SET state = $3,
            updated_at = $4
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND state = 'cancel-requested'
      RETURNING ${controlColumns}`,
    [
      control.tenantId,
      control.workflowRunId,
      state,
      at,
    ],
  );
  return updated.rows[0] ? controlRecord(updated.rows[0]) : control;
}

export async function requestWorkflowRunControl(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly controlRequestId: RequestId;
    readonly mode: PersistedWorkflowControlMode;
    readonly reason: string;
    readonly supersededByWorkflowRunId: WorkflowRunId | null;
    readonly compensationRequired: boolean;
    readonly at: Instant;
  },
): Promise<WorkflowRunControlRecord> {
  bounded(input.reason, "control.reason", 500);
  if (!["cancel", "supersede"].includes(input.mode)) {
    throw new TypeError("workflow control mode is not supported");
  }
  if (
    (input.mode === "supersede") !==
    (input.supersededByWorkflowRunId !== null)
  ) {
    throw new TypeError(
      "supersede control requires exactly one successor WorkflowRun",
    );
  }
  if (input.supersededByWorkflowRunId === input.workflowRunId) {
    throw new TypeError("WorkflowRun cannot supersede itself");
  }

  const commandFingerprint = fingerprintCanonicalJson({
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    controlRequestId: input.controlRequestId,
    mode: input.mode,
    reason: input.reason,
    supersededByWorkflowRunId: input.supersededByWorkflowRunId,
    compensationRequired: input.compensationRequired,
  });

  return withTransaction(pool, async (client) => {
    const existing = await loadControl(
      client,
      input.tenantId,
      input.workflowRunId,
      true,
    );
    if (existing) {
      if (existing.commandFingerprint !== commandFingerprint) {
        throw new PlatformError({
          code: "workflows.control_conflict",
          category: "conflict",
          message: "WorkflowRun already has a different control command",
          retryable: false,
        });
      }
      return finalizeControlIfDrained(client, existing, input.at);
    }

    const run = await client.query<{
      workflow_id: WorkflowId;
      state: string;
    }>(
      `SELECT workflow_id, state
         FROM workflows.workflow_runs
        WHERE tenant_id = $1 AND workflow_run_id = $2
        FOR UPDATE`,
      [input.tenantId, input.workflowRunId],
    );
    const current = run.rows[0];
    if (!current) {
      throw new PlatformError({
        code: "workflows.run_not_found",
        category: "not-found",
        message: "WorkflowRun does not exist",
        retryable: false,
      });
    }
    if (["completed", "failed", "cancelled"].includes(current.state)) {
      throw new PlatformError({
        code: "workflows.control_run_terminal",
        category: "conflict",
        message: "Terminal WorkflowRun cannot accept new control",
        retryable: false,
      });
    }

    if (input.mode === "supersede") {
      const successor = await client.query<{
        workflow_id: WorkflowId;
        state: string;
      }>(
        `SELECT workflow_id, state
           FROM workflows.workflow_runs
          WHERE tenant_id = $1 AND workflow_run_id = $2
          FOR SHARE`,
        [input.tenantId, input.supersededByWorkflowRunId],
      );
      const target = successor.rows[0];
      if (
        !target ||
        target.workflow_id !== current.workflow_id ||
        ["failed", "cancelled"].includes(target.state)
      ) {
        throw new PlatformError({
          code: "workflows.supersession_target_invalid",
          category: "conflict",
          message: "Superseding WorkflowRun is missing, terminally invalid or from another Workflow",
          retryable: false,
        });
      }
    }

    const inserted = await client.query<ControlRow>(
      `INSERT INTO workflows.workflow_run_controls (
         tenant_id, workflow_run_id, control_request_id,
         command_fingerprint, mode, state, reason,
         superseded_by_workflow_run_id, compensation_state,
         created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'cancel-requested',$6,$7,$8,$9,$9)
       RETURNING ${controlColumns}`,
      [
        input.tenantId,
        input.workflowRunId,
        input.controlRequestId,
        commandFingerprint,
        input.mode,
        input.reason,
        input.supersededByWorkflowRunId,
        input.compensationRequired ? "required" : "none",
        input.at,
      ],
    );
    let control = controlRecord(inserted.rows[0]!);

    await cancelImmediatelyStoppableTasks(client, {
      tenantId: input.tenantId,
      workflowRunId: input.workflowRunId,
      reason: input.reason,
      at: input.at,
    });

    control = await finalizeControlIfDrained(client, control, input.at);
    return control;
  });
}

export async function finalizeWorkflowRunControl(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly at: Instant;
  },
): Promise<WorkflowRunControlRecord> {
  return withTransaction(pool, async (client) => {
    const control = await loadControl(
      client,
      input.tenantId,
      input.workflowRunId,
      true,
    );
    if (!control) {
      throw new PlatformError({
        code: "workflows.control_not_found",
        category: "not-found",
        message: "WorkflowRun control does not exist",
        retryable: false,
      });
    }
    return finalizeControlIfDrained(client, control, input.at);
  });
}

export async function registerWorkflowCompensationStep(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly originalOperationId: OperationId;
    readonly compensationOperationId: OperationId;
    readonly reason: string;
    readonly at: Instant;
  },
): Promise<WorkflowCompensationStepRecord> {
  bounded(input.reason, "compensation.reason", 500);
  if (input.originalOperationId === input.compensationOperationId) {
    throw new TypeError(
      "compensation Operation must differ from original Operation",
    );
  }

  const stepFingerprint = fingerprintCanonicalJson({
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    originalOperationId: input.originalOperationId,
    compensationOperationId: input.compensationOperationId,
    reason: input.reason,
  });

  return withTransaction(pool, async (client) => {
    const control = await loadControl(
      client,
      input.tenantId,
      input.workflowRunId,
      true,
    );
    if (
      !control ||
      !["required", "compensating"].includes(control.compensationState)
    ) {
      throw new PlatformError({
        code: "workflows.compensation_not_required",
        category: "conflict",
        message: "WorkflowRun is not accepting compensation work",
        retryable: false,
      });
    }

    const existing = await client.query<CompensationRow>(
      `SELECT ${compensationColumns}
         FROM workflows.workflow_compensation_steps
        WHERE tenant_id = $1
          AND workflow_run_id = $2
          AND original_operation_id = $3
        FOR UPDATE`,
      [
        input.tenantId,
        input.workflowRunId,
        input.originalOperationId,
      ],
    );
    const current = existing.rows[0];
    if (current) {
      if (current.step_fingerprint !== stepFingerprint) {
        throw new PlatformError({
          code: "workflows.compensation_conflict",
          category: "conflict",
          message: "Original Operation already has a different compensation binding",
          retryable: false,
        });
      }
      return compensationRecord(current);
    }

    const inserted = await client.query<CompensationRow>(
      `INSERT INTO workflows.workflow_compensation_steps (
         tenant_id, workflow_run_id, original_operation_id,
         compensation_operation_id, step_fingerprint, state, reason,
         created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'planned',$6,$7,$7)
       RETURNING ${compensationColumns}`,
      [
        input.tenantId,
        input.workflowRunId,
        input.originalOperationId,
        input.compensationOperationId,
        stepFingerprint,
        input.reason,
        input.at,
      ],
    );

    await client.query(
      `UPDATE workflows.workflow_run_controls
          SET compensation_state = 'compensating',
              updated_at = $3
        WHERE tenant_id = $1 AND workflow_run_id = $2`,
      [input.tenantId, input.workflowRunId, input.at],
    );

    return compensationRecord(inserted.rows[0]!);
  });
}

const compensationTransitions = new Map<
  WorkflowCompensationStepRecord["state"],
  ReadonlySet<WorkflowCompensationStepRecord["state"]>
>([
  ["planned", new Set(["running", "failed"])],
  ["running", new Set(["succeeded", "failed"])],
  ["succeeded", new Set()],
  ["failed", new Set()],
]);

export async function transitionWorkflowCompensationStep(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workflowRunId: WorkflowRunId;
    readonly originalOperationId: OperationId;
    readonly from: WorkflowCompensationStepRecord["state"];
    readonly to: WorkflowCompensationStepRecord["state"];
    readonly at: Instant;
  },
): Promise<WorkflowCompensationStepRecord> {
  if (!compensationTransitions.get(input.from)?.has(input.to)) {
    throw new TypeError(
      `illegal workflow compensation transition: ${input.from} -> ${input.to}`,
    );
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<CompensationRow>(
      `UPDATE workflows.workflow_compensation_steps
          SET state = $5,
              updated_at = $6
        WHERE tenant_id = $1
          AND workflow_run_id = $2
          AND original_operation_id = $3
          AND state = $4
        RETURNING ${compensationColumns}`,
      [
        input.tenantId,
        input.workflowRunId,
        input.originalOperationId,
        input.from,
        input.to,
        input.at,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new PlatformError({
        code: "workflows.compensation_stale_transition",
        category: "conflict",
        message: "Compensation step state changed before transition",
        retryable: false,
      });
    }

    if (input.to === "failed") {
      await client.query(
        `UPDATE workflows.workflow_run_controls
            SET compensation_state = 'failed',
                updated_at = $3
          WHERE tenant_id = $1 AND workflow_run_id = $2`,
        [input.tenantId, input.workflowRunId, input.at],
      );
    } else if (input.to === "running") {
      await client.query(
        `UPDATE workflows.workflow_run_controls
            SET compensation_state = 'compensating',
                updated_at = $3
          WHERE tenant_id = $1 AND workflow_run_id = $2
            AND compensation_state <> 'failed'`,
        [input.tenantId, input.workflowRunId, input.at],
      );
    } else if (input.to === "succeeded") {
      const remaining = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM workflows.workflow_compensation_steps
          WHERE tenant_id = $1
            AND workflow_run_id = $2
            AND state <> 'succeeded'`,
        [input.tenantId, input.workflowRunId],
      );
      if (Number(remaining.rows[0]!.count) === 0) {
        await client.query(
          `UPDATE workflows.workflow_run_controls
              SET compensation_state = 'compensated',
                  updated_at = $3
            WHERE tenant_id = $1 AND workflow_run_id = $2
              AND compensation_state <> 'failed'`,
          [input.tenantId, input.workflowRunId, input.at],
        );
      }
    }

    return compensationRecord(row);
  });
}

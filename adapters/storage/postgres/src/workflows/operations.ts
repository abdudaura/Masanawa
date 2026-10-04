import {
  PlatformError,
  type ExternalReceiptId,
  type Instant,
  type OperationId,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import {
  type OperationState,
  type ReconciliationStatus,
} from "@masanawa/events";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export type PersistedWorkflowOperationRole =
  | "primary"
  | "verification"
  | "compensation";

export interface PersistedWorkflowOperationBinding {
  readonly tenantId: TenantId;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly role: PersistedWorkflowOperationRole;
  readonly operationId: OperationId;
  readonly bindingFingerprint: string;
  readonly boundAt: Instant;
}

export interface WorkflowOperationTruthProjection {
  readonly binding: PersistedWorkflowOperationBinding;
  readonly operationState: OperationState;
  readonly reconciliationStatus: ReconciliationStatus | null;
  readonly receiptIds: readonly ExternalReceiptId[];
}

interface BindingRow {
  tenant_id: TenantId;
  task_id: TaskId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  role: PersistedWorkflowOperationRole;
  operation_id: OperationId;
  binding_fingerprint: string;
  bound_at: Date;
}

function bindingRecord(row: BindingRow): PersistedWorkflowOperationBinding {
  return Object.freeze({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    role: row.role,
    operationId: row.operation_id,
    bindingFingerprint: row.binding_fingerprint,
    boundAt: row.bound_at.toISOString() as Instant,
  });
}

function bindingFingerprint(
  input: Omit<PersistedWorkflowOperationBinding, "bindingFingerprint">,
): string {
  return fingerprintCanonicalJson(input);
}

export async function bindWorkflowTaskOperation(
  pool: Pool,
  input: Omit<PersistedWorkflowOperationBinding, "bindingFingerprint">,
): Promise<PersistedWorkflowOperationBinding> {
  if (!["primary", "verification", "compensation"].includes(input.role)) {
    throw new TypeError("workflow operation role is not supported");
  }
  const fingerprint = bindingFingerprint(input);

  return withTransaction(pool, async (client) => {
    const task = await client.query(
      `SELECT 1
         FROM workflows.tasks
        WHERE tenant_id = $1
          AND task_id = $2
          AND workflow_run_id = $3
          AND workflow_version_id = $4
          AND graph_signature = $5`,
      [
        input.tenantId,
        input.taskId,
        input.workflowRunId,
        input.workflowVersionId,
        input.graphSignature,
      ],
    );
    if (task.rowCount !== 1) {
      throw new PlatformError({
        code: "workflows.operation_task_binding_invalid",
        category: "conflict",
        message: "Workflow Task identity/version/graph binding is invalid",
        retryable: false,
      });
    }

    const operation = await client.query<{ tenant_id: TenantId }>(
      `SELECT tenant_id
         FROM events.operations
        WHERE operation_id = $1`,
      [input.operationId],
    );
    if (
      operation.rowCount !== 1 ||
      operation.rows[0]!.tenant_id !== input.tenantId
    ) {
      throw new PlatformError({
        code: "workflows.operation_tenant_mismatch",
        category: "authorization",
        message: "Canonical Operation does not belong to the Workflow Task tenant",
        retryable: false,
        operationId: input.operationId,
      });
    }

    const inserted = await client.query<BindingRow>(
      `INSERT INTO workflows.task_operation_bindings (
         tenant_id, task_id, workflow_run_id, workflow_version_id,
         graph_signature, role, operation_id, binding_fingerprint, bound_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING
       RETURNING tenant_id, task_id, workflow_run_id, workflow_version_id,
                 graph_signature, role, operation_id, binding_fingerprint,
                 bound_at`,
      [
        input.tenantId,
        input.taskId,
        input.workflowRunId,
        input.workflowVersionId,
        input.graphSignature,
        input.role,
        input.operationId,
        fingerprint,
        input.boundAt,
      ],
    );
    if (inserted.rowCount === 1) {
      return bindingRecord(inserted.rows[0]!);
    }

    const existing = await client.query<BindingRow>(
      `SELECT tenant_id, task_id, workflow_run_id, workflow_version_id,
              graph_signature, role, operation_id, binding_fingerprint,
              bound_at
         FROM workflows.task_operation_bindings
        WHERE tenant_id = $1 AND task_id = $2 AND role = $3`,
      [input.tenantId, input.taskId, input.role],
    );
    const row = existing.rows[0];
    if (!row || row.binding_fingerprint !== fingerprint) {
      throw new PlatformError({
        code: "workflows.operation_binding_conflict",
        category: "conflict",
        message: "Workflow Task operation role is already bound to different canonical work",
        retryable: false,
        operationId: input.operationId,
      });
    }
    return bindingRecord(row);
  });
}

export async function loadWorkflowTaskOperationTruth(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly taskId: TaskId;
    readonly role: PersistedWorkflowOperationRole;
  },
): Promise<WorkflowOperationTruthProjection> {
  return withTransaction(
    pool,
    async (client) => {
      const result = await client.query<
        BindingRow & { operation_state: OperationState }
      >(
        `SELECT b.tenant_id, b.task_id, b.workflow_run_id,
                b.workflow_version_id, b.graph_signature, b.role,
                b.operation_id, b.binding_fingerprint, b.bound_at,
                o.state AS operation_state
           FROM workflows.task_operation_bindings AS b
           JOIN events.operations AS o
             ON o.operation_id = b.operation_id
            AND o.tenant_id = b.tenant_id
          WHERE b.tenant_id = $1
            AND b.task_id = $2
            AND b.role = $3`,
        [input.tenantId, input.taskId, input.role],
      );
      const row = result.rows[0];
      if (!row) {
        throw new PlatformError({
          code: "workflows.operation_binding_not_found",
          category: "not-found",
          message: "Workflow Task operation binding does not exist",
          retryable: false,
        });
      }

      const receipts = await client.query<{
        external_receipt_id: ExternalReceiptId;
      }>(
        `SELECT external_receipt_id
           FROM events.external_receipts
          WHERE tenant_id = $1
            AND operation_id = $2
          ORDER BY observed_at, created_at, external_receipt_id`,
        [input.tenantId, row.operation_id],
      );

      const reconciliation = await client.query<{
        status: ReconciliationStatus;
      }>(
        `SELECT status
           FROM events.reconciliation_cases
          WHERE tenant_id = $1
            AND operation_id = $2
            AND status IN ('open', 'checking', 'needs-attention')
          ORDER BY opened_at DESC, reconciliation_case_id DESC
          LIMIT 1`,
        [input.tenantId, row.operation_id],
      );

      return Object.freeze({
        binding: bindingRecord(row),
        operationState: row.operation_state,
        reconciliationStatus: reconciliation.rows[0]?.status ?? null,
        receiptIds: Object.freeze(
          receipts.rows.map((receipt) => receipt.external_receipt_id),
        ),
      });
    },
    { readOnly: true },
  );
}

import {
  PlatformError,
  toInstant,
  type ApprovalId,
  type Instant,
  type RequestId,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool } from "pg";
import { loadApproval } from "../security/approvals.js";
import { withTransaction } from "../transaction.js";

export type PersistedHumanRequestKind =
  | "information"
  | "confirmation"
  | "approval";
export type PersistedHumanRequestState =
  | "pending"
  | "answered"
  | "rejected"
  | "cancelled";
export type PersistedHumanResponse = string | boolean | null;

export interface PersistedWorkflowHumanRequest {
  readonly tenantId: TenantId;
  readonly humanRequestId: RequestId;
  readonly workflowRunId: WorkflowRunId;
  readonly taskId: TaskId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly kind: PersistedHumanRequestKind;
  readonly state: PersistedHumanRequestState;
  readonly prompt: string;
  readonly approvalId: ApprovalId | null;
  readonly requestFingerprint: string;
  readonly response: PersistedHumanResponse;
  readonly responseFingerprint: string | null;
  readonly requestedAt: Instant;
  readonly resolvedAt: Instant | null;
}

export interface OpenWorkflowHumanRequestInput {
  readonly request: Readonly<{
    tenantId: TenantId;
    humanRequestId: RequestId;
    workflowRunId: WorkflowRunId;
    taskId: TaskId;
    workflowVersionId: WorkflowVersionId;
    graphSignature: string;
    kind: PersistedHumanRequestKind;
    prompt: string;
    approvalId: ApprovalId | null;
    requestedAt: Instant;
  }>;
  readonly workerId: string;
  readonly leaseFence: number;
}

interface HumanRequestRow {
  tenant_id: TenantId;
  human_request_id: RequestId;
  workflow_run_id: WorkflowRunId;
  task_id: TaskId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  kind: PersistedHumanRequestKind;
  state: PersistedHumanRequestState;
  prompt: string;
  approval_id: ApprovalId | null;
  request_fingerprint: string;
  response_payload: string | boolean | null;
  response_fingerprint: string | null;
  requested_at: Date;
  resolved_at: Date | null;
}

function requestRecord(row: HumanRequestRow): PersistedWorkflowHumanRequest {
  return Object.freeze({
    tenantId: row.tenant_id,
    humanRequestId: row.human_request_id,
    workflowRunId: row.workflow_run_id,
    taskId: row.task_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    kind: row.kind,
    state: row.state,
    prompt: row.prompt,
    approvalId: row.approval_id,
    requestFingerprint: row.request_fingerprint,
    response: row.response_payload,
    responseFingerprint: row.response_fingerprint,
    requestedAt: toInstant(row.requested_at),
    resolvedAt: row.resolved_at ? toInstant(row.resolved_at) : null,
  });
}

const columns = `
  tenant_id, human_request_id, workflow_run_id, task_id, workflow_version_id,
  graph_signature, kind, state, prompt, approval_id, request_fingerprint,
  response_payload, response_fingerprint, requested_at, resolved_at
`;

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(`${name} must be non-empty and no longer than ${max} characters`);
  }
  return value;
}

function requestFingerprint(
  request: OpenWorkflowHumanRequestInput["request"],
): string {
  return fingerprintCanonicalJson(request);
}

async function loadRequest(
  client: Parameters<Parameters<typeof withTransaction>[1]>[0],
  tenantId: TenantId,
  humanRequestId: RequestId,
  forUpdate = false,
): Promise<PersistedWorkflowHumanRequest | null> {
  const result = await client.query<HumanRequestRow>(
    `SELECT ${columns}
       FROM workflows.human_requests
      WHERE tenant_id = $1 AND human_request_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, humanRequestId],
  );
  return result.rows[0] ? requestRecord(result.rows[0]) : null;
}

export async function openWorkflowHumanRequest(
  pool: Pool,
  input: OpenWorkflowHumanRequestInput,
): Promise<PersistedWorkflowHumanRequest> {
  bounded(input.workerId, "workerId", 200);
  bounded(input.request.prompt, "request.prompt", 4_000);
  if (!Number.isSafeInteger(input.leaseFence) || input.leaseFence < 1) {
    throw new RangeError("leaseFence must be a positive safe integer");
  }
  if (
    !["information", "confirmation", "approval"].includes(input.request.kind)
  ) {
    throw new TypeError("human request kind is not supported");
  }
  if (
    (input.request.kind === "approval") !==
    (input.request.approvalId !== null)
  ) {
    throw new TypeError("approval human request requires exactly one ApprovalId");
  }

  const fingerprint = requestFingerprint(input.request);

  return withTransaction(pool, async (client) => {
    const existing = await loadRequest(
      client,
      input.request.tenantId,
      input.request.humanRequestId,
      true,
    );
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new PlatformError({
          code: "workflows.human_request_conflict",
          category: "conflict",
          message: "Human request identity is already bound to different durable content",
          retryable: false,
        });
      }
      return existing;
    }

    if (input.request.kind === "approval") {
      const approval = await loadApproval(
        client,
        input.request.tenantId,
        input.request.approvalId!,
      );
      if (
        !["pending", "approved"].includes(approval.state) ||
        approval.expiresAt <= input.request.requestedAt
      ) {
        throw new PlatformError({
          code: "workflows.human_request_approval_unavailable",
          category: "authorization",
          message: "Referenced approval is not pending/approved and current",
          retryable: false,
        });
      }
    }

    const waitReason = `human_request:${input.request.humanRequestId}`;
    const task = await client.query(
      `UPDATE workflows.tasks
          SET state = 'waiting',
              revision = revision + 1,
              updated_at = $6,
              wait_reason = $7,
              terminal_at = NULL,
              failure_code = NULL,
              failure_message = NULL,
              cancellation_reason = NULL,
              lease_owner = NULL,
              leased_at = NULL,
              heartbeat_at = NULL,
              lease_expires_at = NULL
        WHERE tenant_id = $1
          AND task_id = $2
          AND workflow_run_id = $3
          AND workflow_version_id = $4
          AND graph_signature = $5
          AND state = 'running'
          AND lease_owner = $8
          AND lease_fence = $9
          AND started_at <= $6::timestamptz
          AND lease_expires_at > $6::timestamptz`,
      [
        input.request.tenantId,
        input.request.taskId,
        input.request.workflowRunId,
        input.request.workflowVersionId,
        input.request.graphSignature,
        input.request.requestedAt,
        waitReason,
        input.workerId,
        input.leaseFence,
      ],
    );
    if (task.rowCount !== 1) {
      throw new PlatformError({
        code: "workflows.task_stale_lease",
        category: "conflict",
        message: "Workflow Task lease is no longer current",
        retryable: false,
      });
    }

    const inserted = await client.query<HumanRequestRow>(
      `INSERT INTO workflows.human_requests (
         tenant_id, human_request_id, workflow_run_id, task_id,
         workflow_version_id, graph_signature, kind, state, prompt,
         approval_id, request_fingerprint, requested_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11)
       RETURNING ${columns}`,
      [
        input.request.tenantId,
        input.request.humanRequestId,
        input.request.workflowRunId,
        input.request.taskId,
        input.request.workflowVersionId,
        input.request.graphSignature,
        input.request.kind,
        input.request.prompt,
        input.request.approvalId,
        fingerprint,
        input.request.requestedAt,
      ],
    );
    return requestRecord(inserted.rows[0]!);
  });
}

function responseFingerprint(value: string | boolean): string {
  return fingerprintCanonicalJson(value);
}

async function settleHumanRequest(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly humanRequestId: RequestId;
    readonly response: string | boolean;
    readonly targetState: "answered" | "rejected";
    readonly resumeTask: boolean;
    readonly at: Instant;
  },
): Promise<PersistedWorkflowHumanRequest> {
  return withTransaction(pool, async (client) => {
    const current = await loadRequest(
      client,
      input.tenantId,
      input.humanRequestId,
      true,
    );
    if (!current) {
      throw new PlatformError({
        code: "workflows.human_request_not_found",
        category: "not-found",
        message: "Workflow human request does not exist",
        retryable: false,
      });
    }

    const fingerprint = responseFingerprint(input.response);
    if (current.state !== "pending") {
      if (
        current.state === input.targetState &&
        current.responseFingerprint === fingerprint &&
        current.response === input.response
      ) {
        return current;
      }
      throw new PlatformError({
        code: "workflows.human_request_conflict",
        category: "conflict",
        message: "Workflow human request already has a different terminal response",
        retryable: false,
      });
    }

    const expectedWaitReason = `human_request:${current.humanRequestId}`;
    const nextTaskState = input.resumeTask ? "ready" : "cancelled";
    const task = await client.query(
      `UPDATE workflows.tasks
          SET state = $6,
              revision = revision + 1,
              updated_at = $7,
              wait_reason = NULL,
              terminal_at = CASE WHEN $6 = 'cancelled' THEN $7 ELSE NULL END,
              cancellation_reason =
                CASE WHEN $6 = 'cancelled' THEN 'human_request_rejected' ELSE NULL END
        WHERE tenant_id = $1
          AND task_id = $2
          AND workflow_run_id = $3
          AND workflow_version_id = $4
          AND graph_signature = $5
          AND state = 'waiting'
          AND wait_reason = $8`,
      [
        current.tenantId,
        current.taskId,
        current.workflowRunId,
        current.workflowVersionId,
        current.graphSignature,
        nextTaskState,
        input.at,
        expectedWaitReason,
      ],
    );
    if (task.rowCount !== 1) {
      throw new PlatformError({
        code: "workflows.human_request_task_conflict",
        category: "conflict",
        message: "Workflow Task is no longer waiting on this human request",
        retryable: false,
      });
    }

    const updated = await client.query<HumanRequestRow>(
      `UPDATE workflows.human_requests
          SET state = $3,
              response_payload = $4::jsonb,
              response_fingerprint = $5,
              resolved_at = $6
        WHERE tenant_id = $1
          AND human_request_id = $2
          AND state = 'pending'
        RETURNING ${columns}`,
      [
        input.tenantId,
        input.humanRequestId,
        input.targetState,
        JSON.stringify(input.response),
        fingerprint,
        input.at,
      ],
    );
    return requestRecord(updated.rows[0]!);
  });
}

export async function answerWorkflowHumanRequest(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly humanRequestId: RequestId;
    readonly response: string | boolean;
    readonly at: Instant;
  },
): Promise<PersistedWorkflowHumanRequest> {
  const client = await pool.connect();
  let current: PersistedWorkflowHumanRequest | null;
  try {
    current = await loadRequest(
      client,
      input.tenantId,
      input.humanRequestId,
      false,
    );
  } finally {
    client.release();
  }
  if (!current) {
    throw new PlatformError({
      code: "workflows.human_request_not_found",
      category: "not-found",
      message: "Workflow human request does not exist",
      retryable: false,
    });
  }
  if (current.kind === "approval") {
    throw new TypeError(
      "approval human requests must be resolved from canonical approval state",
    );
  }
  if (current.kind === "information") {
    if (typeof input.response !== "string") {
      throw new TypeError("information human request requires string response");
    }
    bounded(input.response, "response", 8_000);
    return settleHumanRequest(pool, {
      ...input,
      response: input.response,
      targetState: "answered",
      resumeTask: true,
    });
  }
  if (typeof input.response !== "boolean") {
    throw new TypeError("confirmation human request requires boolean response");
  }
  return settleHumanRequest(pool, {
    ...input,
    response: input.response,
    targetState: input.response ? "answered" : "rejected",
    resumeTask: input.response,
  });
}

export async function resolveApprovalWorkflowHumanRequest(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly humanRequestId: RequestId;
    readonly at: Instant;
  },
): Promise<PersistedWorkflowHumanRequest> {
  const client = await pool.connect();
  let current: PersistedWorkflowHumanRequest | null;
  try {
    current = await loadRequest(
      client,
      input.tenantId,
      input.humanRequestId,
      false,
    );
    if (!current) {
      throw new PlatformError({
        code: "workflows.human_request_not_found",
        category: "not-found",
        message: "Workflow human request does not exist",
        retryable: false,
      });
    }
    if (current.state !== "pending") {
      return current;
    }
    if (current.kind !== "approval" || current.approvalId === null) {
      throw new TypeError("human request is not approval-backed");
    }

    const approval = await loadApproval(
      client,
      current.tenantId,
      current.approvalId,
    );
    if (approval.state === "pending" && approval.expiresAt > input.at) {
      throw new PlatformError({
        code: "workflows.human_request_approval_pending",
        category: "conflict",
        message: "Referenced approval is still pending",
        retryable: true,
      });
    }
    const approved =
      approval.state === "approved" && approval.expiresAt > input.at;
    return settleHumanRequest(pool, {
      tenantId: input.tenantId,
      humanRequestId: input.humanRequestId,
      response: approved,
      targetState: approved ? "answered" : "rejected",
      resumeTask: approved,
      at: input.at,
    });
  } finally {
    client.release();
  }
}

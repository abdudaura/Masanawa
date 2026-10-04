import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createApprovalBinding,
  createPendingApproval,
} from "@masanawa/security";
import {
  admitWorkflowTask,
  answerWorkflowHumanRequest,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  openWorkflowHumanRequest,
  persistPendingApproval,
  resolveApprovalWorkflowHumanRequest,
  runMigrations,
  setPolicyRevision,
  settlePendingApproval,
  withTransaction,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow human request acceptance", () => {
  const databaseName =
    `masanawa_workflow_human_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-human-request-admin",
      max: 1,
    });

    const version = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(
      180000,
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeLessThan(190000);

    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;

    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
    pool = openPool("initial");

    await runMigrations(pool, [
      {
        owner: "events",
        directory: fileURLToPath(
          new URL("../../packages/events/migrations/", import.meta.url),
        ),
      },
      {
        owner: "security",
        directory: fileURLToPath(
          new URL("../../packages/security/migrations/", import.meta.url),
        ),
      },
      ...workflowMigrationRoots(),
    ]);
  });

  afterAll(async () => {
    try {
      await pool?.end();
      if (created) {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
          [databaseName],
        );
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally {
      await admin?.end();
    }
  });

  function openPool(label: string) {
    return createPostgresPool({
      connectionString: databaseUrl,
      applicationName: `workflow-human-request-${label}`,
      max: 3,
    });
  }

  async function createRunAndLease(nodeKey: string) {
    const createdAt = toInstant(new Date("2026-10-04T18:00:00.000Z"));
    const runInput = {
      tenantId: createCanonicalId("tenant"),
      workflowRunId: createCanonicalId("workflow-run"),
      workflowId: createCanonicalId("workflow"),
      workflowVersionId: createCanonicalId("workflow-version"),
      graphSignature: `sha256:${"a".repeat(64)}`,
      initiatedByUserId: createCanonicalId("user"),
      state: "pending" as const,
      revision: 1,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      terminalAt: null,
      waitReason: null,
      failure: null,
      cancellationReason: null,
    };

    const client = await pool.connect();
    let run;
    try {
      run = await createWorkflowRunRecord(client, runInput);
    } finally {
      client.release();
    }

    const taskId = createCanonicalId("task");
    const admittedAt = toInstant(new Date("2026-10-04T18:01:00.000Z"));
    await admitWorkflowTask(pool, {
      task: {
        tenantId: run.tenantId,
        taskId,
        workflowRunId: run.workflowRunId,
        workflowVersionId: run.workflowVersionId,
        graphSignature: run.graphSignature,
        nodeKey,
        lineage: {
          parentTaskId: null,
          rootTaskId: taskId,
          depth: 0,
        },
        state: "ready",
        revision: 1,
        admissionRequestId: createCanonicalId("request"),
        createdAt: admittedAt,
        updatedAt: admittedAt,
        startedAt: null,
        terminalAt: null,
        waitReason: null,
        failure: null,
        cancellationReason: null,
      },
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      destination: "workflow.tasks",
      availableAt: admittedAt,
    });

    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 60_000,
    });
    if (!lease) throw new Error("Expected leased Workflow Task");
    return { run, lease };
  }

  function requestAt(leasedAt: string, offsetMs = 500) {
    return toInstant(new Date(new Date(leasedAt).getTime() + offsetMs));
  }

  function humanRequest(
    run: Awaited<ReturnType<typeof createRunAndLease>>["run"],
    lease: Awaited<ReturnType<typeof createRunAndLease>>["lease"],
    kind: "information" | "confirmation" | "approval",
    requestedAt: string,
    approvalId: ReturnType<typeof createCanonicalId<"approval">> | null = null,
  ) {
    return {
      tenantId: run.tenantId,
      humanRequestId: createCanonicalId("request"),
      workflowRunId: run.workflowRunId,
      taskId: lease.taskId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      kind,
      prompt:
        kind === "information"
          ? "Which account should be used?"
          : kind === "confirmation"
            ? "Continue with this action?"
            : "Approve this consequential action?",
      approvalId,
      requestedAt: requestedAt as ReturnType<typeof toInstant>,
    };
  }

  it("opens one durable information request, replays exactly, and resumes on answer", async () => {
    const { run, lease } = await createRunAndLease("ask_information");
    const at = requestAt(lease.leasedAt);
    const request = humanRequest(run, lease, "information", at);

    const opened = await openWorkflowHumanRequest(pool, {
      request,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
    });
    expect(opened).toMatchObject({
      state: "pending",
      kind: "information",
      taskId: lease.taskId,
    });

    const replayed = await openWorkflowHumanRequest(pool, {
      request,
      workerId: "stale-worker-after-response-loss",
      leaseFence: lease.leaseFence,
    });
    expect(replayed).toEqual(opened);

    await expect(
      openWorkflowHumanRequest(pool, {
        request: {
          ...request,
          prompt: "Changed prompt",
        },
        workerId: lease.leaseOwner,
        leaseFence: lease.leaseFence,
      }),
    ).rejects.toMatchObject({
      code: "workflows.human_request_conflict",
      category: "conflict",
      retryable: false,
    });

    const resolvedAt = toInstant(
      new Date(new Date(at).getTime() + 1_000),
    );
    const answered = await answerWorkflowHumanRequest(pool, {
      tenantId: run.tenantId,
      humanRequestId: request.humanRequestId,
      response: "Primary account",
      at: resolvedAt,
    });
    expect(answered).toMatchObject({
      state: "answered",
      response: "Primary account",
    });

    const exactReplay = await answerWorkflowHumanRequest(pool, {
      tenantId: run.tenantId,
      humanRequestId: request.humanRequestId,
      response: "Primary account",
      at: resolvedAt,
    });
    expect(exactReplay).toEqual(answered);

    const task = await pool.query<{
      state: string;
      wait_reason: string | null;
      lease_owner: string | null;
    }>(
      "SELECT state, wait_reason, lease_owner FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(task.rows[0]).toEqual({
      state: "ready",
      wait_reason: null,
      lease_owner: null,
    });
  });

  it("rejects a negative confirmation and terminally cancels the Task", async () => {
    const { run, lease } = await createRunAndLease("confirm_action");
    const at = requestAt(lease.leasedAt);
    const request = humanRequest(run, lease, "confirmation", at);

    await openWorkflowHumanRequest(pool, {
      request,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
    });

    const rejectedAt = toInstant(
      new Date(new Date(at).getTime() + 1_000),
    );
    const rejected = await answerWorkflowHumanRequest(pool, {
      tenantId: run.tenantId,
      humanRequestId: request.humanRequestId,
      response: false,
      at: rejectedAt,
    });
    expect(rejected).toMatchObject({
      state: "rejected",
      response: false,
    });

    const task = await pool.query<{
      state: string;
      cancellation_reason: string | null;
      terminal_at: Date | null;
    }>(
      "SELECT state, cancellation_reason, terminal_at FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(task.rows[0]).toMatchObject({
      state: "cancelled",
      cancellation_reason: "human_request_rejected",
    });
    expect(task.rows[0]!.terminal_at).not.toBeNull();

    await expect(
      answerWorkflowHumanRequest(pool, {
        tenantId: run.tenantId,
        humanRequestId: request.humanRequestId,
        response: true,
        at: rejectedAt,
      }),
    ).rejects.toMatchObject({
      code: "workflows.human_request_conflict",
    });
  });

  it("keeps approval-backed Task waiting until canonical Security approval is approved", async () => {
    const { run, lease } = await createRunAndLease("approval_action");
    const requestedAt = requestAt(lease.leasedAt);
    const approvalExpiresAt = toInstant(
      new Date(new Date(requestedAt).getTime() + 30_000),
    );

    const binding = createApprovalBinding({
      operationId: createCanonicalId("operation"),
      tenantId: run.tenantId,
      principal: {
        kind: "user",
        userId: createCanonicalId("user"),
      },
      action: "workflow.consequential_action",
      actionVersion: "v1",
      resourceKey: `task:${lease.taskId}`,
      arguments: {
        taskId: lease.taskId,
      },
      riskClass: "high",
    });
    const approval = createPendingApproval({
      kind: "once",
      binding,
      policyRevision: "policy-1",
      requestedAt,
      expiresAt: approvalExpiresAt,
    });

    await withTransaction(pool, async (client) => {
      await setPolicyRevision(client, run.tenantId, "policy-1");
      await persistPendingApproval(client, approval);
    });

    const request = humanRequest(
      run,
      lease,
      "approval",
      requestedAt,
      approval.approvalId,
    );
    await openWorkflowHumanRequest(pool, {
      request,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
    });

    const checkAt = toInstant(
      new Date(new Date(requestedAt).getTime() + 1_000),
    );
    await expect(
      resolveApprovalWorkflowHumanRequest(pool, {
        tenantId: run.tenantId,
        humanRequestId: request.humanRequestId,
        at: checkAt,
      }),
    ).rejects.toMatchObject({
      code: "workflows.human_request_approval_pending",
      retryable: true,
    });

    const stillWaiting = await pool.query<{ state: string; wait_reason: string }>(
      "SELECT state, wait_reason FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(stillWaiting.rows[0]).toMatchObject({
      state: "waiting",
    });

    await withTransaction(pool, async (client) => {
      await settlePendingApproval(client, {
        tenantId: run.tenantId,
        approvalId: approval.approvalId,
        decision: "approved",
        approverKey: "operator:test",
        decidedAt: checkAt,
      });
    });

    const resolved = await resolveApprovalWorkflowHumanRequest(pool, {
      tenantId: run.tenantId,
      humanRequestId: request.humanRequestId,
      at: checkAt,
    });
    expect(resolved).toMatchObject({
      state: "answered",
      response: true,
      approvalId: approval.approvalId,
    });

    const ready = await pool.query<{ state: string; wait_reason: string | null }>(
      "SELECT state, wait_reason FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(ready.rows[0]).toEqual({
      state: "ready",
      wait_reason: null,
    });
  });

  it("maps denied canonical approval to rejected request and cancelled Task", async () => {
    const { run, lease } = await createRunAndLease("approval_denied");
    const requestedAt = requestAt(lease.leasedAt);
    const expiresAt = toInstant(
      new Date(new Date(requestedAt).getTime() + 30_000),
    );
    const approval = createPendingApproval({
      kind: "once",
      binding: createApprovalBinding({
        operationId: createCanonicalId("operation"),
        tenantId: run.tenantId,
        principal: {
          kind: "user",
          userId: createCanonicalId("user"),
        },
        action: "workflow.denied_action",
        actionVersion: "v1",
        resourceKey: `task:${lease.taskId}`,
        arguments: { taskId: lease.taskId },
        riskClass: "high",
      }),
      policyRevision: "policy-1",
      requestedAt,
      expiresAt,
    });

    await withTransaction(pool, async (client) => {
      await setPolicyRevision(client, run.tenantId, "policy-1");
      await persistPendingApproval(client, approval);
    });

    const request = humanRequest(
      run,
      lease,
      "approval",
      requestedAt,
      approval.approvalId,
    );
    await openWorkflowHumanRequest(pool, {
      request,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
    });

    const decidedAt = toInstant(
      new Date(new Date(requestedAt).getTime() + 1_000),
    );
    await withTransaction(pool, async (client) => {
      await settlePendingApproval(client, {
        tenantId: run.tenantId,
        approvalId: approval.approvalId,
        decision: "denied",
        approverKey: "operator:test",
        decidedAt,
      });
    });

    const rejected = await resolveApprovalWorkflowHumanRequest(pool, {
      tenantId: run.tenantId,
      humanRequestId: request.humanRequestId,
      at: decidedAt,
    });
    expect(rejected).toMatchObject({
      state: "rejected",
      response: false,
    });

    const task = await pool.query<{ state: string; cancellation_reason: string | null }>(
      "SELECT state, cancellation_reason FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(task.rows[0]).toEqual({
      state: "cancelled",
      cancellation_reason: "human_request_rejected",
    });
  });
});

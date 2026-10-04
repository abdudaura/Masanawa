import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type WorkflowId,
} from "@masanawa/contracts";
import {
  admitWorkflowTask,
  bindWorkflowTaskOperation,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  finalizeWorkflowRunControl,
  prepareOperation,
  registerWorkflowCompensationStep,
  requestWorkflowRunControl,
  runMigrations,
  settleWorkflowTaskLease,
  transitionOperation,
  transitionWorkflowCompensationStep,
  withTransaction,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow control acceptance", () => {
  const databaseName =
    `masanawa_workflow_control_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-control-admin",
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
    pool = createPostgresPool({
      connectionString: databaseUrl,
      applicationName: "workflow-control",
      max: 4,
    });

    await runMigrations(pool, [
      {
        owner: "events",
        directory: fileURLToPath(
          new URL("../../packages/events/migrations/", import.meta.url),
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

  async function createRun(workflowId: WorkflowId = createCanonicalId("workflow")) {
    const at = toInstant(new Date("2026-10-04T18:00:00.000Z"));
    const input = {
      tenantId: createCanonicalId("tenant"),
      workflowRunId: createCanonicalId("workflow-run"),
      workflowId,
      workflowVersionId: createCanonicalId("workflow-version"),
      graphSignature: `sha256:${"a".repeat(64)}`,
      initiatedByUserId: createCanonicalId("user"),
      state: "pending" as const,
      revision: 1,
      createdAt: at,
      updatedAt: at,
      startedAt: null,
      terminalAt: null,
      waitReason: null,
      failure: null,
      cancellationReason: null,
    };
    const client = await pool.connect();
    try {
      return await createWorkflowRunRecord(client, input);
    } finally {
      client.release();
    }
  }

  async function admitRootTask(
    run: Awaited<ReturnType<typeof createRun>>,
    nodeKey: string,
  ) {
    const taskId = createCanonicalId("task");
    const at = toInstant(new Date("2026-10-04T18:01:00.000Z"));
    return admitWorkflowTask(pool, {
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
        createdAt: at,
        updatedAt: at,
        startedAt: null,
        terminalAt: null,
        waitReason: null,
        failure: null,
        cancellationReason: null,
      },
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      destination: "workflow.tasks",
      availableAt: at,
    });
  }

  async function prepare(
    tenantId: Awaited<ReturnType<typeof createRun>>["tenantId"],
    suffix: string,
  ) {
    return withTransaction(pool, async (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "test-provider.write",
        idempotencyKey: `control-${suffix}`,
        authorityScopeHash: "scope-hash",
        requestFingerprint: `request-${suffix}`,
        expiresAt: toInstant(new Date("2026-10-05T18:00:00.000Z")),
      }),
    );
  }

  it("cancels unstarted Tasks immediately and blocks all later activation", async () => {
    const run = await createRun();
    const admitted = await admitRootTask(run, "cancel_now");
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));

    const control = await requestWorkflowRunControl(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      controlRequestId: createCanonicalId("request"),
      mode: "cancel",
      reason: "User cancelled workflow.",
      supersededByWorkflowRunId: null,
      compensationRequired: false,
      at,
    });
    expect(control).toMatchObject({
      state: "cancelled",
      mode: "cancel",
      compensationState: "none",
    });

    const rows = await pool.query<{
      run_state: string;
      task_state: string;
    }>(
      `SELECT r.state AS run_state, t.state AS task_state
         FROM workflows.workflow_runs AS r
         JOIN workflows.tasks AS t
           ON t.tenant_id = r.tenant_id
          AND t.workflow_run_id = r.workflow_run_id
        WHERE r.tenant_id = $1
          AND r.workflow_run_id = $2
          AND t.task_id = $3`,
      [run.tenantId, run.workflowRunId, admitted.task.taskId],
    );
    expect(rows.rows[0]).toEqual({
      run_state: "cancelled",
      task_state: "cancelled",
    });

    await expect(
      admitRootTask(run, "late_task"),
    ).rejects.toBeDefined();
  });

  it("does not rewrite a currently leased Task and finalizes only after it settles", async () => {
    const run = await createRun();
    const admitted = await admitRootTask(run, "running_effect");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(lease?.taskId).toBe(admitted.task.taskId);

    const controlAt = toInstant(
      new Date(new Date(lease!.leasedAt).getTime() + 500),
    );
    const control = await requestWorkflowRunControl(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      controlRequestId: createCanonicalId("request"),
      mode: "cancel",
      reason: "Stop remaining workflow work.",
      supersededByWorkflowRunId: null,
      compensationRequired: false,
      at: controlAt,
    });
    expect(control.state).toBe("cancel-requested");

    const stillRunning = await pool.query<{
      state: string;
      lease_owner: string | null;
      lease_fence: string;
    }>(
      "SELECT state, lease_owner, lease_fence::text FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease!.taskId],
    );
    expect(stillRunning.rows[0]).toEqual({
      state: "running",
      lease_owner: "worker-a",
      lease_fence: String(lease!.leaseFence),
    });

    await expect(admitRootTask(run, "blocked_late_task")).rejects.toBeDefined();

    const settleAt = toInstant(
      new Date(new Date(controlAt).getTime() + 500),
    );
    const client = await pool.connect();
    try {
      await settleWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: lease!.taskId,
        workerId: lease!.leaseOwner,
        leaseFence: lease!.leaseFence,
        settlement: { state: "completed" },
        at: settleAt,
      });
    } finally {
      client.release();
    }

    const finalized = await finalizeWorkflowRunControl(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      at: toInstant(new Date(new Date(settleAt).getTime() + 500)),
    });
    expect(finalized.state).toBe("cancelled");

    const completedTask = await pool.query<{ state: string }>(
      "SELECT state FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease!.taskId],
    );
    expect(completedTask.rows[0]!.state).toBe("completed");
  });

  it("records supersession only to a real successor of the same Workflow", async () => {
    const workflowId = createCanonicalId("workflow");
    const original = await createRun(workflowId);
    const successorInput = {
      ...original,
      workflowRunId: createCanonicalId("workflow-run"),
      workflowVersionId: createCanonicalId("workflow-version"),
    };
    const client = await pool.connect();
    let successor;
    try {
      successor = await createWorkflowRunRecord(client, successorInput);
    } finally {
      client.release();
    }

    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const control = await requestWorkflowRunControl(pool, {
      tenantId: original.tenantId,
      workflowRunId: original.workflowRunId,
      controlRequestId: createCanonicalId("request"),
      mode: "supersede",
      reason: "Replace with corrected WorkflowVersion.",
      supersededByWorkflowRunId: successor.workflowRunId,
      compensationRequired: false,
      at,
    });
    expect(control).toMatchObject({
      state: "superseded",
      supersededByWorkflowRunId: successor.workflowRunId,
    });

    const other = await createRun();
    const invalidSuccessorInput = {
      ...other,
      tenantId: original.tenantId,
      workflowRunId: createCanonicalId("workflow-run"),
    };
    const secondClient = await pool.connect();
    let invalidSuccessor;
    try {
      invalidSuccessor = await createWorkflowRunRecord(
        secondClient,
        invalidSuccessorInput,
      );
    } finally {
      secondClient.release();
    }

    const freshOriginal = await createRun(workflowId);
    await expect(
      requestWorkflowRunControl(pool, {
        tenantId: freshOriginal.tenantId,
        workflowRunId: freshOriginal.workflowRunId,
        controlRequestId: createCanonicalId("request"),
        mode: "supersede",
        reason: "Invalid successor.",
        supersededByWorkflowRunId: invalidSuccessor.workflowRunId,
        compensationRequired: false,
        at,
      }),
    ).rejects.toMatchObject({
      code: "workflows.supersession_target_invalid",
    });
  });

  it("records compensation as new canonical Operation work without mutating original history", async () => {
    const run = await createRun();
    const admitted = await admitRootTask(run, "compensation");
    const original = await prepare(run.tenantId, randomUUID());
    const compensation = await prepare(run.tenantId, randomUUID());

    await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: admitted.task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId: original.operation.operationId,
      boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });
    await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: admitted.task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "compensation",
      operationId: compensation.operation.operationId,
      boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });

    await withTransaction(pool, async (client) => {
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: original.operation.operationId,
        from: "prepared",
        to: "authorized",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: original.operation.operationId,
        from: "authorized",
        to: "dispatching",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: original.operation.operationId,
        from: "dispatching",
        to: "dispatched",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: original.operation.operationId,
        from: "dispatched",
        to: "accepted",
      });
    });

    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const control = await requestWorkflowRunControl(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      controlRequestId: createCanonicalId("request"),
      mode: "cancel",
      reason: "Cancel and compensate accepted external effect.",
      supersededByWorkflowRunId: null,
      compensationRequired: true,
      at,
    });
    expect(control.compensationState).toBe("required");

    const step = await registerWorkflowCompensationStep(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      originalOperationId: original.operation.operationId,
      compensationOperationId: compensation.operation.operationId,
      reason: "Reverse accepted provider effect.",
      at,
    });
    expect(step.state).toBe("planned");

    await transitionWorkflowCompensationStep(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      originalOperationId: original.operation.operationId,
      from: "planned",
      to: "running",
      at: toInstant(new Date("2026-10-04T18:03:00.000Z")),
    });

    await expect(
      transitionWorkflowCompensationStep(pool, {
        tenantId: run.tenantId,
        workflowRunId: run.workflowRunId,
        originalOperationId: original.operation.operationId,
        from: "running",
        to: "succeeded",
        at: toInstant(new Date("2026-10-04T18:03:30.000Z")),
      }),
    ).rejects.toMatchObject({
      code: "workflows.compensation_operation_not_succeeded",
    });

    await withTransaction(pool, async (client) => {
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: compensation.operation.operationId,
        from: "prepared",
        to: "authorized",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: compensation.operation.operationId,
        from: "authorized",
        to: "dispatching",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: compensation.operation.operationId,
        from: "dispatching",
        to: "dispatched",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: compensation.operation.operationId,
        from: "dispatched",
        to: "accepted",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId: compensation.operation.operationId,
        from: "accepted",
        to: "succeeded",
      });
    });

    await transitionWorkflowCompensationStep(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      originalOperationId: original.operation.operationId,
      from: "running",
      to: "succeeded",
      at: toInstant(new Date("2026-10-04T18:04:00.000Z")),
    });

    const result = await pool.query<{
      compensation_state: string;
      original_state: string;
      compensation_state_operation: string;
    }>(
      `SELECT c.compensation_state,
              original.state AS original_state,
              compensation.state AS compensation_state_operation
         FROM workflows.workflow_run_controls AS c
         JOIN events.operations AS original
           ON original.operation_id = $3
         JOIN events.operations AS compensation
           ON compensation.operation_id = $4
        WHERE c.tenant_id = $1
          AND c.workflow_run_id = $2`,
      [
        run.tenantId,
        run.workflowRunId,
        original.operation.operationId,
        compensation.operation.operationId,
      ],
    );
    expect(result.rows[0]).toEqual({
      compensation_state: "compensated",
      original_state: "accepted",
      compensation_state_operation: "succeeded",
    });
  });
});

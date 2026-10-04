import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  admitWorkflowTask,
  beginReconciliation,
  bindWorkflowTaskOperation,
  createPostgresPool,
  createWorkflowRunRecord,
  loadWorkflowTaskOperationTruth,
  prepareOperation,
  recordExternalReceipt,
  runMigrations,
  transitionOperation,
  transitionReconciliationCase,
  withTransaction,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow Operation truth acceptance", () => {
  const databaseName =
    `masanawa_workflow_operation_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-operation-truth-admin",
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
      applicationName: "workflow-operation-truth",
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

  async function createTask(tenantId = createCanonicalId("tenant")) {
    const at = toInstant(new Date("2026-10-04T18:00:00.000Z"));
    const runInput = {
      tenantId,
      workflowRunId: createCanonicalId("workflow-run"),
      workflowId: createCanonicalId("workflow"),
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
    let run;
    try {
      run = await createWorkflowRunRecord(client, runInput);
    } finally {
      client.release();
    }

    const taskId = createCanonicalId("task");
    const admitted = await admitWorkflowTask(pool, {
      task: {
        tenantId,
        taskId,
        workflowRunId: run.workflowRunId,
        workflowVersionId: run.workflowVersionId,
        graphSignature: run.graphSignature,
        nodeKey: "side_effect",
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

    return { run, task: admitted.task };
  }

  async function prepare(tenantId: ReturnType<typeof createCanonicalId<"tenant">>, suffix: string) {
    return withTransaction(pool, async (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "test-provider.write",
        idempotencyKey: `workflow-op-${suffix}`,
        authorityScopeHash: "scope-hash",
        requestFingerprint: `request-${suffix}`,
        expiresAt: toInstant(new Date("2026-10-05T18:00:00.000Z")),
      }),
    );
  }

  it("binds one canonical Operation role and replays despite changed audit timestamp", async () => {
    const { run, task } = await createTask();
    const prepared = await prepare(run.tenantId, randomUUID());
    const first = await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId: prepared.operation.operationId,
      boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });

    const replay = await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId: prepared.operation.operationId,
      boundAt: toInstant(new Date("2026-10-04T18:02:00.000Z")),
    });
    expect(replay).toEqual(first);

    const truth = await loadWorkflowTaskOperationTruth(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      role: "primary",
    });
    expect(truth).toMatchObject({
      operationState: "prepared",
      reconciliationStatus: null,
      receiptIds: [],
    });
  });

  it("rejects a changed Operation under an already-bound Task role", async () => {
    const { run, task } = await createTask();
    const first = await prepare(run.tenantId, randomUUID());
    const second = await prepare(run.tenantId, randomUUID());
    const at = toInstant(new Date("2026-10-04T18:01:00.000Z"));

    await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId: first.operation.operationId,
      boundAt: at,
    });

    await expect(
      bindWorkflowTaskOperation(pool, {
        tenantId: run.tenantId,
        taskId: task.taskId,
        workflowRunId: run.workflowRunId,
        workflowVersionId: run.workflowVersionId,
        graphSignature: run.graphSignature,
        role: "primary",
        operationId: second.operation.operationId,
        boundAt: at,
      }),
    ).rejects.toMatchObject({
      code: "workflows.operation_binding_conflict",
      category: "conflict",
      retryable: false,
    });
  });

  it("projects live terminal Operation state and references canonical receipts only", async () => {
    const { run, task } = await createTask();
    const prepared = await prepare(run.tenantId, randomUUID());
    const operationId = prepared.operation.operationId;
    await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId,
      boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });

    const receipt = await withTransaction(pool, async (client) =>
      recordExternalReceipt(client, {
        tenantId: run.tenantId,
        operationId,
        provider: "test-provider",
        observationKey: `obs-${randomUUID()}`,
        providerReference: "provider-ref-1",
        normalizedStatus: "accepted",
        observedAt: toInstant(new Date("2026-10-04T18:02:00.000Z")),
        verificationMethod: "provider-response",
        providerVersion: "v1",
      }),
    );

    await withTransaction(pool, async (client) => {
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "prepared",
        to: "authorized",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "authorized",
        to: "dispatching",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "dispatching",
        to: "dispatched",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "dispatched",
        to: "accepted",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "accepted",
        to: "succeeded",
      });
    });

    const truth = await loadWorkflowTaskOperationTruth(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      role: "primary",
    });
    expect(truth.operationState).toBe("succeeded");
    expect(truth.receiptIds).toEqual([receipt.receipt.externalReceiptId]);
  });

  it("projects ambiguous Operation through canonical reconciliation and needs-attention", async () => {
    const { run, task } = await createTask();
    const prepared = await prepare(run.tenantId, randomUUID());
    const operationId = prepared.operation.operationId;
    await bindWorkflowTaskOperation(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      role: "primary",
      operationId,
      boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });

    await withTransaction(pool, async (client) => {
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "prepared",
        to: "authorized",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "authorized",
        to: "dispatching",
      });
      await transitionOperation(client, {
        tenantId: run.tenantId,
        operationId,
        from: "dispatching",
        to: "unknown",
      });
    });

    const opened = await beginReconciliation(pool, {
      tenantId: run.tenantId,
      operationId,
      reasonCode: "provider.outcome_unknown",
      safeRetry: false,
      nextAction: "check_provider_reference",
    });

    let truth = await loadWorkflowTaskOperationTruth(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      role: "primary",
    });
    expect(truth).toMatchObject({
      operationState: "reconciling",
      reconciliationStatus: "open",
    });

    await withTransaction(pool, async (client) => {
      await transitionReconciliationCase(client, {
        tenantId: run.tenantId,
        reconciliationCaseId:
          opened.reconciliationCase.reconciliationCaseId,
        from: "open",
        to: "needs-attention",
        safeRetry: false,
        nextAction: "operator_review",
      });
    });

    truth = await loadWorkflowTaskOperationTruth(pool, {
      tenantId: run.tenantId,
      taskId: task.taskId,
      role: "primary",
    });
    expect(truth.reconciliationStatus).toBe("needs-attention");
  });

  it("rejects cross-Tenant Operation binding", async () => {
    const first = await createTask();
    const secondTenant = createCanonicalId("tenant");
    const foreignOperation = await prepare(secondTenant, randomUUID());

    await expect(
      bindWorkflowTaskOperation(pool, {
        tenantId: first.run.tenantId,
        taskId: first.task.taskId,
        workflowRunId: first.run.workflowRunId,
        workflowVersionId: first.run.workflowVersionId,
        graphSignature: first.run.graphSignature,
        role: "primary",
        operationId: foreignOperation.operation.operationId,
        boundAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
      }),
    ).rejects.toMatchObject({
      code: "workflows.operation_tenant_mismatch",
      category: "authorization",
      retryable: false,
    });
  });
});

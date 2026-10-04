import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type EventId,
} from "@masanawa/contracts";
import {
  admitWorkflowTask,
  createPostgresPool,
  createWorkflowRunRecord,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow task admission acceptance", () => {
  const databaseName =
    `masanawa_workflow_admission_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-task-admission-admin",
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
      applicationName: `workflow-task-admission-${label}`,
      max: 3,
    });
  }

  async function createRun() {
    const at = toInstant(new Date("2026-10-04T18:00:00.000Z"));
    const run = {
      tenantId: createCanonicalId("tenant"),
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
    try {
      return await createWorkflowRunRecord(client, run);
    } finally {
      client.release();
    }
  }

  function rootTask(
    run: Awaited<ReturnType<typeof createRun>>,
    requestId = createCanonicalId("request"),
  ) {
    const taskId = createCanonicalId("task");
    const at = toInstant(new Date("2026-10-04T18:01:00.000Z"));
    return {
      tenantId: run.tenantId,
      taskId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      nodeKey: "start",
      lineage: {
        parentTaskId: null,
        rootTaskId: taskId,
        depth: 0,
      },
      state: "ready" as const,
      revision: 1,
      admissionRequestId: requestId,
      createdAt: at,
      updatedAt: at,
      startedAt: null,
      terminalAt: null,
      waitReason: null,
      failure: null,
      cancellationReason: null,
    };
  }

  function admissionInput(
    task: ReturnType<typeof rootTask>,
    correlationId = createCanonicalId("correlation"),
  ) {
    return {
      task,
      correlationId,
      causationId: null,
      destination: "workflow.tasks",
      availableAt: task.createdAt,
    };
  }

  it("commits one Task and one canonical outbox record atomically", async () => {
    const run = await createRun();
    const task = rootTask(run);
    const result = await admitWorkflowTask(pool, admissionInput(task));

    expect(result.task).toMatchObject({
      taskId: task.taskId,
      workflowRunId: run.workflowRunId,
      state: "ready",
      revision: 1,
      admissionRequestId: task.admissionRequestId,
    });

    const taskRows = await pool.query(
      "SELECT task_id FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, task.taskId],
    );
    expect(taskRows.rowCount).toBe(1);

    const outboxRows = await pool.query<{
      outbox_event_id: string;
      aggregate_id: string;
      event_type: string;
      state: string;
      payload: {
        taskId: string;
        workflowRunId: string;
        admissionRequestId: string;
      };
    }>(
      `SELECT outbox_event_id, aggregate_id, event_type, state, payload
         FROM events.outbox
        WHERE outbox_event_id = $1`,
      [result.outboxEventId],
    );
    expect(outboxRows.rows[0]).toMatchObject({
      aggregate_id: task.taskId,
      event_type: "workflow.task.ready.v1",
      state: "pending",
      payload: {
        taskId: task.taskId,
        workflowRunId: run.workflowRunId,
        admissionRequestId: task.admissionRequestId,
      },
    });
  });

  it("reconciles exact replay to the same Task and outbox identity", async () => {
    const run = await createRun();
    const task = rootTask(run);
    const input = admissionInput(task);
    const first = await admitWorkflowTask(pool, input);
    const second = await admitWorkflowTask(pool, input);

    expect(second.task).toEqual(first.task);
    expect(second.outboxEventId).toBe(first.outboxEventId);

    const counts = await pool.query<{ tasks: string; outbox: string }>(
      `SELECT
         (SELECT count(*)::text FROM workflows.tasks
           WHERE tenant_id = $1 AND admission_request_id = $2) AS tasks,
         (SELECT count(*)::text FROM events.outbox
           WHERE tenant_id = $1
             AND aggregate_type = 'workflow-task'
             AND aggregate_id = $3
             AND event_type = 'workflow.task.ready.v1') AS outbox`,
      [run.tenantId, task.admissionRequestId, task.taskId],
    );
    expect(counts.rows[0]).toEqual({ tasks: "1", outbox: "1" });
  });

  it("rejects request reuse for changed Task identity or payload", async () => {
    const run = await createRun();
    const requestId = createCanonicalId("request");
    const original = rootTask(run, requestId);
    const input = admissionInput(original);
    await admitWorkflowTask(pool, input);

    const changedTaskId = rootTask(run, requestId);
    await expect(
      admitWorkflowTask(pool, {
        ...input,
        task: changedTaskId,
      }),
    ).rejects.toMatchObject({
      code: "workflows.task_admission_conflict",
      category: "conflict",
      retryable: false,
    });

    await expect(
      admitWorkflowTask(pool, {
        ...input,
        destination: "workflow.other",
      }),
    ).rejects.toMatchObject({
      code: "workflows.task_admission_conflict",
      category: "conflict",
      retryable: false,
    });
  });

  it("admits exactly one durable Task/outbox pair under concurrent exact replay", async () => {
    const run = await createRun();
    const task = rootTask(run);
    const input = admissionInput(task);
    const poolA = openPool("race-a");
    const poolB = openPool("race-b");

    try {
      const [a, b] = await Promise.all([
        admitWorkflowTask(poolA, input),
        admitWorkflowTask(poolB, input),
      ]);
      expect(a.task).toEqual(b.task);
      expect(a.outboxEventId).toBe(b.outboxEventId);

      const counts = await pool.query<{ tasks: string; outbox: string }>(
        `SELECT
           (SELECT count(*)::text FROM workflows.tasks
             WHERE tenant_id = $1 AND admission_request_id = $2) AS tasks,
           (SELECT count(*)::text FROM events.outbox
             WHERE tenant_id = $1
               AND aggregate_type = 'workflow-task'
               AND aggregate_id = $3
               AND event_type = 'workflow.task.ready.v1') AS outbox`,
        [run.tenantId, task.admissionRequestId, task.taskId],
      );
      expect(counts.rows[0]).toEqual({ tasks: "1", outbox: "1" });
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });

  it("rolls back the Task when outbox insertion fails after Task insert", async () => {
    const run = await createRun();
    const task = rootTask(run);
    const invalidCausationId = "invalid" as EventId;

    await expect(
      admitWorkflowTask(pool, {
        ...admissionInput(task),
        causationId: invalidCausationId,
      }),
    ).rejects.toBeDefined();

    const taskRows = await pool.query(
      "SELECT task_id FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, task.taskId],
    );
    expect(taskRows.rowCount).toBe(0);

    const outboxRows = await pool.query(
      `SELECT outbox_event_id
         FROM events.outbox
        WHERE tenant_id = $1
          AND aggregate_type = 'workflow-task'
          AND aggregate_id = $2`,
      [run.tenantId, task.taskId],
    );
    expect(outboxRows.rowCount).toBe(0);
  });

  it("rejects admission of anything except a fresh ready Task", async () => {
    const run = await createRun();
    const task = rootTask(run);

    await expect(
      admitWorkflowTask(pool, {
        ...admissionInput(task),
        task: {
          ...task,
          state: "running",
          revision: 2,
          startedAt: task.createdAt,
        },
      }),
    ).rejects.toThrow(/fresh ready Task at revision 1/u);
  });

  it("reconciles exact WorkflowRun replay and rejects changed durable state", async () => {
    const run = await createRun();
    const client = await pool.connect();
    try {
      await expect(createWorkflowRunRecord(client, run)).resolves.toEqual(run);

      await expect(
        createWorkflowRunRecord(client, {
          ...run,
          graphSignature: `sha256:${"b".repeat(64)}`,
        }),
      ).rejects.toMatchObject({
        code: "workflows.run_conflict",
        category: "conflict",
        retryable: false,
      });
    } finally {
      client.release();
    }
  });

  it("rejects a Task pinned to a different WorkflowVersion graph than its Run", async () => {
    const run = await createRun();
    const task = {
      ...rootTask(run),
      graphSignature: `sha256:${"b".repeat(64)}`,
    };

    await expect(
      admitWorkflowTask(pool, admissionInput(task)),
    ).rejects.toBeDefined();

    const count = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, task.taskId],
    );
    expect(count.rows[0]!.count).toBe("0");
  });

  it("enforces persisted parent/root/depth lineage for child Task admission", async () => {
    const run = await createRun();
    const root = rootTask(run);
    await admitWorkflowTask(pool, admissionInput(root));

    const childId = createCanonicalId("task");
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const child = {
      ...rootTask(run),
      taskId: childId,
      nodeKey: "child",
      lineage: {
        parentTaskId: root.taskId,
        rootTaskId: root.taskId,
        depth: 1,
      },
      createdAt: at,
      updatedAt: at,
    };
    const admitted = await admitWorkflowTask(
      pool,
      admissionInput(child, createCanonicalId("correlation")),
    );
    expect(admitted.task.lineage).toEqual({
      parentTaskId: root.taskId,
      rootTaskId: root.taskId,
      depth: 1,
    });

    const badChildId = createCanonicalId("task");
    const bad = {
      ...rootTask(run),
      taskId: badChildId,
      nodeKey: "bad_child",
      lineage: {
        parentTaskId: root.taskId,
        rootTaskId: root.taskId,
        depth: 2,
      },
      createdAt: at,
      updatedAt: at,
    };
    await expect(
      admitWorkflowTask(
        pool,
        admissionInput(bad, createCanonicalId("correlation")),
      ),
    ).rejects.toBeDefined();

    const count = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, bad.taskId],
    );
    expect(count.rows[0]!.count).toBe("0");
  });

});

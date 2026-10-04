import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  admitWorkflowTask,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  runMigrations,
  settleWorkflowTaskLease,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow Task leasing acceptance", () => {
  const databaseName =
    `masanawa_workflow_leasing_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-task-leasing-admin",
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
      applicationName: `workflow-task-leasing-${label}`,
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

  it("atomically checks out ready Tasks with lease owner, expiry and fence", async () => {
    const run = await createRun();
    const first = await admitRootTask(run, "first");
    const second = await admitRootTask(run, "second");

    const leased = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 2,
      leaseMs: 60_000,
    });

    expect(leased).toHaveLength(2);
    expect(new Set(leased.map((task) => task.taskId))).toEqual(
      new Set([first.task.taskId, second.task.taskId]),
    );
    for (const task of leased) {
      expect(task).toMatchObject({
        state: "running",
        revision: 2,
        leaseOwner: "worker-a",
        leaseFence: 1,
      });
      expect(task.leaseExpiresAt > task.leasedAt).toBe(true);
    }

    const none = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-b",
      limit: 2,
      leaseMs: 60_000,
    });
    expect(none).toEqual([]);
  });

  it("uses SKIP LOCKED so concurrent workers never receive the same ready Task", async () => {
    const run = await createRun();
    await admitRootTask(run, "first");
    await admitRootTask(run, "second");

    const poolA = openPool("checkout-a");
    const poolB = openPool("checkout-b");
    try {
      const [a, b] = await Promise.all([
        checkoutWorkflowTasks(poolA, {
          tenantId: run.tenantId,
          workerId: "worker-a",
          limit: 1,
          leaseMs: 60_000,
        }),
        checkoutWorkflowTasks(poolB, {
          tenantId: run.tenantId,
          workerId: "worker-b",
          limit: 1,
          leaseMs: 60_000,
        }),
      ]);

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0]!.taskId).not.toBe(b[0]!.taskId);
      expect(a[0]!.leaseFence).toBe(1);
      expect(b[0]!.leaseFence).toBe(1);
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });

  it("settles only with the current owner, fence and unexpired lease", async () => {
    const run = await createRun();
    const admitted = await admitRootTask(run, "settle");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(lease?.taskId).toBe(admitted.task.taskId);

    const client = await pool.connect();
    try {
      await expect(
        settleWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-b",
          leaseFence: lease!.leaseFence,
          settlement: { state: "completed" },
          at: toInstant(new Date("2026-10-04T18:01:30.000Z")),
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
        category: "conflict",
        retryable: false,
      });

      await expect(
        settleWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-a",
          leaseFence: lease!.leaseFence + 1,
          settlement: { state: "completed" },
          at: toInstant(new Date("2026-10-04T18:01:30.000Z")),
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
      });

      await settleWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: lease!.taskId,
        workerId: "worker-a",
        leaseFence: lease!.leaseFence,
        settlement: { state: "completed" },
        at: toInstant(new Date("2026-10-04T18:01:30.000Z")),
      });
    } finally {
      client.release();
    }

    const row = await pool.query<{
      state: string;
      revision: string;
      lease_owner: string | null;
      lease_fence: string;
      lease_expires_at: Date | null;
      terminal_at: Date | null;
    }>(
      `SELECT state, revision::text, lease_owner, lease_fence::text,
              lease_expires_at, terminal_at
         FROM workflows.tasks
        WHERE tenant_id = $1 AND task_id = $2`,
      [run.tenantId, admitted.task.taskId],
    );
    expect(row.rows[0]).toMatchObject({
      state: "completed",
      revision: "3",
      lease_owner: null,
      lease_fence: "1",
      lease_expires_at: null,
    });
    expect(row.rows[0]!.terminal_at).not.toBeNull();
  });

  it("rejects settlement after lease expiry", async () => {
    const run = await createRun();
    await admitRootTask(run, "expiry");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 1_000,
    });

    const afterExpiry = toInstant(
      new Date(new Date(lease!.leaseExpiresAt).getTime() + 1_000),
    );

    const client = await pool.connect();
    try {
      await expect(
        settleWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-a",
          leaseFence: lease!.leaseFence,
          settlement: { state: "completed" },
          at: afterExpiry,
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
      });
    } finally {
      client.release();
    }

    const row = await pool.query<{ state: string; lease_owner: string | null }>(
      "SELECT state, lease_owner FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease!.taskId],
    );
    expect(row.rows[0]).toEqual({
      state: "running",
      lease_owner: "worker-a",
    });
  });

  it("settles failure and waiting with state-specific metadata and clears lease custody", async () => {
    const run = await createRun();
    const failedAdmission = await admitRootTask(run, "failed");
    const waitingAdmission = await admitRootTask(run, "waiting");

    const leases = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 2,
      leaseMs: 60_000,
    });
    const failedLease = leases.find(
      (lease) => lease.taskId === failedAdmission.task.taskId,
    )!;
    const waitingLease = leases.find(
      (lease) => lease.taskId === waitingAdmission.task.taskId,
    )!;

    const client = await pool.connect();
    try {
      await settleWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: failedLease.taskId,
        workerId: "worker-a",
        leaseFence: failedLease.leaseFence,
        settlement: {
          state: "failed",
          failure: {
            code: "executor.failed",
            message: "Executor reported failure.",
          },
        },
        at: toInstant(new Date("2026-10-04T18:01:30.000Z")),
      });

      await settleWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: waitingLease.taskId,
        workerId: "worker-a",
        leaseFence: waitingLease.leaseFence,
        settlement: {
          state: "waiting",
          waitReason: "awaiting_dependency",
        },
        at: toInstant(new Date("2026-10-04T18:01:30.000Z")),
      });
    } finally {
      client.release();
    }

    const rows = await pool.query<{
      task_id: string;
      state: string;
      failure_code: string | null;
      wait_reason: string | null;
      lease_owner: string | null;
    }>(
      `SELECT task_id, state, failure_code, wait_reason, lease_owner
         FROM workflows.tasks
        WHERE tenant_id = $1
          AND task_id = ANY($2::text[])
        ORDER BY task_id`,
      [run.tenantId, [failedLease.taskId, waitingLease.taskId]],
    );
    const byId = new Map(rows.rows.map((row) => [row.task_id, row]));
    expect(byId.get(failedLease.taskId)).toMatchObject({
      state: "failed",
      failure_code: "executor.failed",
      wait_reason: null,
      lease_owner: null,
    });
    expect(byId.get(waitingLease.taskId)).toMatchObject({
      state: "waiting",
      failure_code: null,
      wait_reason: "awaiting_dependency",
      lease_owner: null,
    });
  });
});

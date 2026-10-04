import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  adoptExpiredWorkflowTasks,
  admitWorkflowTask,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  heartbeatWorkflowTaskLease,
  runMigrations,
  settleWorkflowTaskLease,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow Task recovery acceptance", () => {
  const databaseName =
    `masanawa_workflow_recovery_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-task-recovery-admin",
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
      applicationName: `workflow-task-recovery-${label}`,
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

  async function admitTask(
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

  async function expireLease() {
    await pool.query("SELECT pg_sleep(0.02)");
  }

  it("heartbeats only the current unexpired owner/fence and extends expiry", async () => {
    const run = await createRun();
    await admitTask(run, "heartbeat");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 60_000,
    });

    const client = await pool.connect();
    try {
      const heartbeat = await heartbeatWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: lease!.taskId,
        workerId: "worker-a",
        leaseFence: lease!.leaseFence,
        leaseMs: 120_000,
      });
      expect(heartbeat.heartbeatAt >= lease!.leasedAt).toBe(true);
      expect(heartbeat.leaseExpiresAt > lease!.leaseExpiresAt).toBe(true);

      await expect(
        heartbeatWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-b",
          leaseFence: lease!.leaseFence,
          leaseMs: 60_000,
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
        category: "conflict",
        retryable: false,
      });

      await expect(
        heartbeatWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-a",
          leaseFence: lease!.leaseFence + 1,
          leaseMs: 60_000,
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
      });
    } finally {
      client.release();
    }

    const row = await pool.query<{
      lease_fence: string;
      revision: string;
      heartbeat_at: Date | null;
    }>(
      "SELECT lease_fence::text, revision::text, heartbeat_at FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease!.taskId],
    );
    expect(row.rows[0]).toMatchObject({
      lease_fence: "1",
      revision: "2",
    });
    expect(row.rows[0]!.heartbeat_at).not.toBeNull();
  });

  it("rejects heartbeat after the lease has expired", async () => {
    const run = await createRun();
    await admitTask(run, "expired_heartbeat");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 1,
    });
    await expireLease();

    const client = await pool.connect();
    try {
      await expect(
        heartbeatWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: lease!.taskId,
          workerId: "worker-a",
          leaseFence: lease!.leaseFence,
          leaseMs: 60_000,
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
      });
    } finally {
      client.release();
    }
  });

  it("adopts an expired running Task, increments fence/recovery count and preserves start", async () => {
    const run = await createRun();
    await admitTask(run, "recover");
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 1,
    });

    const before = await pool.query<{ started_at: Date; revision: string }>(
      "SELECT started_at, revision::text FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease!.taskId],
    );
    await expireLease();

    const adopted = await adoptExpiredWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-b",
      limit: 1,
      leaseMs: 60_000,
    });

    expect(adopted).toHaveLength(1);
    expect(adopted[0]).toMatchObject({
      taskId: lease!.taskId,
      leaseOwner: "worker-b",
      leaseFence: lease!.leaseFence + 1,
      adoptionCount: 1,
      revision: Number(before.rows[0]!.revision) + 1,
    });
    expect(adopted[0]!.startedAt).toBe(toInstant(before.rows[0]!.started_at));
  });

  it("invalidates the crashed worker fence after adoption and lets the adopter settle", async () => {
    const run = await createRun();
    await admitTask(run, "fence_takeover");
    const [oldLease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-old",
      limit: 1,
      leaseMs: 1,
    });
    await expireLease();

    const [adopted] = await adoptExpiredWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-new",
      limit: 1,
      leaseMs: 60_000,
    });
    const settleAt = toInstant(
      new Date(new Date(adopted!.leasedAt).getTime() + 500),
    );

    const client = await pool.connect();
    try {
      await expect(
        settleWorkflowTaskLease(client, {
          tenantId: run.tenantId,
          taskId: adopted!.taskId,
          workerId: "worker-old",
          leaseFence: oldLease!.leaseFence,
          settlement: { state: "completed" },
          at: settleAt,
        }),
      ).rejects.toMatchObject({
        code: "workflows.task_stale_lease",
      });

      await settleWorkflowTaskLease(client, {
        tenantId: run.tenantId,
        taskId: adopted!.taskId,
        workerId: "worker-new",
        leaseFence: adopted!.leaseFence,
        settlement: { state: "completed" },
        at: settleAt,
      });
    } finally {
      client.release();
    }

    const row = await pool.query<{
      state: string;
      lease_owner: string | null;
      lease_fence: string;
      adoption_count: string;
    }>(
      "SELECT state, lease_owner, lease_fence::text, adoption_count::text FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, adopted!.taskId],
    );
    expect(row.rows[0]).toEqual({
      state: "completed",
      lease_owner: null,
      lease_fence: String(adopted!.leaseFence),
      adoption_count: "1",
    });
  });

  it("uses SKIP LOCKED so concurrent recovery workers adopt different stale Tasks", async () => {
    const run = await createRun();
    await admitTask(run, "stale_a");
    await admitTask(run, "stale_b");
    await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-old",
      limit: 2,
      leaseMs: 1,
    });
    await expireLease();

    const poolA = openPool("recover-a");
    const poolB = openPool("recover-b");
    try {
      const [a, b] = await Promise.all([
        adoptExpiredWorkflowTasks(poolA, {
          tenantId: run.tenantId,
          workerId: "worker-a",
          limit: 1,
          leaseMs: 60_000,
        }),
        adoptExpiredWorkflowTasks(poolB, {
          tenantId: run.tenantId,
          workerId: "worker-b",
          limit: 1,
          leaseMs: 60_000,
        }),
      ]);

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0]!.taskId).not.toBe(b[0]!.taskId);
      expect(a[0]!.leaseFence).toBe(2);
      expect(b[0]!.leaseFence).toBe(2);
      expect(a[0]!.adoptionCount).toBe(1);
      expect(b[0]!.adoptionCount).toBe(1);
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
});

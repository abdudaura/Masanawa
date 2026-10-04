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
  readWorkflowTaskRetryState,
  recordWorkflowTaskFailure,
  releaseDueWorkflowTaskRetries,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow Task retry acceptance", () => {
  const databaseName =
    `masanawa_workflow_retries_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-task-retries-admin",
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
      applicationName: `workflow-task-retries-${label}`,
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

  async function checkoutOne(
    run: Awaited<ReturnType<typeof createRun>>,
    workerId: string,
  ) {
    const [lease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId,
      limit: 1,
      leaseMs: 60_000,
    });
    expect(lease).toBeDefined();
    return lease!;
  }

  function afterLease(leasedAt: string, offsetMs = 500) {
    return toInstant(new Date(new Date(leasedAt).getTime() + offsetMs));
  }

  it("schedules retry, releases it when due, and increments fence on re-checkout", async () => {
    const run = await createRun();
    const admitted = await admitTask(run, "retry_me");
    const firstLease = await checkoutOne(run, "worker-a");
    expect(firstLease.taskId).toBe(admitted.task.taskId);

    const failureAt = afterLease(firstLease.leasedAt);
    const retry = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: firstLease.taskId,
      workerId: "worker-a",
      leaseFence: firstLease.leaseFence,
      at: failureAt,
      safeErrorCode: "provider.timeout",
      safeErrorMessage: "Temporary timeout.",
      disposition: {
        kind: "retry-scheduled",
        failureCount: 1,
        delayMs: 1,
        reasonCode: "provider.timeout",
      },
    });

    expect(retry).toMatchObject({
      failureCount: 1,
      disposition: "retry-scheduled",
      reasonCode: "provider.timeout",
    });
    expect(retry.nextAttemptAt).not.toBeNull();

    const waiting = await pool.query<{
      state: string;
      revision: string;
      wait_reason: string | null;
      lease_owner: string | null;
      lease_fence: string;
    }>(
      `SELECT state, revision::text, wait_reason, lease_owner, lease_fence::text
         FROM workflows.tasks
        WHERE tenant_id = $1 AND task_id = $2`,
      [run.tenantId, firstLease.taskId],
    );
    expect(waiting.rows[0]).toEqual({
      state: "waiting",
      revision: "3",
      wait_reason: "retry_backoff",
      lease_owner: null,
      lease_fence: "1",
    });

    await pool.query("SELECT pg_sleep(0.02)");
    const released = await releaseDueWorkflowTaskRetries(pool, {
      tenantId: run.tenantId,
      limit: 10,
    });
    expect(released).toEqual([firstLease.taskId]);

    const retryState = await readWorkflowTaskRetryState(pool, {
      tenantId: run.tenantId,
      taskId: firstLease.taskId,
    });
    expect(retryState).toMatchObject({
      failureCount: 1,
      disposition: "ready",
      nextAttemptAt: null,
    });

    const secondLease = await checkoutOne(run, "worker-b");
    expect(secondLease.taskId).toBe(firstLease.taskId);
    expect(secondLease.leaseFence).toBe(firstLease.leaseFence + 1);
    expect(secondLease.revision).toBe(5);
  });

  it("routes terminal non-retryable failure to dead-letter", async () => {
    const run = await createRun();
    await admitTask(run, "dead_letter");
    const lease = await checkoutOne(run, "worker-a");

    const state = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: "worker-a",
      leaseFence: lease.leaseFence,
      at: afterLease(lease.leasedAt),
      safeErrorCode: "provider.rejected",
      safeErrorMessage: "Provider rejected the request.",
      disposition: {
        kind: "dead-letter",
        failureCount: 1,
        reasonCode: "provider.rejected",
      },
    });

    expect(state).toMatchObject({
      disposition: "dead-letter",
      failureCount: 1,
      nextAttemptAt: null,
    });

    const task = await pool.query<{
      state: string;
      failure_code: string | null;
      terminal_at: Date | null;
    }>(
      "SELECT state, failure_code, terminal_at FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(task.rows[0]).toMatchObject({
      state: "failed",
      failure_code: "provider.rejected",
    });
    expect(task.rows[0]!.terminal_at).not.toBeNull();
  });

  it("routes uncertain outcomes to needs-attention with no automatic retry", async () => {
    const run = await createRun();
    await admitTask(run, "attention");
    const lease = await checkoutOne(run, "worker-a");

    const state = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: "worker-a",
      leaseFence: lease.leaseFence,
      at: afterLease(lease.leasedAt),
      safeErrorCode: "provider.unknown_outcome",
      safeErrorMessage: "Execution outcome could not be reconciled.",
      disposition: {
        kind: "needs-attention",
        failureCount: 1,
        reasonCode: "provider.unknown_outcome",
      },
    });

    expect(state).toMatchObject({
      disposition: "needs-attention",
      nextAttemptAt: null,
    });

    await pool.query("SELECT pg_sleep(0.02)");
    await expect(
      releaseDueWorkflowTaskRetries(pool, {
        tenantId: run.tenantId,
        limit: 10,
      }),
    ).resolves.toEqual([]);
  });

  it("rejects stale worker/fence and stale failure counts", async () => {
    const run = await createRun();
    await admitTask(run, "stale");
    const lease = await checkoutOne(run, "worker-a");
    const at = afterLease(lease.leasedAt);

    await expect(
      recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: "worker-b",
        leaseFence: lease.leaseFence,
        at,
        safeErrorCode: "provider.timeout",
        safeErrorMessage: "Timeout",
        disposition: {
          kind: "retry-scheduled",
          failureCount: 1,
          delayMs: 1,
          reasonCode: "provider.timeout",
        },
      }),
    ).rejects.toMatchObject({
      code: "workflows.task_stale_lease",
    });

    await expect(
      recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: "worker-a",
        leaseFence: lease.leaseFence,
        at,
        safeErrorCode: "provider.timeout",
        safeErrorMessage: "Timeout",
        disposition: {
          kind: "retry-scheduled",
          failureCount: 2,
          delayMs: 1,
          reasonCode: "provider.timeout",
        },
      }),
    ).rejects.toMatchObject({
      code: "workflows.task_retry_count_conflict",
      category: "conflict",
      retryable: false,
    });
  });

  it("uses SKIP LOCKED so concurrent due-release workers ready different Tasks once", async () => {
    const run = await createRun();
    await admitTask(run, "retry_a");
    await admitTask(run, "retry_b");

    const leases = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-a",
      limit: 2,
      leaseMs: 60_000,
    });
    expect(leases).toHaveLength(2);

    for (const lease of leases) {
      await recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: "worker-a",
        leaseFence: lease.leaseFence,
        at: afterLease(lease.leasedAt),
        safeErrorCode: "provider.timeout",
        safeErrorMessage: "Timeout",
        disposition: {
          kind: "retry-scheduled",
          failureCount: 1,
          delayMs: 1,
          reasonCode: "provider.timeout",
        },
      });
    }

    await pool.query("SELECT pg_sleep(0.02)");

    const poolA = openPool("release-a");
    const poolB = openPool("release-b");
    try {
      const [a, b] = await Promise.all([
        releaseDueWorkflowTaskRetries(poolA, {
          tenantId: run.tenantId,
          limit: 1,
        }),
        releaseDueWorkflowTaskRetries(poolB, {
          tenantId: run.tenantId,
          limit: 1,
        }),
      ]);

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0]).not.toBe(b[0]);

      const all = new Set([...a, ...b]);
      expect(all).toEqual(new Set(leases.map((lease) => lease.taskId)));

      const none = await releaseDueWorkflowTaskRetries(pool, {
        tenantId: run.tenantId,
        limit: 10,
      });
      expect(none).toEqual([]);
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
});

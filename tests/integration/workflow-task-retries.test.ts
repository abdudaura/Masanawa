import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  admitWorkflowTask,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  promoteDueWorkflowTaskRetries,
  recordWorkflowTaskFailure,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow Task retry acceptance", () => {
  const databaseName =
    `masanawa_workflow_retry_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-task-retry-admin",
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
      applicationName: `workflow-task-retry-${label}`,
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
    if (!lease) throw new Error("Expected a leased Workflow Task");
    return { run, lease };
  }

  function afterLease(leasedAt: string, offsetMs = 500) {
    return toInstant(new Date(new Date(leasedAt).getTime() + offsetMs));
  }

  it("persists a retry schedule, blocks early checkout and promotes exactly when due", async () => {
    const { run, lease } = await createRunAndLease("retry_once");
    const failedAt = afterLease(lease.leasedAt);
    const retry = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
      policyKey: "provider_transient",
      policyVersion: 1,
      maxAttempts: 3,
      completedAttempts: 1,
      decision: {
        disposition: "retry-scheduled",
        delayMs: 1_000,
      },
      failure: {
        code: "provider.timeout",
        message: "Provider timed out.",
      },
      at: failedAt,
    });

    expect(retry).toMatchObject({
      completedAttempts: 1,
      disposition: "retry-scheduled",
      lastFailureCode: "provider.timeout",
    });
    expect(retry.nextAttemptAt).not.toBeNull();

    const beforeDueCheckout = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-b",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(beforeDueCheckout).toEqual([]);

    const beforeDue = toInstant(
      new Date(new Date(retry.nextAttemptAt!).getTime() - 1),
    );
    expect(
      await promoteDueWorkflowTaskRetries(pool, {
        tenantId: run.tenantId,
        limit: 1,
        at: beforeDue,
      }),
    ).toEqual([]);

    const promoted = await promoteDueWorkflowTaskRetries(pool, {
      tenantId: run.tenantId,
      limit: 1,
      at: retry.nextAttemptAt!,
    });
    expect(promoted).toEqual([
      expect.objectContaining({
        taskId: lease.taskId,
        completedAttempts: 1,
      }),
    ]);

    const [secondLease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-b",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(secondLease).toMatchObject({
      taskId: lease.taskId,
      leaseOwner: "worker-b",
      leaseFence: lease.leaseFence + 1,
    });

    const staleAt = afterLease(secondLease!.leasedAt);
    await expect(
      recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: lease.leaseOwner,
        leaseFence: lease.leaseFence,
        policyKey: "provider_transient",
        policyVersion: 1,
        maxAttempts: 3,
        completedAttempts: 2,
        decision: {
          disposition: "retry-scheduled",
          delayMs: 2_000,
        },
        failure: {
          code: "provider.timeout",
          message: "Old worker is stale.",
        },
        at: staleAt,
      }),
    ).rejects.toMatchObject({
      code: "workflows.task_stale_lease",
      category: "conflict",
      retryable: false,
    });
  });

  it("dead-letters a terminal retry outcome and leaves the Task terminal", async () => {
    const { run, lease } = await createRunAndLease("dead_letter");
    const at = afterLease(lease.leasedAt);

    const retry = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
      policyKey: "no_retry",
      policyVersion: 1,
      maxAttempts: 1,
      completedAttempts: 1,
      decision: {
        disposition: "dead-letter",
        delayMs: null,
      },
      failure: {
        code: "provider.rejected",
        message: "Provider rejected the operation.",
      },
      at,
    });
    expect(retry).toMatchObject({
      disposition: "dead-letter",
      nextAttemptAt: null,
    });

    const row = await pool.query<{
      state: string;
      terminal_at: Date | null;
      failure_code: string | null;
      lease_owner: string | null;
    }>(
      `SELECT state, terminal_at, failure_code, lease_owner
         FROM workflows.tasks
        WHERE tenant_id = $1 AND task_id = $2`,
      [run.tenantId, lease.taskId],
    );
    expect(row.rows[0]).toMatchObject({
      state: "failed",
      failure_code: "provider.rejected",
      lease_owner: null,
    });
    expect(row.rows[0]!.terminal_at).not.toBeNull();
  });

  it("places ambiguous outcomes into needs-attention without terminally closing the Task", async () => {
    const { run, lease } = await createRunAndLease("needs_attention");
    const at = afterLease(lease.leasedAt);

    const retry = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
      policyKey: "ambiguous_outcome",
      policyVersion: 1,
      maxAttempts: 3,
      completedAttempts: 1,
      decision: {
        disposition: "needs-attention",
        delayMs: null,
      },
      failure: {
        code: "provider.outcome_unknown",
        message: "Provider may have accepted the side effect.",
      },
      at,
    });
    expect(retry.disposition).toBe("needs-attention");

    const row = await pool.query<{
      state: string;
      wait_reason: string | null;
      terminal_at: Date | null;
    }>(
      "SELECT state, wait_reason, terminal_at FROM workflows.tasks WHERE tenant_id = $1 AND task_id = $2",
      [run.tenantId, lease.taskId],
    );
    expect(row.rows[0]).toEqual({
      state: "waiting",
      wait_reason: "needs_attention",
      terminal_at: null,
    });
  });

  it("enforces contiguous attempts and retry policy pinning across retries", async () => {
    const { run, lease } = await createRunAndLease("sequence");
    const firstAt = afterLease(lease.leasedAt);
    const first = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
      policyKey: "provider_transient",
      policyVersion: 1,
      maxAttempts: 4,
      completedAttempts: 1,
      decision: { disposition: "retry-scheduled", delayMs: 1_000 },
      failure: { code: "provider.timeout", message: "Timeout." },
      at: firstAt,
    });
    await promoteDueWorkflowTaskRetries(pool, {
      tenantId: run.tenantId,
      limit: 1,
      at: first.nextAttemptAt!,
    });
    const [secondLease] = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "worker-b",
      limit: 1,
      leaseMs: 60_000,
    });
    const secondAt = afterLease(secondLease!.leasedAt);

    await expect(
      recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: "worker-b",
        leaseFence: secondLease!.leaseFence,
        policyKey: "provider_transient",
        policyVersion: 1,
        maxAttempts: 4,
        completedAttempts: 3,
        decision: { disposition: "retry-scheduled", delayMs: 2_000 },
        failure: { code: "provider.timeout", message: "Skipped attempt." },
        at: secondAt,
      }),
    ).rejects.toMatchObject({
      code: "workflows.retry_attempt_conflict",
    });

    await expect(
      recordWorkflowTaskFailure(pool, {
        tenantId: run.tenantId,
        taskId: lease.taskId,
        workerId: "worker-b",
        leaseFence: secondLease!.leaseFence,
        policyKey: "changed_policy",
        policyVersion: 2,
        maxAttempts: 4,
        completedAttempts: 2,
        decision: { disposition: "retry-scheduled", delayMs: 2_000 },
        failure: { code: "provider.timeout", message: "Changed policy." },
        at: secondAt,
      }),
    ).rejects.toMatchObject({
      code: "workflows.retry_policy_conflict",
    });
  });

  it("promotes a due retry once under concurrent schedulers", async () => {
    const { run, lease } = await createRunAndLease("promotion_race");
    const failedAt = afterLease(lease.leasedAt);
    const retry = await recordWorkflowTaskFailure(pool, {
      tenantId: run.tenantId,
      taskId: lease.taskId,
      workerId: lease.leaseOwner,
      leaseFence: lease.leaseFence,
      policyKey: "provider_transient",
      policyVersion: 1,
      maxAttempts: 3,
      completedAttempts: 1,
      decision: { disposition: "retry-scheduled", delayMs: 1_000 },
      failure: { code: "provider.timeout", message: "Timeout." },
      at: failedAt,
    });

    const poolA = openPool("promotion-a");
    const poolB = openPool("promotion-b");
    try {
      const [a, b] = await Promise.all([
        promoteDueWorkflowTaskRetries(poolA, {
          tenantId: run.tenantId,
          limit: 1,
          at: retry.nextAttemptAt!,
        }),
        promoteDueWorkflowTaskRetries(poolB, {
          tenantId: run.tenantId,
          limit: 1,
          at: retry.nextAttemptAt!,
        }),
      ]);
      expect(a.length + b.length).toBe(1);

      const row = await pool.query<{
        state: string;
        wait_reason: string | null;
        disposition: string;
        next_attempt_at: Date | null;
      }>(
        `SELECT t.state, t.wait_reason, r.disposition, r.next_attempt_at
           FROM workflows.tasks AS t
           JOIN workflows.task_retry_state AS r
             ON r.tenant_id = t.tenant_id AND r.task_id = t.task_id
          WHERE t.tenant_id = $1 AND t.task_id = $2`,
        [run.tenantId, lease.taskId],
      );
      expect(row.rows[0]).toEqual({
        state: "ready",
        wait_reason: null,
        disposition: "retry-ready",
        next_attempt_at: null,
      });
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
});

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  appendWorkflowCheckpoint,
  createPostgresPool,
  createWorkflowRunRecord,
  loadLatestCompatibleWorkflowCheckpoint,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow checkpoint acceptance", () => {
  const databaseName =
    `masanawa_workflow_checkpoint_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-checkpoint-admin",
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
      applicationName: "workflow-checkpoint",
      max: 3,
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

  function checkpointInput(
    run: Awaited<ReturnType<typeof createRun>>,
    sequence: number,
    parentSequence: number | null,
    payload: unknown,
  ) {
    return {
      schemaVersion: 1 as const,
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      sequence,
      parentSequence,
      workflowRunRevision: run.revision,
      payload,
      payloadFingerprint: fingerprintCanonicalJson(payload),
      createdAt: toInstant(
        new Date(`2026-10-04T18:0${Math.min(sequence, 9)}:00.000Z`),
      ),
    };
  }

  it("appends durable checkpoints and reconciles exact replay", async () => {
    const run = await createRun();
    const payload = {
      runState: { state: "pending", revision: 1 },
      taskStates: {},
      executorStates: {},
      edgeStates: {},
      pendingRequestStates: {},
      iteration: 0,
      superstep: 0,
      evidenceRefs: [],
    };
    const input = checkpointInput(run, 1, null, payload);

    const first = await appendWorkflowCheckpoint(pool, input);
    const second = await appendWorkflowCheckpoint(pool, input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      sequence: 1,
      parentSequence: null,
      workflowRunRevision: 1,
      payloadFingerprint: fingerprintCanonicalJson(payload),
    });

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM workflows.checkpoints
        WHERE tenant_id = $1 AND workflow_run_id = $2`,
      [run.tenantId, run.workflowRunId],
    );
    expect(count.rows[0]!.count).toBe("1");
  });

  it("rejects changed replay at the same checkpoint sequence", async () => {
    const run = await createRun();
    const firstPayload = {
      runState: { state: "pending" },
      taskStates: {},
      executorStates: {},
      edgeStates: {},
      pendingRequestStates: {},
      iteration: 0,
      superstep: 0,
      evidenceRefs: [],
    };
    await appendWorkflowCheckpoint(
      pool,
      checkpointInput(run, 1, null, firstPayload),
    );

    const changedPayload = {
      ...firstPayload,
      runState: { state: "running" },
    };

    await expect(
      appendWorkflowCheckpoint(
        pool,
        checkpointInput(run, 1, null, changedPayload),
      ),
    ).rejects.toMatchObject({
      code: "workflows.checkpoint_conflict",
      category: "conflict",
      retryable: false,
    });
  });

  it("persists checkpoint parent lineage and returns the latest compatible snapshot", async () => {
    const run = await createRun();
    const first = checkpointInput(
      run,
      1,
      null,
      {
        runState: { state: "pending" },
        taskStates: {},
        executorStates: {},
        edgeStates: {},
        pendingRequestStates: {},
        iteration: 0,
        superstep: 0,
        evidenceRefs: [],
      },
    );
    const second = checkpointInput(
      run,
      2,
      1,
      {
        runState: { state: "pending" },
        taskStates: { task_a: { state: "ready" } },
        executorStates: {},
        edgeStates: {},
        pendingRequestStates: {},
        iteration: 1,
        superstep: 1,
        evidenceRefs: ["event:one"],
      },
    );

    await appendWorkflowCheckpoint(pool, first);
    await appendWorkflowCheckpoint(pool, second);

    const latest = await loadLatestCompatibleWorkflowCheckpoint(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      schemaVersion: 1,
    });

    expect(latest).toMatchObject({
      sequence: 2,
      parentSequence: 1,
      payloadFingerprint: second.payloadFingerprint,
    });

    const incompatible = await loadLatestCompatibleWorkflowCheckpoint(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: `sha256:${"b".repeat(64)}`,
      schemaVersion: 1,
    });
    expect(incompatible).toBeNull();
  });

  it("rejects stale Run revision and incompatible WorkflowVersion/graph", async () => {
    const run = await createRun();
    const payload = {
      runState: { state: "pending" },
      taskStates: {},
      executorStates: {},
      edgeStates: {},
      pendingRequestStates: {},
      iteration: 0,
      superstep: 0,
      evidenceRefs: [],
    };

    await expect(
      appendWorkflowCheckpoint(pool, {
        ...checkpointInput(run, 1, null, payload),
        workflowRunRevision: 2,
      }),
    ).rejects.toMatchObject({
      code: "workflows.checkpoint_stale_revision",
      category: "conflict",
      retryable: false,
    });

    await expect(
      appendWorkflowCheckpoint(pool, {
        ...checkpointInput(run, 1, null, payload),
        workflowVersionId: createCanonicalId("workflow-version"),
      }),
    ).rejects.toMatchObject({
      code: "workflows.checkpoint_incompatible",
    });

    await expect(
      appendWorkflowCheckpoint(pool, {
        ...checkpointInput(run, 1, null, payload),
        graphSignature: `sha256:${"b".repeat(64)}`,
      }),
    ).rejects.toMatchObject({
      code: "workflows.checkpoint_incompatible",
    });
  });

  it("requires parent checkpoint existence for non-initial lineage", async () => {
    const run = await createRun();
    const payload = {
      runState: { state: "pending" },
      taskStates: {},
      executorStates: {},
      edgeStates: {},
      pendingRequestStates: {},
      iteration: 1,
      superstep: 1,
      evidenceRefs: [],
    };

    await expect(
      appendWorkflowCheckpoint(
        pool,
        checkpointInput(run, 2, 1, payload),
      ),
    ).rejects.toBeDefined();

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM workflows.checkpoints
        WHERE tenant_id = $1 AND workflow_run_id = $2`,
      [run.tenantId, run.workflowRunId],
    );
    expect(count.rows[0]!.count).toBe("0");
  });

  it("rejects direct checkpoint update and delete at the database layer", async () => {
    const run = await createRun();
    const input = checkpointInput(
      run,
      1,
      null,
      {
        runState: { state: "pending" },
        taskStates: {},
        executorStates: {},
        edgeStates: {},
        pendingRequestStates: {},
        iteration: 0,
        superstep: 0,
        evidenceRefs: [],
      },
    );
    await appendWorkflowCheckpoint(pool, input);

    await expect(
      pool.query(
        `UPDATE workflows.checkpoints
            SET workflow_run_revision = workflow_run_revision + 1
          WHERE tenant_id = $1 AND workflow_run_id = $2 AND sequence = 1`,
        [run.tenantId, run.workflowRunId],
      ),
    ).rejects.toThrow(/immutable/u);

    await expect(
      pool.query(
        `DELETE FROM workflows.checkpoints
          WHERE tenant_id = $1 AND workflow_run_id = $2 AND sequence = 1`,
        [run.tenantId, run.workflowRunId],
      ),
    ).rejects.toThrow(/immutable/u);
  });
});

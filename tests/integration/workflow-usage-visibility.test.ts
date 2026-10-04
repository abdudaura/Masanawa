import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type EventId,
  type Instant,
  type OperationId,
  type ProviderId,
  type TaskId,
  type TenantId,
  type WorkflowRunId,
} from "@masanawa/contracts";
import {
  admitWorkflowTask,
  appendWorkflowUsageEvidence,
  checkoutWorkflowTasks,
  createPostgresPool,
  createWorkflowRunRecord,
  readWorkflowOperatorSummary,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow usage and operator visibility acceptance", () => {
  const databaseName =
    `masanawa_workflow_visibility_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-visibility-admin",
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
      applicationName: "workflow-visibility",
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

  async function databaseNow(): Promise<Instant> {
    const result = await pool.query<{ at: Date }>(
      "SELECT clock_timestamp() AS at",
    );
    return toInstant(result.rows[0]!.at);
  }

  async function createRun() {
    const at = await databaseNow();
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
    const at = await databaseNow();
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

  function usageFingerprint(input: {
    usageEventId: EventId;
    tenantId: TenantId;
    workflowRunId: WorkflowRunId;
    taskId: TaskId | null;
    operationId: OperationId | null;
    providerId: ProviderId | null;
    category: "inference" | "tool" | "provider" | "workflow";
    providerKey: string | null;
    modelKey: string | null;
    inputUnits: number;
    outputUnits: number;
    costMicros: number;
    latencyMs: number;
    evidenceKey: string;
    occurredAt: Instant;
  }) {
    return createHash("sha256")
      .update(JSON.stringify(input), "utf8")
      .digest("hex");
  }

  function usageInput(
    run: Awaited<ReturnType<typeof createRun>>,
    overrides: Partial<{
      usageEventId: EventId;
      taskId: TaskId | null;
      operationId: OperationId | null;
      providerId: ProviderId | null;
      category: "inference" | "tool" | "provider" | "workflow";
      providerKey: string | null;
      modelKey: string | null;
      inputUnits: number;
      outputUnits: number;
      costMicros: number;
      latencyMs: number;
      evidenceKey: string;
      occurredAt: Instant;
    }> = {},
  ) {
    const base = {
      usageEventId: overrides.usageEventId ?? createCanonicalId("event"),
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      taskId: overrides.taskId ?? null,
      operationId: overrides.operationId ?? null,
      providerId: overrides.providerId ?? null,
      category: overrides.category ?? ("workflow" as const),
      providerKey: overrides.providerKey ?? null,
      modelKey: overrides.modelKey ?? null,
      inputUnits: overrides.inputUnits ?? 0,
      outputUnits: overrides.outputUnits ?? 0,
      costMicros: overrides.costMicros ?? 0,
      latencyMs: overrides.latencyMs ?? 0,
      evidenceKey:
        overrides.evidenceKey ??
        `usage:${overrides.usageEventId ?? randomUUID()}`,
      occurredAt:
        overrides.occurredAt ??
        toInstant(new Date("2026-10-04T18:00:00.000Z")),
    };
    return {
      ...base,
      evidenceFingerprint: usageFingerprint(base),
    };
  }

  it("appends immutable usage evidence and reconciles exact replay", async () => {
    const run = await createRun();
    const usage = usageInput(run, {
      category: "inference",
      providerId: createCanonicalId("provider"),
      providerKey: "gemini",
      modelKey: "gemini-flash",
      inputUnits: 100,
      outputUnits: 20,
      costMicros: 250,
      latencyMs: 800,
      evidenceKey: "provider:response:replay-one",
      occurredAt: await databaseNow(),
    });

    const client = await pool.connect();
    try {
      const first = await appendWorkflowUsageEvidence(client, usage);
      const replay = await appendWorkflowUsageEvidence(client, usage);
      expect(replay).toEqual(first);

      const changed = {
        ...usage,
        costMicros: 251,
      };
      changed.evidenceFingerprint = usageFingerprint(changed);

      await expect(
        appendWorkflowUsageEvidence(client, changed),
      ).rejects.toMatchObject({
        code: "workflows.usage_conflict",
        category: "conflict",
        retryable: false,
      });
    } finally {
      client.release();
    }

    await expect(
      pool.query(
        `UPDATE workflows.usage_evidence
            SET cost_micros = cost_micros + 1
          WHERE tenant_id = $1 AND usage_event_id = $2`,
        [run.tenantId, usage.usageEventId],
      ),
    ).rejects.toThrow(/immutable/u);

    await expect(
      pool.query(
        `DELETE FROM workflows.usage_evidence
          WHERE tenant_id = $1 AND usage_event_id = $2`,
        [run.tenantId, usage.usageEventId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("rejects usage bound to a Task from another WorkflowRun", async () => {
    const firstRun = await createRun();
    const secondRun = await createRun();
    const task = await admitTask(firstRun, "scoped_task");
    const usage = usageInput(secondRun, {
      taskId: task.task.taskId,
      evidenceKey: "scope:mismatch:task",
      occurredAt: await databaseNow(),
    });

    const client = await pool.connect();
    try {
      await expect(
        appendWorkflowUsageEvidence(client, usage),
      ).rejects.toBeDefined();
    } finally {
      client.release();
    }
  });

  it("projects privacy-safe workflow operator state and measured cost totals", async () => {
    const run = await createRun();
    const ready = await admitTask(run, "ready_task");
    const running = await admitTask(run, "running_task");

    const leases = await checkoutWorkflowTasks(pool, {
      tenantId: run.tenantId,
      workerId: "visibility-worker",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(leases).toHaveLength(1);
    expect(
      new Set([ready.task.taskId, running.task.taskId]).has(leases[0]!.taskId),
    ).toBe(true);

    const readyTaskId =
      leases[0]!.taskId === ready.task.taskId
        ? running.task.taskId
        : ready.task.taskId;
    const runningTaskId = leases[0]!.taskId;

    const now = await databaseNow();

    await pool.query(
      `INSERT INTO workflows.task_retry_state (
         tenant_id, task_id, policy_key, policy_version, max_attempts,
         completed_attempts, disposition, next_attempt_at,
         last_failure_code, last_failure_message, revision, updated_at
       )
       VALUES ($1,$2,'default',1,3,1,'needs-attention',NULL,
               'provider.unknown_outcome','hidden operator detail',1,$3)`,
      [run.tenantId, readyTaskId, now],
    );

    const humanRequestId = createCanonicalId("request");
    await pool.query(
      `INSERT INTO workflows.human_requests (
         tenant_id, human_request_id, workflow_run_id, task_id,
         workflow_version_id, graph_signature, kind, state, prompt,
         approval_id, request_fingerprint, response_payload,
         response_fingerprint, requested_at, resolved_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,'information','pending',
               'secret prompt must not appear in summary',NULL,$7,
               NULL,NULL,$8,NULL)`,
      [
        run.tenantId,
        humanRequestId,
        run.workflowRunId,
        readyTaskId,
        run.workflowVersionId,
        run.graphSignature,
        "b".repeat(64),
        now,
      ],
    );

    const operationId = createCanonicalId("operation");
    await pool.query(
      `INSERT INTO events.operations (
         operation_id, tenant_id, kind, idempotency_key,
         authority_scope_hash, request_fingerprint, state
       )
       VALUES ($1,$2,'workflow.test','visibility-operation',
               'scope-hash','request-fingerprint','unknown')`,
      [operationId, run.tenantId],
    );
    await pool.query(
      `INSERT INTO workflows.task_operation_bindings (
         tenant_id, task_id, workflow_run_id, workflow_version_id,
         graph_signature, role, operation_id, binding_fingerprint, bound_at
       )
       VALUES ($1,$2,$3,$4,$5,'primary',$6,$7,$8)`,
      [
        run.tenantId,
        runningTaskId,
        run.workflowRunId,
        run.workflowVersionId,
        run.graphSignature,
        operationId,
        "c".repeat(64),
        now,
      ],
    );

    const client = await pool.connect();
    try {
      await appendWorkflowUsageEvidence(
        client,
        usageInput(run, {
          taskId: runningTaskId,
          operationId,
          providerId: createCanonicalId("provider"),
          category: "provider",
          providerKey: "gemini",
          modelKey: "gemini-flash",
          inputUnits: 100,
          outputUnits: 20,
          costMicros: 250,
          latencyMs: 800,
          evidenceKey: "provider:response:summary-one",
          occurredAt: now,
        }),
      );
      await appendWorkflowUsageEvidence(
        client,
        usageInput(run, {
          taskId: readyTaskId,
          category: "workflow",
          inputUnits: 10,
          outputUnits: 5,
          costMicros: 50,
          latencyMs: 100,
          evidenceKey: "workflow:overhead:summary-two",
          occurredAt: now,
        }),
      );
    } finally {
      client.release();
    }

    const summary = await readWorkflowOperatorSummary(pool, {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
    });

    expect(summary).toMatchObject({
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      runState: "pending",
      runRevision: 1,
      taskStates: {
        ready: 1,
        running: 1,
      },
      retryDispositions: {
        retryScheduled: 0,
        retryReady: 0,
        deadLetter: 0,
        needsAttention: 1,
      },
      pendingHumanRequests: 1,
      operationStates: {
        unknown: 1,
      },
      usage: {
        recordCount: 2,
        inputUnits: 110,
        outputUnits: 25,
        costMicros: 300,
        latencyMs: 900,
      },
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("secret prompt");
    expect(serialized).not.toContain("hidden operator detail");
    expect(serialized).not.toContain("request-fingerprint");
    expect(serialized).not.toContain("scope-hash");
  });

  it("isolates operator summaries by Tenant and WorkflowRun", async () => {
    const first = await createRun();
    const second = await createRun();
    const client = await pool.connect();
    try {
      await appendWorkflowUsageEvidence(
        client,
        usageInput(first, {
          costMicros: 10,
          evidenceKey: "tenant:first",
          occurredAt: await databaseNow(),
        }),
      );
      await appendWorkflowUsageEvidence(
        client,
        usageInput(second, {
          costMicros: 999,
          evidenceKey: "tenant:second",
          occurredAt: await databaseNow(),
        }),
      );
    } finally {
      client.release();
    }

    const firstSummary = await readWorkflowOperatorSummary(pool, {
      tenantId: first.tenantId,
      workflowRunId: first.workflowRunId,
    });
    expect(firstSummary.usage.costMicros).toBe(10);

    await expect(
      readWorkflowOperatorSummary(pool, {
        tenantId: second.tenantId,
        workflowRunId: first.workflowRunId,
      }),
    ).rejects.toMatchObject({
      code: "workflows.run_not_found",
      category: "not-found",
      retryable: false,
    });
  });
});

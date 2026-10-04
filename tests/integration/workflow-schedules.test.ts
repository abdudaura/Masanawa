import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  createPostgresPool,
  createWorkflowRunRecord,
  createWorkflowScheduleRecord,
  materializeDueWorkflowOccurrences,
  runMigrations,
  workflowMigrationRoots,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("workflow schedule acceptance", () => {
  const databaseName =
    `masanawa_workflow_schedules_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "workflow-schedules-admin",
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
      applicationName: `workflow-schedules-${label}`,
      max: 3,
    });
  }

  async function databaseNow() {
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

  function fingerprint(input: {
    tenantId: string;
    workflowRunId: string;
    workflowVersionId: string;
    graphSignature: string;
    scheduleKey: string;
    targetNodeKey: string;
    kind: "once" | "interval";
    firstAt: Instant;
    everyMs: number | null;
    maxOccurrences: number | null;
    endAt: Instant | null;
    createdAt: Instant;
  }) {
    return createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: input.tenantId,
          workflowRunId: input.workflowRunId,
          workflowVersionId: input.workflowVersionId,
          graphSignature: input.graphSignature,
          scheduleKey: input.scheduleKey,
          targetNodeKey: input.targetNodeKey,
          spec:
            input.kind === "once"
              ? { kind: "once", at: input.firstAt }
              : {
                  kind: "interval",
                  firstAt: input.firstAt,
                  everyMs: input.everyMs,
                  maxOccurrences: input.maxOccurrences,
                  endAt: input.endAt,
                },
          createdAt: input.createdAt,
        }),
        "utf8",
      )
      .digest("hex");
  }

  function scheduleInput(
    run: Awaited<ReturnType<typeof createRun>>,
    input: {
      scheduleKey: string;
      targetNodeKey?: string;
      kind: "once" | "interval";
      firstAt: Instant;
      everyMs?: number | null;
      maxOccurrences?: number | null;
      endAt?: string | null;
      createdAt: Instant;
    },
  ) {
    const structural = {
      tenantId: run.tenantId,
      workflowRunId: run.workflowRunId,
      workflowVersionId: run.workflowVersionId,
      graphSignature: run.graphSignature,
      scheduleKey: input.scheduleKey,
      targetNodeKey: input.targetNodeKey ?? "timer_target",
      kind: input.kind,
      firstAt: input.firstAt,
      everyMs: input.kind === "interval" ? (input.everyMs ?? 1_000) : null,
      maxOccurrences:
        input.kind === "interval" ? (input.maxOccurrences ?? null) : null,
      endAt: input.kind === "interval" ? (input.endAt ?? null) : null,
      createdAt: input.createdAt,
    };
    return {
      ...structural,
      correlationId: createCanonicalId("correlation"),
      destination: "workflow.timers",
      definitionFingerprint: fingerprint(structural),
    };
  }

  async function createSchedule(
    run: Awaited<ReturnType<typeof createRun>>,
    input: Parameters<typeof scheduleInput>[1],
  ) {
    const record = scheduleInput(run, input);
    const client = await pool.connect();
    try {
      return await createWorkflowScheduleRecord(client, record);
    } finally {
      client.release();
    }
  }

  it("reconciles exact schedule replay and rejects changed definition reuse", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const input = scheduleInput(run, {
      scheduleKey: "one_shot",
      kind: "once",
      firstAt: now,
      createdAt: now,
    });

    const client = await pool.connect();
    try {
      const first = await createWorkflowScheduleRecord(client, input);
      const second = await createWorkflowScheduleRecord(client, input);
      expect(second).toEqual(first);

      const changed = {
        ...input,
        targetNodeKey: "different_target",
      };
      changed.definitionFingerprint = fingerprint(changed);

      await expect(
        createWorkflowScheduleRecord(client, changed),
      ).rejects.toMatchObject({
        code: "workflows.schedule_conflict",
        category: "conflict",
        retryable: false,
      });
    } finally {
      client.release();
    }
  });

  it("materializes one one-shot occurrence and completes the schedule atomically", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const schedule = await createSchedule(run, {
      scheduleKey: "single",
      kind: "once",
      firstAt: toInstant(new Date(new Date(now).getTime() - 1_000)),
      createdAt: now,
    });

    const materialized = await materializeDueWorkflowOccurrences(pool, {
      tenantId: run.tenantId,
      limit: 10,
    });
    expect(materialized).toHaveLength(1);
    expect(materialized[0]).toMatchObject({
      workflowRunId: run.workflowRunId,
      scheduleKey: schedule.scheduleKey,
      sequence: 1,
      targetNodeKey: schedule.targetNodeKey,
    });

    const state = await pool.query<{
      state: string;
      next_sequence: string;
      next_due_at: Date | null;
    }>(
      `SELECT state, next_sequence::text, next_due_at
         FROM workflows.schedules
        WHERE tenant_id = $1
          AND workflow_run_id = $2
          AND schedule_key = $3`,
      [run.tenantId, run.workflowRunId, schedule.scheduleKey],
    );
    expect(state.rows[0]).toEqual({
      state: "completed",
      next_sequence: "2",
      next_due_at: null,
    });

    const outbox = await pool.query<{
      event_type: string;
      aggregate_type: string;
      payload: {
        scheduleKey: string;
        sequence: number;
        targetNodeKey: string;
      };
    }>(
      `SELECT event_type, aggregate_type, payload
         FROM events.outbox
        WHERE outbox_event_id = $1`,
      [materialized[0]!.outboxEventId],
    );
    expect(outbox.rows[0]).toMatchObject({
      event_type: "workflow.schedule.occurrence.v1",
      aggregate_type: "workflow-schedule",
      payload: {
        scheduleKey: schedule.scheduleKey,
        sequence: 1,
        targetNodeKey: schedule.targetNodeKey,
      },
    });

    await expect(
      materializeDueWorkflowOccurrences(pool, {
        tenantId: run.tenantId,
        limit: 10,
      }),
    ).resolves.toEqual([]);
  });

  it("advances overdue bounded interval schedules one replay-safe occurrence at a time", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const firstAt = toInstant(new Date(new Date(now).getTime() - 10_000));
    const schedule = await createSchedule(run, {
      scheduleKey: "bounded_interval",
      kind: "interval",
      firstAt,
      everyMs: 1_000,
      maxOccurrences: 2,
      endAt: null,
      createdAt: now,
    });

    const first = await materializeDueWorkflowOccurrences(pool, {
      tenantId: run.tenantId,
      limit: 1,
    });
    const second = await materializeDueWorkflowOccurrences(pool, {
      tenantId: run.tenantId,
      limit: 1,
    });
    const third = await materializeDueWorkflowOccurrences(pool, {
      tenantId: run.tenantId,
      limit: 1,
    });

    expect(first[0]).toMatchObject({
      scheduleKey: schedule.scheduleKey,
      sequence: 1,
    });
    expect(second[0]).toMatchObject({
      scheduleKey: schedule.scheduleKey,
      sequence: 2,
    });
    expect(third).toEqual([]);

    const rows = await pool.query<{ sequence: string; outbox_event_id: string }>(
      `SELECT sequence::text, outbox_event_id
         FROM workflows.schedule_occurrences
        WHERE tenant_id = $1
          AND workflow_run_id = $2
          AND schedule_key = $3
        ORDER BY sequence`,
      [run.tenantId, run.workflowRunId, schedule.scheduleKey],
    );
    expect(rows.rows.map((row) => row.sequence)).toEqual(["1", "2"]);
    expect(new Set(rows.rows.map((row) => row.outbox_event_id)).size).toBe(2);
  });

  it("uses SKIP LOCKED so concurrent timer workers materialize different schedules", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const dueAt = toInstant(new Date(new Date(now).getTime() - 1_000));
    await createSchedule(run, {
      scheduleKey: "timer_a",
      kind: "once",
      firstAt: dueAt,
      createdAt: now,
    });
    await createSchedule(run, {
      scheduleKey: "timer_b",
      kind: "once",
      firstAt: dueAt,
      createdAt: now,
    });

    const poolA = openPool("timer-a");
    const poolB = openPool("timer-b");
    try {
      const [a, b] = await Promise.all([
        materializeDueWorkflowOccurrences(poolA, {
          tenantId: run.tenantId,
          limit: 1,
        }),
        materializeDueWorkflowOccurrences(poolB, {
          tenantId: run.tenantId,
          limit: 1,
        }),
      ]);
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0]!.scheduleKey).not.toBe(b[0]!.scheduleKey);
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });

  it("rejects Run/version/graph drift at schedule creation", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const input = scheduleInput(run, {
      scheduleKey: "bad_graph",
      kind: "once",
      firstAt: now,
      createdAt: now,
    });
    const changed = {
      ...input,
      graphSignature: `sha256:${"b".repeat(64)}`,
    };
    changed.definitionFingerprint = fingerprint(changed);

    const client = await pool.connect();
    try {
      await expect(
        createWorkflowScheduleRecord(client, changed),
      ).rejects.toBeDefined();
    } finally {
      client.release();
    }
  });

  it("rejects direct schedule-definition and occurrence mutation", async () => {
    const run = await createRun();
    const now = await databaseNow();
    const schedule = await createSchedule(run, {
      scheduleKey: "immutable",
      kind: "once",
      firstAt: toInstant(new Date(new Date(now).getTime() - 1_000)),
      createdAt: now,
    });
    await materializeDueWorkflowOccurrences(pool, {
      tenantId: run.tenantId,
      limit: 1,
    });

    await expect(
      pool.query(
        `UPDATE workflows.schedules
            SET target_node_key = 'changed'
          WHERE tenant_id = $1
            AND workflow_run_id = $2
            AND schedule_key = $3`,
        [run.tenantId, run.workflowRunId, schedule.scheduleKey],
      ),
    ).rejects.toThrow(/immutable/u);

    await expect(
      pool.query(
        `DELETE FROM workflows.schedule_occurrences
          WHERE tenant_id = $1
            AND workflow_run_id = $2
            AND schedule_key = $3
            AND sequence = 1`,
        [run.tenantId, run.workflowRunId, schedule.scheduleKey],
      ),
    ).rejects.toThrow(/immutable/u);
  });
});

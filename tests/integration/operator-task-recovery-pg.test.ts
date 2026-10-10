import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresRecoveryJournal } from "../../packages/operator-tasks/src/recovery.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;

/**
 * Exercises real PostgreSQL row leases, immutable events and revision/capability
 * fencing. Each invocation owns a unique throwaway database; no production DB
 * or unrelated parallel suite's operator task records can be touched.
 */
suite("U02 durable recovery — disposable PostgreSQL acceptance", () => {
  let admin: Pool;
  let pool: Pool;
  let databaseName: string;
  const at = "2026-10-10T08:00:00.000Z";
  const before = "2026-10-10T07:59:00.000Z";
  const old = "2026-10-10T07:50:00.000Z";

  beforeAll(async () => {
    if (!connectionString) throw new Error("U02_DATABASE_URL_MISSING");
    const url = new URL(connectionString);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.pathname !== "/masanawa_test" || (url.port && url.port !== "5432")) {
      throw new Error("U02_DISPOSABLE_LOCAL_POSTGRES_REQUIRED");
    }
    databaseName = `u02_recovery_${randomUUID().replace(/-/gu, "").slice(0, 20)}`;
    admin = new Pool({ connectionString, max: 2 });
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const isolated = new URL(connectionString);
    isolated.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: isolated.toString(), max: 5 });
    const sql = await readFile(new URL("../../packages/operator-tasks/migrations/0010_operator_tasks_isolated.sql", import.meta.url), "utf8");
    await pool.query(sql);
  }, 60_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) {
      try {
        if (databaseName && /^u02_recovery_[0-9a-f]{20}$/u.test(databaseName)) {
          await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        }
      } finally {
        await admin.end();
      }
    }
  }, 60_000);

  async function insertRunning(suffix: string) {
    const tenantId = `tenant_${randomUUID()}`;
    const userId = `user_${randomUUID()}`;
    const taskId = `task_${randomUUID()}`;
    const operationId = `operation_${randomUUID()}`;
    const capabilityId = "talks.publish";
    await pool.query(
      `INSERT INTO operator_tasks.tasks
          (tenant_id,user_id,task_id,request_id,scope,capability_id,
           capability_version,argument_digest,phase,version,operation_class,
           operation_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'private-assistant',$5,1,$6,'running',2,'send',$7,$8,$8)`,
      [tenantId, userId, taskId, `request-${suffix}`, capabilityId, "a".repeat(64), operationId, old],
    );
    return { tenantId, userId, taskId, operationId, capabilityId };
  }

  it("settles only the leased operation, capability and version with append-only history", async () => {
    const expected = await insertRunning("bound");
    const journal = createPostgresRecoveryJournal(pool);
    const [lease] = await journal.claim({ before, now: at, limit: 1 });
    expect(lease).toMatchObject({ ...expected, version: 3 });
    expect(lease).toBeDefined();
    if (!lease) throw new Error("U02_LEASE_MISSING");

    expect(await journal.settle({
      operation: { ...lease, capabilityId: "foreign.capability" },
      outcome: { status: "confirmed", receiptRef: "ledger:forged" }, now: at,
    })).toBe("stale");
    expect(await journal.settle({
      operation: lease,
      outcome: { status: "confirmed", receiptRef: "forged\nreceipt" }, now: at,
    })).toBe("unknown");
    expect(await journal.settle({
      operation: lease,
      outcome: { status: "rejected", code: "DECLINED\nFORGED" }, now: at,
    })).toBe("unknown");

    const inProgress = await pool.query<{ phase: string; version: number; receipt_ref: string | null }>(
      "SELECT phase,version,receipt_ref FROM operator_tasks.tasks WHERE task_id=$1",
      [lease.taskId],
    );
    expect(inProgress.rows[0]).toEqual({
      phase: "reconciling", version: 3, receipt_ref: null,
    });

    expect(await journal.settle({
      operation: lease, outcome: { status: "confirmed", receiptRef: "talk:receipt_1" }, now: at,
    })).toBe("settled");
    expect(await journal.settle({
      operation: lease, outcome: { status: "rejected", code: "DENIED" }, now: at,
    })).toBe("stale");

    const task = await pool.query<{ phase: string; version: number; receipt_ref: string }>(
      "SELECT phase,version,receipt_ref FROM operator_tasks.tasks WHERE task_id=$1",
      [lease.taskId],
    );
    expect(task.rows[0]).toEqual({
      phase: "succeeded", version: 4, receipt_ref: "talk:receipt_1",
    });
    const events = await pool.query<{ task_version: number; phase: string }>(
      "SELECT task_version,phase FROM operator_tasks.events WHERE task_id=$1 ORDER BY task_version",
      [lease.taskId],
    );
    expect(events.rows).toEqual([
      { task_version: 3, phase: "reconciling" },
      { task_version: 4, phase: "succeeded" },
    ]);
  }, 30_000);

  it("leases each operation only once across overlapping PostgreSQL workers", async () => {
    const first = await insertRunning("concurrent-a");
    const second = await insertRunning("concurrent-b");
    const left = createPostgresRecoveryJournal(pool);
    const right = createPostgresRecoveryJournal(pool);
    const [a, b] = await Promise.all([
      left.claim({ before, now: at, limit: 1 }),
      right.claim({ before, now: at, limit: 1 }),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    const ids = [a[0]?.taskId, b[0]?.taskId];
    expect(new Set(ids).size).toBe(2);
    expect(ids.sort()).toEqual([first.taskId, second.taskId].sort());
    const events = await pool.query<{ task_id: string; n: string }>(
      `SELECT task_id,count(*)::text AS n FROM operator_tasks.events
        WHERE task_id = ANY($1::text[]) GROUP BY task_id`, [ids],
    );
    expect(events.rows).toHaveLength(2);
    expect(events.rows.every(row => row.n === "1")).toBe(true);
  }, 30_000);
});

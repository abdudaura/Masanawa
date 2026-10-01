import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  toInstant,
  type OperationId,
} from "@masanawa/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  claimOutboxBatch,
  createPostgresPool,
  enqueueOutbox,
  prepareOperation,
  runMigrations,
  settleOutboxClaim,
  transitionOperation,
  withTransaction,
} from "./index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe.sequential : describe.skip;
const eventMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/events/migrations", import.meta.url),
);

describePostgres("PostgreSQL 18 foundation integration", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-foundation-integration",
      max: 4,
    });

    const version = await pool.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    const versionNumber = Number(version.rows[0]?.server_version_num);
    expect(versionNumber).toBeGreaterThanOrEqual(180000);
    expect(versionNumber).toBeLessThan(190000);
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS events CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );

    const applied = await runMigrations(pool, [
      { owner: "events", directory: eventMigrationDirectory },
    ]);
    expect(applied).toEqual(["events/0001_event_foundation.sql"]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("replays package-owned migrations idempotently", async () => {
    const appliedAgain = await runMigrations(pool, [
      { owner: "events", directory: eventMigrationDirectory },
    ]);

    expect(appliedAgain).toEqual([]);

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'events'
        ORDER BY table_name`,
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "audit_events",
      "external_receipts",
      "idempotency_records",
      "inbox",
      "operations",
      "outbox",
      "platform_events",
      "reconciliation_cases",
    ]);
  });

  it("preserves one operation across restart-safe idempotent admission", async () => {
    const tenantId = createCanonicalId("tenant");
    const input = {
      tenantId,
      kind: "message.send",
      idempotencyKey: "send-123",
      authorityScopeHash: "authority-v1",
      requestFingerprint: "request-v1",
      expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
    } as const;

    const first = await withTransaction(pool, (client) =>
      prepareOperation(client, input),
    );
    expect(first.reused).toBe(false);

    const second = await withTransaction(pool, (client) =>
      prepareOperation(client, input),
    );
    expect(second.reused).toBe(true);
    expect(second.operation.operationId).toBe(first.operation.operationId);

    await expect(
      withTransaction(pool, (client) =>
        prepareOperation(client, {
          ...input,
          requestFingerprint: "request-changed",
        }),
      ),
    ).rejects.toMatchObject({
      code: "idempotency.fingerprint_conflict",
      category: "conflict",
      operationId: first.operation.operationId,
    });
  });

  it("rejects a stale persisted operation transition", async () => {
    const tenantId = createCanonicalId("tenant");
    const prepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "message.send",
        idempotencyKey: "transition-123",
        authorityScopeHash: "authority-v1",
        requestFingerprint: "transition-v1",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    const authorized = await withTransaction(pool, (client) =>
      transitionOperation(client, {
        operationId: prepared.operation.operationId,
        from: "prepared",
        to: "authorized",
      }),
    );
    expect(authorized.state).toBe("authorized");

    await expect(
      withTransaction(pool, (client) =>
        transitionOperation(client, {
          operationId: prepared.operation.operationId,
          from: "prepared",
          to: "authorized",
        }),
      ),
    ).rejects.toMatchObject({
      code: "operation.stale_transition",
      category: "conflict",
      operationId: prepared.operation.operationId,
    });
  });

  it("prevents a stale outbox worker fence from settling a newer claim", async () => {
    const tenantId = createCanonicalId("tenant");
    const eventId = createCanonicalId("event");

    const outboxEventId = await withTransaction(pool, (client) =>
      enqueueOutbox(client, {
        tenantId,
        eventId,
        eventType: "message.requested",
        schemaVersion: 1,
        aggregateType: "operation",
        aggregateId: createCanonicalId("operation") as OperationId,
        correlationId: createCanonicalId("correlation"),
        causationId: null,
        destination: "test-channel",
        availableAt: toInstant(new Date(Date.now() - 1_000)),
        payload: { message: "hello" },
      }),
    );

    const [claim] = await claimOutboxBatch(pool, {
      workerId: "worker-a",
      destination: "test-channel",
      limit: 10,
      leaseMs: 30_000,
    });
    expect(claim?.outboxEventId).toBe(outboxEventId);

    await expect(
      withTransaction(pool, (client) =>
        settleOutboxClaim(client, {
          outboxEventId,
          workerId: "worker-a",
          fence: (claim?.fence ?? 1) - 1,
          state: "acknowledged",
        }),
      ),
    ).rejects.toMatchObject({
      code: "outbox.stale_claim",
      category: "conflict",
    });

    await withTransaction(pool, (client) =>
      settleOutboxClaim(client, {
        outboxEventId,
        workerId: "worker-a",
        fence: claim!.fence,
        state: "acknowledged",
        terminalReceiptRef: "receipt:test",
      }),
    );

    const persisted = await pool.query<{
      state: string;
      terminal_receipt_ref: string | null;
    }>(
      `SELECT state, terminal_receipt_ref
         FROM events.outbox
        WHERE outbox_event_id = $1`,
      [outboxEventId],
    );

    expect(persisted.rows[0]).toEqual({
      state: "acknowledged",
      terminal_receipt_ref: "receipt:test",
    });
  });
});

import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  toInstant,
  type OperationId,
} from "@masanawa/contracts";
import type { PlatformEvent } from "@masanawa/events";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  claimOutboxBatch,
  createPostgresPool,
  enqueueOutbox,
  prepareOperation,
  persistPlatformEventWithOutbox,
  runMigrations,
  settleOutboxClaim,
  transitionOperation,
  withTransaction,
} from "./index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;
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

  it("commits a platform event and its outbox custody atomically", async () => {
    const occurredAt = toInstant(new Date());
    const event: PlatformEvent<{ message: string }> = {
      eventId: createCanonicalId("event"),
      eventType: "message.requested",
      schemaVersion: 1,
      tenantId: createCanonicalId("tenant"),
      aggregate: {
        type: "operation",
        id: createCanonicalId("operation"),
        revision: 1,
      },
      occurredAt,
      recordedAt: occurredAt,
      actor: null,
      authorityRef: null,
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: { source: "foundation-integration" },
      sensitivity: "internal",
      payload: { message: "hello" },
    };

    const outboxEventId = await persistPlatformEventWithOutbox(pool, {
      event,
      outbox: {
        destination: "test-channel",
        availableAt: occurredAt,
        payload: { eventId: event.eventId, message: "hello" },
      },
    });

    const persisted = await pool.query<{
      event_id: string;
      outbox_event_id: string;
      tenant_id: string;
      event_type: string;
      correlation_id: string;
      destination: string;
    }>(
      `SELECT e.event_id,
              o.outbox_event_id,
              o.tenant_id,
              o.event_type,
              o.correlation_id,
              o.destination
         FROM events.platform_events AS e
         JOIN events.outbox AS o ON o.event_id = e.event_id
        WHERE e.event_id = $1`,
      [event.eventId],
    );

    expect(persisted.rows).toEqual([
      {
        event_id: event.eventId,
        outbox_event_id: outboxEventId,
        tenant_id: event.tenantId,
        event_type: event.eventType,
        correlation_id: event.correlationId,
        destination: "test-channel",
      },
    ]);
  });

  it("rolls back the event when outbox persistence fails", async () => {
    const occurredAt = toInstant(new Date());
    const event: PlatformEvent<{ message: string }> = {
      eventId: createCanonicalId("event"),
      eventType: "message.requested",
      schemaVersion: 1,
      tenantId: createCanonicalId("tenant"),
      aggregate: {
        type: "operation",
        id: createCanonicalId("operation"),
      },
      occurredAt,
      recordedAt: occurredAt,
      actor: null,
      authorityRef: null,
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: { source: "foundation-integration" },
      sensitivity: "internal",
      payload: { message: "rollback-me" },
    };

    await expect(
      persistPlatformEventWithOutbox(pool, {
        event,
        outbox: {
          destination: "   ",
          availableAt: occurredAt,
          payload: { eventId: event.eventId },
        },
      }),
    ).rejects.toThrow("outbox destination is required");

    const eventCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM events.platform_events WHERE event_id = $1",
      [event.eventId],
    );
    const outboxCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM events.outbox WHERE event_id = $1",
      [event.eventId],
    );

    expect(eventCount.rows[0]?.count).toBe("0");
    expect(outboxCount.rows[0]?.count).toBe("0");
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

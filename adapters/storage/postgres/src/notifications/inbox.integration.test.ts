import { fileURLToPath } from "node:url";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import type { Pool } from "pg";
import { createIsolatedPostgresTestDatabase } from "../commerce/isolated-test-database.js";
import { runMigrations } from "../migrations.js";
import { createPostgresInboxRepository } from "./inbox.js";

const database = process.env.MASANAWA_TEST_DATABASE_URL;
const withPostgres = database ? describe : describe.skip;

withPostgres("C08 PG18 fan inbox: migration, persisted read, privacy and retry", () => {
  let isolated: Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
  let pool: Pool;
  beforeAll(async () => {
    isolated = await createIsolatedPostgresTestDatabase(database!);
    pool = isolated.pool;
    const version = Number((await pool.query<{ server_version_num: string }>("SHOW server_version_num"))
      .rows[0]?.server_version_num);
    expect(version).toBeGreaterThanOrEqual(180000);
    expect(version).toBeLessThan(190000);
    const root = fileURLToPath(
      new URL("../../../../../packages/notifications/migrations", import.meta.url),
    );
    const first = await runMigrations(pool, [{ owner: "notifications", directory: root }]);
    expect(first).toEqual(["notifications/0001_fan_inbox.sql"]);
    expect(await runMigrations(pool, [{ owner: "notifications", directory: root }])).toEqual([]);
  });
  afterAll(async () => {
    await isolated?.close();
  });

  it("dedupes retries, prevents cross-account reads and updates, and pages using a keyset", async () => {
    const repo = createPostgresInboxRepository(pool);
    const person = { tenantId: "test_t1", fanUserId: "test_a" };
    const other = { tenantId: "test_t1", fanUserId: "test_b" };
    const otherTenant = { tenantId: "test_t2", fanUserId: "test_a" };
    const one = { ...person, eventId: "event_one", kind: "room_answer" as const,
      targetKind: "room" as const, targetId: "room_one", title: "Answer",
      body: "A Masana answered your question." };
    await repo.deliver(one);
    await repo.deliver(one); // at-least-once canonical outbox retry
    await repo.deliver({ ...one, eventId: "event_two", targetId: "room_two" });
    expect((await repo.list(person, 10)).items).toHaveLength(2);
    expect((await repo.list(other, 10)).items).toHaveLength(0);
    expect((await repo.list(otherTenant, 10)).items).toHaveLength(0);

    const page = await repo.list(person, 1);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    const second = await repo.list(person, 1, page.nextCursor!);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]!.id).not.toBe(page.items[0]!.id);

    const id = page.items[0]!.id;
    expect(await repo.acknowledge(other, id)).toBe(false);
    expect(await repo.acknowledge(otherTenant, id)).toBe(false);
    expect((await repo.list(person, 10)).items[0]!.readAt).toBeNull();
    expect(await repo.acknowledge(person, id)).toBe(true);
    expect(await repo.acknowledge(person, id)).toBe(true);
    const read = (await repo.list(person, 10)).items.find(x => x.id === id);
    expect(read?.readAt).not.toBeNull();
  });

  it("rejects unsupported notification kinds at the SQL boundary", async () => {
    await expect(pool.query(
      "INSERT INTO notifications.fan_inbox " +
      "(tenant_id,fan_user_id,notification_id,source_event_id,kind,target_kind,target_id,title,body) " +
      "VALUES ('t','u','n','event','human_dm','comment','c','Bad','Disallowed')",
    )).rejects.toThrow();
  });
});

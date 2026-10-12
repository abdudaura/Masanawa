import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresPool, platformProductMigrationRoots, readMigrationManifest, runMigrations, type Pool } from "@masanawa/postgres";
import { createPostgresCallHistoryRepository } from "./postgres_repository.js";

const databaseUrl = process.env.MASANAWA_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("Masana call history on PostgreSQL", () => {
  let admin: Pool;
  let pool: Pool;
  let migrationDirectory: string;
  const name = `masana_call_history_${randomUUID().replaceAll("-", "")}`;
  let repository: ReturnType<typeof createPostgresCallHistoryRepository>;
  const scope = { tenantId: "tenant-a", userId: "user-a", characterIds: null };
  const expiresAt = () => new Date(Date.now() + 60_000).toISOString();
  beforeAll(async () => {
    admin = createPostgresPool({ connectionString: databaseUrl!, applicationName: "call-history-test-admin" });
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(databaseUrl!); url.pathname = `/${name}`;
    pool = createPostgresPool({ connectionString: url.toString(), applicationName: "call-history-test" });
    await pool.query("CREATE SCHEMA agents");
    for (const file of ["0002_agent_configurations.sql", "0004_platform_agent_preferences.sql"]) {
      await pool.query(await readFile(new URL(`../../../../packages/agents/migrations/${file}`, import.meta.url), "utf8"));
    }
    migrationDirectory = await mkdtemp(path.join(tmpdir(), "masana-call-migration-"));
    const sql = await readFile(new URL("../../../../packages/agents/migrations/0007_masana_call_history.sql", import.meta.url), "utf8");
    await writeFile(path.join(migrationDirectory, "0007_masana_call_history.sql"), sql);
    expect(await runMigrations(pool, [{ owner: "agents", directory: migrationDirectory }])).toEqual(["agents/0007_masana_call_history.sql"]);
    await pool.query(`INSERT INTO agents.agent_presentations
      (tenant_id,character_id,character_version_id,display_name,role_label)
      VALUES ('tenant-a','masana-a','version-a','Amina','Masana'),
             ('tenant-a','personal-twin','version-b','Old personal Twin','Retired'),
             ('tenant-b','masana-a','version-a','Other tenant','Masana')`);
    await pool.query(`INSERT INTO agents.platform_agent_profiles
      (tenant_id,character_id,voice_provider,voice_name)
      VALUES ('tenant-a','masana-a','gemini','Kore'),('tenant-b','masana-a','gemini','Kore')`);
    repository = createPostgresCallHistoryRepository(pool);
  }, 15_000);
  afterAll(async () => {
    await pool?.end();
    if (migrationDirectory) await rm(migrationDirectory, { recursive: true });
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); await admin.end(); }
  });

  it("is registered in the runtime manifest and safely reruns with the same checksum", async () => {
    expect(await readMigrationManifest(platformProductMigrationRoots())).toContainEqual(expect.objectContaining({ owner: "agents", name: "0007_masana_call_history.sql" }));
    expect(await runMigrations(pool, [{ owner: "agents", directory: migrationDirectory }])).toEqual([]);
  });

  it("records approved Masana only and never leaks another account or tenant", async () => {
    const callId = await repository.recordIssued({ ...scope, characterId: "masana-a", expiresAt: expiresAt() });
    expect(await repository.get({ ...scope, callId })).toMatchObject({ callId, displayName: "Amina", state: "connecting", connectionEvidence: null });
    for (const foreign of [{ userId: "user-b" }, { tenantId: "tenant-b" }, { characterIds: [] }]) {
      expect(await repository.get({ ...scope, ...foreign, callId })).toBeNull();
      expect(await repository.report({ ...scope, ...foreign, callId, event: "ended" })).toBeNull();
    }
    await expect(repository.recordIssued({ ...scope, characterId: "personal-twin", expiresAt: expiresAt() })).rejects.toMatchObject({ statusCode: 403 });
    await expect(repository.recordIssued({ ...scope, characterId: "human-contact", expiresAt: expiresAt() })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps duplicate/racing lifecycle reports idempotent without resurrecting ended calls", async () => {
    const callId = await repository.recordIssued({ ...scope, characterId: "masana-a", expiresAt: expiresAt() });
    const first = await repository.report({ ...scope, callId, event: "connected" });
    expect(first).toMatchObject({ state: "active", connectionEvidence: "client_report" });
    expect((await repository.report({ ...scope, callId, event: "connected" }))?.connectedAt).toBe(first?.connectedAt);
    await Promise.all([repository.report({ ...scope, callId, event: "ended" }), repository.report({ ...scope, callId, event: "connected" })]);
    const ended = await repository.get({ ...scope, callId });
    expect(ended?.state).toBe("ended");
    expect(await repository.report({ ...scope, callId, event: "connected" })).toEqual(ended);
    expect(await repository.report({ ...scope, callId, event: "ended" })).toEqual(ended);
  });

  it("paginates equal timestamps without duplicates and respects current roster visibility", async () => {
    const a = await repository.recordIssued({ ...scope, userId: "paged", characterId: "masana-a", expiresAt: expiresAt() });
    const b = await repository.recordIssued({ ...scope, userId: "paged", characterId: "masana-a", expiresAt: expiresAt() });
    await pool.query("UPDATE agents.masana_call_history SET created_at=date_trunc('second',clock_timestamp()) WHERE user_id='paged'");
    const first = await repository.list({ ...scope, userId: "paged", limit: 1, cursor: null });
    const last = first.calls[0]!;
    const next = await repository.list({ ...scope, userId: "paged", limit: 1, cursor: { createdAt: last.createdAt, callId: last.callId } });
    expect(new Set([last.callId, next.calls[0]?.callId])).toEqual(new Set([a, b]));
    expect(next.nextCursor).toBeNull();
    await pool.query("UPDATE agents.agent_presentations SET visible_in_user_app=false WHERE tenant_id='tenant-a'");
    expect((await repository.list({ ...scope, limit: 30, cursor: null })).calls).toEqual([]);
    await pool.query("UPDATE agents.agent_presentations SET visible_in_user_app=true WHERE tenant_id='tenant-a'");
  });


  it("searches the authorized full history before pagination rather than filtering one page locally", async () => {
    const userId = "search-pages";
    const created = [];
    for (let i = 0; i < 4; i++) {
      const callId = await repository.recordIssued({ ...scope, userId, characterId: "masana-a", expiresAt: expiresAt() });
      created.push(callId);
      await pool.query(
        "UPDATE agents.masana_call_history SET created_at=clock_timestamp()-($2 * interval '1 minute') WHERE call_id=$1",
        [callId, 4 - i],
      );
    }
    const oldest = created[0]!;
    const uniqueIdentifier = oldest.slice(-10);
    const target = await repository.list({ ...scope, userId, limit: 1, cursor: null, query: uniqueIdentifier });
    expect(target.calls.map(call => call.callId)).toEqual([oldest]);
    expect(target.nextCursor).toBeNull();
    const namePage1 = await repository.list({ ...scope, userId, limit: 1, cursor: null, query: "amina" });
    const cursor = namePage1.calls[0]!;
    expect(namePage1.nextCursor).not.toBeNull();
    const namePage2 = await repository.list({ ...scope, userId, limit: 1, cursor: { createdAt: cursor.createdAt, callId: cursor.callId }, query: "amina" });
    expect(namePage2.calls).toHaveLength(1);
    expect(namePage2.calls[0]?.callId).not.toBe(cursor.callId);
    expect((await repository.list({ ...scope, userId: "other-account", limit: 30, cursor: null, query: uniqueIdentifier })).calls).toEqual([]);
    expect((await repository.list({ ...scope, tenantId: "tenant-b", userId, limit: 30, cursor: null, query: uniqueIdentifier })).calls).toEqual([]);
    expect((await repository.list({ ...scope, userId, characterIds: [], limit: 30, cursor: null, query: uniqueIdentifier })).calls).toEqual([]);
  });

  it("does not treat expired credentials as verified connected media", async () => {
    const callId = await repository.recordIssued({ ...scope, characterId: "masana-a", expiresAt: expiresAt() });
    await pool.query("UPDATE agents.masana_call_history SET created_at=clock_timestamp()-interval '2 minutes', expires_at=clock_timestamp()-interval '1 minute' WHERE call_id=$1", [callId]);
    expect(await repository.report({ ...scope, callId, event: "connected" })).toMatchObject({ state: "expired", connectedAt: null, connectionEvidence: null });
  });
});

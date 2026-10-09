import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { createPostgresReplayInsightRepository } from "./postgres_repository.js";

// Executes real SQL in embedded PostgreSQL against a minimal synthetic schema.
// This is not production PG18, canonical-migration or live-provider qualification.
const databases = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.close())); });
async function fixture() {
  const db = new PGlite();
  databases.push(db);
  await db.exec(`
    CREATE SCHEMA talks;
    CREATE TABLE talks.talks (tenant_id text, talk_id text, host_user_id text, state text);
    CREATE TABLE talks.replay_sessions (tenant_id text, talk_id text, recording_id text,
      recording_state text, publication_state text, session_json jsonb, revision integer);
    CREATE TABLE talks.replay_media_jobs (tenant_id text, talk_id text, recording_id text,
      status text, checksum_sha256 text);
    CREATE TABLE talks.safety_enforcement (tenant_id text, target_kind text,
      target_id text, visibility text);
  `);
  const migration = await readFile(new URL("./migration.proposed.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration); // proposed migration remains repeatable
  const checksum = "a".repeat(64);
  await db.query("INSERT INTO talks.talks VALUES ($1,$2,$3,'ended')", ["tenant-a", "talk_1", "host"]);
  await db.query(`INSERT INTO talks.replay_sessions VALUES
    ($1,$2,$3,'finalized','private','{"hostRecordingConsent":true}',4)`, ["tenant-a", "talk_1", "recording_1"]);
  await db.query("INSERT INTO talks.replay_media_jobs VALUES ($1,$2,$3,'ready',$4)", ["tenant-a", "talk_1", "recording_1", checksum]);
  const pool = {
    async query(sql, values) {
      const result = await db.query(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
  const repo = createPostgresReplayInsightRepository(pool);
  const source = { tenantId: "tenant-a", talkId: "talk_1", recordingId: "recording_1",
    checksumSha256: checksum, replayRevision: 4, hostUserId: "host" };
  async function clear() {
    await db.query(`INSERT INTO talks.post_session_processing_clearances
      VALUES ($1,$2,$3,$4,true,'verified-fixture','reviewer',now(),NULL)`,
      [source.tenantId, source.talkId, source.recordingId, checksum]);
  }
  return { db, repo, source, clear };
}
const draft = { summary: "Private summary", highlights: ["Highlight"], nextTalkTitle: null };
describe("U16 executed PostgreSQL consent, lease and readback", () => {
  it("denies missing clearance, wrong host and wrong tenant before generation", async () => {
    const f = await fixture();
    expect(await f.repo.source("tenant-a", "host", "talk_1")).toBeNull();
    expect(await f.repo.claim(f.source, "host", "lease")).toBe(false);
    await f.clear();
    expect(await f.repo.source("tenant-a", "host", "talk_1")).toEqual(f.source);
    expect(await f.repo.source("tenant-a", "guest", "talk_1")).toBeNull();
    expect(await f.repo.source("tenant-b", "host", "talk_1")).toBeNull();
    expect(await f.repo.claim(f.source, "guest", "lease")).toBe(false);
  }, 15000);
  it("executes lease CAS and persisted readback, suppresses duplicates and expired consent", async () => {
    const f = await fixture(); await f.clear();
    expect(await f.repo.claim(f.source, "host", "lease-1")).toBe(true);
    expect(await f.repo.claim(f.source, "host", "lease-2")).toBe(false);
    expect(await f.repo.complete({ source: f.source, leaseToken: "wrong" }, draft)).toBe(false);
    expect(await f.repo.complete({ source: f.source, leaseToken: "lease-1" }, draft)).toBe(true);
    expect(await f.repo.read("tenant-a", "host", "talk_1")).toMatchObject({ status: "ready", ...draft });
    expect(await f.repo.read("tenant-a", "guest", "talk_1")).toBeNull();
    expect(await f.repo.read("tenant-b", "host", "talk_1")).toBeNull();
    expect(await f.repo.claim(f.source, "host", "lease-3")).toBe(false);
    await f.db.exec("UPDATE talks.post_session_insights SET consented_at=now()-interval '31 days'");
    expect(await f.repo.read("tenant-a", "host", "talk_1")).toBeNull();
    expect(await f.repo.claim(f.source, "host", "lease-3")).toBe(true);
  }, 15000);
  it.each(["clearance", "safety", "checksum", "recordingConsent", "media", "finalization"])(
    "fences %s revocation while processing and hides already completed text", async mode => {
      const f = await fixture(); await f.clear();
      expect(await f.repo.claim(f.source, "host", "lease-1")).toBe(true);
      expect(await f.repo.complete({ source: f.source, leaseToken: "lease-1" }, draft)).toBe(true);
      await f.db.exec("UPDATE talks.post_session_insights SET status='failed'");
      expect(await f.repo.claim(f.source, "host", "lease-2")).toBe(true);
      if (mode === "clearance") await f.db.exec("UPDATE talks.post_session_processing_clearances SET revoked_at=now()");
      if (mode === "safety") await f.db.exec("INSERT INTO talks.safety_enforcement VALUES ('tenant-a','replay','recording_1','blocked')");
      if (mode === "checksum") await f.db.exec("UPDATE talks.replay_media_jobs SET checksum_sha256=repeat('b',64)");
      if (mode === "recordingConsent") await f.db.exec(`UPDATE talks.replay_sessions SET session_json='{"hostRecordingConsent":false}'`);
      if (mode === "media") await f.db.exec("UPDATE talks.replay_media_jobs SET status='failed'");
      if (mode === "finalization") await f.db.exec("UPDATE talks.replay_sessions SET recording_state='discarded'");
      expect(await f.repo.source("tenant-a", "host", "talk_1")).toBeNull();
      expect(await f.repo.complete({ source: f.source, leaseToken: "lease-2" }, draft)).toBe(false);
      expect(await f.repo.read("tenant-a", "host", "talk_1")).toBeNull();
      await f.repo.fail({ source: f.source, leaseToken: "lease-2" });
      const rows = await f.db.query("SELECT status,summary FROM talks.post_session_insights");
      expect(rows.rows[0]).toEqual({ status: "failed", summary: null });
    }, 15000);
  it("rejects malformed checksums in both proposed tables and expires stale workers", async () => {
    const f = await fixture(); await f.clear();
    await expect(f.db.exec("UPDATE talks.post_session_processing_clearances SET media_checksum='invalid'")).rejects.toThrow();
    expect(await f.repo.claim(f.source, "host", "lease-1")).toBe(true);
    await expect(f.db.exec("UPDATE talks.post_session_insights SET media_checksum='invalid'")).rejects.toThrow();
    await f.db.exec("UPDATE talks.post_session_insights SET lease_until=now()-interval '1 second'");
    expect(await f.repo.complete({ source: f.source, leaseToken: "lease-1" }, draft)).toBe(false);
    expect(await f.repo.claim(f.source, "host", "lease-2")).toBe(true);
    await f.repo.fail({ source: f.source, leaseToken: "lease-1" });
    expect((await f.repo.read("tenant-a", "host", "talk_1"))?.status).toBe("processing");
  }, 15000);
});

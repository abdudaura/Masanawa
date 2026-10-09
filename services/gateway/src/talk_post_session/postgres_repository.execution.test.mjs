import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPostgresReplayInsightRepository } from "./postgres_repository.js";
import { composeReplayInsights } from "./composition.js";
import { registerReplayInsightRoutes } from "./routes.js";
import { ReplayInsightError } from "./service.js";

// Executes unchanged canonical DDL and the real repository SQL on an embedded
// PostgreSQL engine. Not PG18 server/concurrent-session/provider qualification.
const db = new PGlite();
const pool = {
  async query(sql, values) {
    const result = await db.query(sql, values);
    return {rows: result.rows, rowCount: result.affectedRows ?? result.rows.length};
  },
};
const repo = createPostgresReplayInsightRepository(pool);
const audio = new TextEncoder().encode("OggS-synthetic-audio-fixture");
const checksum = createHash("sha256").update(audio).digest("hex");
const draft = {summary:"Private Host draft", highlights:["One point"], nextTalkTitle:null};
async function source() {
  const result = await repo.source("tenant-a", "host", "talk_1");
  expect(result).not.toBeNull();
  return result;
}
async function clearance() {
  await db.query(`INSERT INTO talks.post_session_processing_clearances
    VALUES ('tenant-a','talk_1','recording_1',$1,true,'verified-receipts','reviewer',now(),NULL)`, [checksum]);
}
beforeAll(async () => {
  for (const path of [
    "packages/talks/migrations/0001_talks_foundation.sql",
    "packages/talks/migrations/0006_talk_replay.sql",
    "packages/talks/migrations/0007_talk_replay_media.sql",
    "packages/talks/migrations/0009_talk_safety.sql",
    "services/gateway/src/talk_post_session/migration.proposed.sql",
  ]) await db.exec(await readFile(path, "utf8"));
});
beforeEach(async () => {
  await db.exec(`TRUNCATE talks.post_session_insights,
    talks.post_session_processing_clearances, talks.replay_media_jobs,
    talks.replay_sessions, talks.safety_enforcement, talks.talks CASCADE;
    INSERT INTO talks.talks (tenant_id,talk_id,host_user_id,host_name,title,topic,state,created_at,updated_at)
    VALUES ('tenant-a','talk_1','host','Host','Title','Topic','ended',now(),now());
    INSERT INTO talks.replay_sessions VALUES
    ('tenant-a','talk_1','recording_1','host',4,'finalized','private','private',
     '{"hostRecordingConsent":true}',now(),now(),now(),NULL);`);
  await db.query(`INSERT INTO talks.replay_media_jobs VALUES
    ('tenant-a','talk_1','recording_1','egress-1','private/audio.ogg','ready',now(),now(),$1)`, [checksum]);
});
afterAll(async () => { await db.close(); });

describe("U16 executed canonical-schema SQL", () => {
  it("executes authenticated HTTP through SQL, verified bytes, injected provider, persistence and restart readback", async () => {
    await clearance(); let providerCalls=0;
    const service=composeReplayInsights({pool,
      authorizer:{async authorize({authorizationHeader}) {
        if (authorizationHeader!=="Bearer host") throw new ReplayInsightError("unauthorized",401);
        return {tenantId:"tenant-a",userId:"host"};
      }},
      media:{async current(){return {status:"ready",checksumSha256:checksum,objectKey:"private/audio.ogg"};},
        async playbackObject(){return {objectKey:"private/audio.ogg"};}},
      objects:{async presignGet(){return {url:"https://storage.example/audio.ogg",expiresAt:new Date(Date.now()+90000).toISOString()};}},
      credentials:{apiKeys:["synthetic-test-key"],models:["synthetic-model"]},
      objectOrigin:"https://storage.example",
      async fetchImpl(url) {
        if (new URL(url).origin==="https://storage.example") return new Response(audio);
        providerCalls++;
        return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(draft)}]}}]});
      },
    });
    const app=Fastify(); registerReplayInsightRoutes(app,service);
    const url="/talks/talk_1/post-session/insights";
    try {
      expect((await app.inject({url})).statusCode).toBe(401);
      expect((await app.inject({url,headers:{authorization:"Bearer host"}})).json().status).toBe("eligible");
      const first=await app.inject({method:"POST",url,headers:{authorization:"Bearer host"},payload:{processingConsent:true}});
      expect(first.statusCode).toBe(200); expect(first.json()).toMatchObject({status:"ready",...draft});
      const repeated=await app.inject({method:"POST",url,headers:{authorization:"Bearer host"},payload:{processingConsent:true}});
      expect(repeated.json()).toEqual(first.json()); expect(providerCalls).toBe(1);
      expect(await createPostgresReplayInsightRepository(pool).read("tenant-a","host","talk_1"))
        .toMatchObject({status:"ready",...draft});
      await db.exec("UPDATE talks.post_session_processing_clearances SET revoked_at=now()");
      expect((await app.inject({url,headers:{authorization:"Bearer host"}})).statusCode).toBe(404);
      expect(providerCalls).toBe(1);
    } finally {await app.close();}
  });
  it("fences replay revision changes and mismatched recording Host identities", async () => {
    await clearance(); const s=await source();
    await db.exec("UPDATE talks.replay_sessions SET revision=5");
    expect(await repo.claim(s,"host","stale")).toBe(false);
    const fresh=await source(); expect(await repo.claim(fresh,"host","new")).toBe(true);
    await db.exec("UPDATE talks.replay_sessions SET revision=6");
    expect(await repo.complete({source:fresh,leaseToken:"new"},draft)).toBe(false);
    await db.exec("UPDATE talks.replay_sessions SET host_user_id='former-host'");
    expect(await repo.source("tenant-a","host","talk_1")).toBeNull();
    expect(await repo.read("tenant-a","host","talk_1")).toBeNull();
  });
  it("refuses absent clearance, wrong tenant and guests; accepts reviewed Host source", async () => {
    expect(await repo.source("tenant-a","host","talk_1")).toBeNull();
    await clearance();
    expect(await repo.source("tenant-b","host","talk_1")).toBeNull();
    expect(await repo.source("tenant-a","guest","talk_1")).toBeNull();
    expect(await source()).toMatchObject({hostUserId:"host", replayRevision:4, checksumSha256:checksum});
  });
  it("persists one lease, completes private draft, reads it back after repository restart", async () => {
    await clearance(); const s = await source();
    expect(await repo.claim(s,"host","lease-1")).toBe(true);
    expect(await repo.claim(s,"host","lease-2")).toBe(false);
    expect(await repo.read("tenant-a","host","talk_1")).toMatchObject({status:"processing",summary:null});
    expect(await repo.complete({source:s,leaseToken:"lease-2"},draft)).toBe(false);
    expect(await repo.complete({source:s,leaseToken:"lease-1"},draft)).toBe(true);
    expect(await createPostgresReplayInsightRepository(pool).read("tenant-a","host","talk_1"))
      .toMatchObject({status:"ready",...draft});
    expect(await repo.read("tenant-a","guest","talk_1")).toBeNull();
    expect(await repo.claim(s,"host","lease-3")).toBe(false);
  });
  it("denies stale source after clearance revocation at claim, completion and read", async () => {
    await clearance(); const s = await source();
    await db.exec("UPDATE talks.post_session_processing_clearances SET revoked_at=now()");
    expect(await repo.claim(s,"host","lease-1")).toBe(false);
    await db.exec("UPDATE talks.post_session_processing_clearances SET revoked_at=NULL");
    expect(await repo.claim(s,"host","lease-1")).toBe(true);
    await db.exec("UPDATE talks.post_session_processing_clearances SET revoked_at=now()");
    expect(await repo.complete({source:s,leaseToken:"lease-1"},draft)).toBe(false);
    expect(await repo.read("tenant-a","host","talk_1")).toBeNull();
  });
  it("reclaims expired leases and fences both late completion and late failure", async () => {
    await clearance(); const s = await source();
    await repo.claim(s,"host","old");
    await db.exec("UPDATE talks.post_session_insights SET lease_until=now()-interval '1 second'");
    expect(await repo.complete({source:s,leaseToken:"old"},draft)).toBe(false);
    expect(await repo.claim(s,"host","new")).toBe(true);
    await repo.fail({source:s,leaseToken:"old"});
    expect(await repo.read("tenant-a","host","talk_1")).toMatchObject({status:"processing"});
    expect(await repo.complete({source:s,leaseToken:"new"},draft)).toBe(true);
  });
  it("does not disclose stored drafts after moderation, checksum change or retention expiry", async () => {
    await clearance(); const s = await source();
    await repo.claim(s,"host","lease"); await repo.complete({source:s,leaseToken:"lease"},draft);
    await db.exec(`INSERT INTO talks.safety_enforcement VALUES
      ('tenant-a','replay','recording_1',1,'restricted','privacy',now())`);
    expect(await repo.source("tenant-a","host","talk_1")).toBeNull();
    expect(await repo.read("tenant-a","host","talk_1")).toBeNull();
    await db.exec("DELETE FROM talks.safety_enforcement");
    await db.query("UPDATE talks.replay_media_jobs SET checksum_sha256=$1", ["b".repeat(64)]);
    expect(await repo.read("tenant-a","host","talk_1")).toBeNull();
    await db.query("UPDATE talks.replay_media_jobs SET checksum_sha256=$1", [checksum]);
    await db.exec("UPDATE talks.post_session_insights SET consented_at=now()-interval '31 days'");
    expect(await repo.read("tenant-a","host","talk_1")).toBeNull();
    expect(await repo.claim(s,"host","renewed")).toBe(true);
  });
  it("fails and retries without leaking draft data or allowing non-Host acquisition", async () => {
    await clearance(); const s = await source();
    expect(await repo.claim(s,"guest","guest-lease")).toBe(false);
    await repo.claim(s,"host","lease"); await repo.fail({source:s,leaseToken:"lease"});
    expect(await repo.read("tenant-a","host","talk_1")).toMatchObject({status:"failed",summary:null,highlights:[]});
    expect(await repo.claim(s,"host","retry")).toBe(true);
  });
});

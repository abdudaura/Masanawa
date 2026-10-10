import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  createPostgresAccountDeletionRepository,
  createPostgresAccountDeletionChallengeRepository,
} from "./account-deletion.js";
import { createPostgresPlatformSessionRepository } from "../security/platform-session.js";
import { runMigrations } from "../migrations.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R12 durable PostgreSQL deletion request", () => {
  let pool: Pool;
  const tenantId = createCanonicalId("tenant");
  let userId = createCanonicalId("user");
  const createdAt = new Date().toISOString();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [
      { owner: "events", directory: fileURLToPath(new URL("../../../../../packages/events/migrations", import.meta.url)) },
      { owner: "security", directory: fileURLToPath(new URL("../../../../../packages/security/migrations", import.meta.url)) },
      { owner: "identity", directory: fileURLToPath(new URL("../../../../../packages/identity/migrations", import.meta.url)) },
    ]);
    const profiles = createPostgresPlatformSessionRepository(pool);
    const profile = await profiles.createProfile({
      tenantId, channel: "email", identifier: `delete-${tenantId.slice(-8)}@example.com`,
      name: "Deletion Test", locale: "en", createdAt,
    });
    userId = profile.userId;
  });
  afterAll(async () => { await pool?.end(); });

  it("onboards multiple email-only customers without falsely colliding on NULL phone", async () => {
    const profiles = createPostgresPlatformSessionRepository(pool);
    const firstEmail = `first-${randomUUID()}@example.com`;
    const secondEmail = `second-${randomUUID()}@example.com`;
    const first = await profiles.createProfile({
      tenantId, channel: "email", identifier: firstEmail,
      name: "Email First", locale: "en", createdAt,
    });
    const second = await profiles.createProfile({
      tenantId, channel: "email", identifier: secondEmail,
      name: "Email Second", locale: "en", createdAt,
    });
    expect(second.userId).not.toBe(first.userId);
    expect(first.phone).toBeNull();
    expect(second.phone).toBeNull();
    const duplicate = await profiles.createProfile({
      tenantId, channel: "email", identifier: firstEmail,
      name: "Different Name", locale: "en", createdAt,
    });
    expect(duplicate.userId).toBe(first.userId);
  });

  it("creates once under concurrent requests and persists one audit event", async () => {
    const requests = createPostgresAccountDeletionRepository(pool);
    const [a, b] = await Promise.all([
      requests.open({ tenantId, userId, requestId: randomUUID(), now: createdAt }),
      requests.open({ tenantId, userId, requestId: randomUUID(), now: createdAt }),
    ]);
    expect(a.requestId).toBe(b.requestId);
    expect(a.phase).toBe("requested");
    const history = await pool.query<{ revision: string }>(
      `SELECT revision::text FROM identity.account_deletion_events
        WHERE request_id=$1::uuid`, [a.requestId],
    );
    expect(history.rows).toHaveLength(1);
  });

  it("does not leak another owner's request and enforces revision CAS", async () => {
    const requests = createPostgresAccountDeletionRepository(pool);
    const found = await requests.read({ tenantId, userId });
    expect(found).not.toBeNull();
    expect(await requests.read({ tenantId, userId: createCanonicalId("user") })).toBeNull();
    await expect(requests.transition({
      tenantId, userId, expectedRevision: 900,
      target: "failed", now: createdAt, errorCode: "transient",
    })).rejects.toThrow("account_deletion.conflict");
    const challenge = createPostgresAccountDeletionChallengeRepository(pool);
    const digest = "d".repeat(64);
    await challenge.put({
      tenantId, userId, requestId: found!.requestId, codeHash: digest,
      channel: "email", now: createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 600000).toISOString(),
      resendAfter: new Date(Date.parse(createdAt) + 60000).toISOString(),
    });
    const verifiedOutcome = await challenge.verify({
      tenantId, userId, requestId: found!.requestId,
      expectedRevision: found!.revision, codeHash: digest, now: createdAt,
    });
    expect(verifiedOutcome.result).toBe("accepted");
    if (verifiedOutcome.result !== "accepted") throw new Error("Expected accepted request");
    const verified = verifiedOutcome.request;
    expect(verified.phase).toBe("identity-verified");
    expect(verified.revision).toBe(found!.revision + 1);
    await expect(requests.transition({
      tenantId, userId, expectedRevision: verified.revision,
      target: "processing", now: createdAt,
      outstandingObligations: ["unsettled payment"],
    })).rejects.toThrow("account_deletion.outstanding_obligations");
    const saved = await requests.read({ tenantId, userId });
    expect(saved?.phase).toBe("identity-verified");
  });

  it("rate-limits and one-time consumes a dedicated challenge", async () => {
    const profiles = createPostgresPlatformSessionRepository(pool);
    const secondary = await profiles.createProfile({
      tenantId,
      channel: "email",
      identifier: `delete-secondary-${tenantId.slice(-8)}@example.com`,
      name: "Second Customer",
      locale: "en",
      createdAt,
    });
    const reqs = createPostgresAccountDeletionRepository(pool);
    const request = await reqs.open({
      tenantId, userId: secondary.userId, requestId: randomUUID(), now: createdAt,
    });
    const challenges = createPostgresAccountDeletionChallengeRepository(pool);
    const correct = "a".repeat(64);
    const wrong = "b".repeat(64);
    const expiresAt = new Date(Date.parse(createdAt)+600000).toISOString();
    const resendAfter = new Date(Date.parse(createdAt)+60000).toISOString();
    await challenges.put({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, channel: "email", now: createdAt, expiresAt, resendAfter,
    });
    await expect(challenges.put({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, channel: "email",
      now: new Date(Date.parse(createdAt)+1000).toISOString(),
      expiresAt, resendAfter,
    })).rejects.toThrow("account_deletion.challenge_cooldown");
    const invalid = await challenges.verify({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      expectedRevision: 1, codeHash: wrong, now: createdAt,
    });
    expect(invalid).toEqual({ result: "invalid" });
    const verified = await challenges.verify({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      expectedRevision: 1, codeHash: correct, now: createdAt,
    });
    expect(verified.result).toBe("accepted");
    if (verified.result !== "accepted") throw new Error("Expected verified request");
    expect(verified.request.phase).toBe("identity-verified");
    expect(verified.request.revision).toBe(2);
    const replay = await challenges.verify({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      expectedRevision: 1, codeHash: correct, now: createdAt,
    });
    expect(replay).toEqual({ result: "already-verified" });
    const history = await pool.query<{ revision: string }>(
      `SELECT revision::text
         FROM identity.account_deletion_events
        WHERE request_id=$1::uuid ORDER BY revision`,
      [request.requestId],
    );
    expect(history.rows.map((row) => row.revision)).toEqual(["1", "2"]);
    const recorded = await pool.query<{ code_hash: string }>(
      `SELECT code_hash FROM identity.account_deletion_challenges
        WHERE tenant_id=$1 AND user_id=$2`,
      [tenantId, secondary.userId],
    );
    expect(recorded.rows[0]?.code_hash).toBe(correct);
    await expect(challenges.put({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, channel: "email", now: expiresAt,
      expiresAt: new Date(Date.parse(expiresAt)+600000).toISOString(),
      resendAfter: new Date(Date.parse(expiresAt)+60000).toISOString(),
    })).rejects.toThrow("account_deletion.verification_not_available");
  });

  it("rolls back code consumption when audit append fails, preserving retryability", async () => {
    const profiles = createPostgresPlatformSessionRepository(pool);
    const profile = await profiles.createProfile({
      tenantId, channel: "email",
      identifier: `delete-rollback-${randomUUID()}@example.com`,
      name: "Rollback Customer", locale: "en", createdAt,
    });
    const requests = createPostgresAccountDeletionRepository(pool);
    const request = await requests.open({
      tenantId, userId: profile.userId, requestId: randomUUID(), now: createdAt,
    });
    const challenge = createPostgresAccountDeletionChallengeRepository(pool);
    const digest = "c".repeat(64);
    await challenge.put({
      tenantId, userId: profile.userId, requestId: request.requestId,
      codeHash: digest, channel: "email", now: createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 600000).toISOString(),
      resendAfter: new Date(Date.parse(createdAt) + 60000).toISOString(),
    });
    // An injected audit uniqueness collision simulates a failure after
    // the request update and before the challenge consume.
    await pool.query(
      `INSERT INTO identity.account_deletion_events(request_id,revision,phase,occurred_at)
         VALUES ($1::uuid,2,'identity-verified',$2)`,
      [request.requestId, createdAt],
    );
    await expect(challenge.verify({
      tenantId, userId: profile.userId, requestId: request.requestId,
      expectedRevision: 1, codeHash: digest, now: createdAt,
    })).rejects.toThrow();
    const unchanged = await requests.read({ tenantId, userId: profile.userId });
    expect(unchanged?.phase).toBe("requested");
    expect(unchanged?.revision).toBe(1);
    const result = await pool.query<{ consumed_at: Date | null }>(
      `SELECT consumed_at FROM identity.account_deletion_challenges
         WHERE tenant_id=$1 AND user_id=$2`,
      [tenantId, profile.userId],
    );
    expect(result.rows[0]?.consumed_at).toBeNull();
  });

  it("re-verifies a failed request without clearing existing settlement obligations", async () => {
    const profile = await createPostgresPlatformSessionRepository(pool).createProfile({
      tenantId, channel: "email",
      identifier: `delete-recovery-${randomUUID()}@example.com`,
      name: "Recovery Customer", locale: "en", createdAt,
    });
    const requests = createPostgresAccountDeletionRepository(pool);
    const opened = await requests.open({
      tenantId, userId: profile.userId, requestId: randomUUID(), now: createdAt,
    });
    const failed = await requests.transition({
      tenantId, userId: profile.userId, expectedRevision: opened.revision,
      target: "failed", now: createdAt, errorCode: "provider_unavailable",
      outstandingObligations: ["unsettled transfer"],
    });
    const challenge = createPostgresAccountDeletionChallengeRepository(pool);
    const codeHash = "e".repeat(64);
    await challenge.put({
      tenantId, userId: profile.userId, requestId: opened.requestId,
      codeHash, channel: "email", now: createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 600000).toISOString(),
      resendAfter: new Date(Date.parse(createdAt) + 60000).toISOString(),
    });
    const verified = await challenge.verify({
      tenantId, userId: profile.userId, requestId: opened.requestId,
      codeHash, expectedRevision: failed.revision, now: createdAt,
    });
    expect(verified.result).toBe("accepted");
    if (verified.result !== "accepted") throw new Error("Expected accepted retry");
    expect(verified.request.revision).toBe(3);
    expect(verified.request.phase).toBe("identity-verified");
    expect(verified.request.outstandingObligations).toEqual(["unsettled transfer"]);
    await expect(requests.transition({
      tenantId, userId: profile.userId, expectedRevision: 3,
      target: "processing", now: createdAt,
    })).rejects.toThrow("account_deletion.outstanding_obligations");
    const audit = await pool.query<{ revision: string; phase: string }>(
      `SELECT revision::text,phase FROM identity.account_deletion_events
       WHERE request_id=$1::uuid ORDER BY revision`,
      [opened.requestId],
    );
    expect(audit.rows).toEqual([
      { revision: "1", phase: "requested" },
      { revision: "2", phase: "failed" },
      { revision: "3", phase: "identity-verified" },
    ]);
  });

  it("refuses audit-event tampering", async () => {
    const request = await createPostgresAccountDeletionRepository(pool).read({ tenantId, userId });
    await expect(pool.query(
      `DELETE FROM identity.account_deletion_events WHERE request_id=$1::uuid`,
      [request!.requestId],
    )).rejects.toThrow(/append-only/);
  });
});

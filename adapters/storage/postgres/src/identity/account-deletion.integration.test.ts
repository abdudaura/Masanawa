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
      target: "identity-verified", now: createdAt, identityReauthenticated: true,
    })).rejects.toThrow("account_deletion.conflict");
    const verified = await requests.transition({
      tenantId, userId, expectedRevision: found!.revision,
      target: "identity-verified", now: createdAt, identityReauthenticated: true,
    });
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
    expect(await challenges.consume({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: wrong, now: createdAt,
    })).toBe("invalid");
    expect(await challenges.consume({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, now: createdAt,
    })).toBe("accepted");
    expect(await challenges.consume({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, now: createdAt,
    })).toBe("locked");
    const recorded = await pool.query<{ code_hash: string }>(
      `SELECT code_hash FROM identity.account_deletion_challenges
        WHERE tenant_id=$1 AND user_id=$2`,
      [tenantId, secondary.userId],
    );
    expect(recorded.rows[0]?.code_hash).toBe(correct);
    await reqs.transition({
      tenantId, userId: secondary.userId, expectedRevision: 1,
      target: "identity-verified", now: createdAt,
      identityReauthenticated: true,
    });
    await expect(challenges.put({
      tenantId, userId: secondary.userId, requestId: request.requestId,
      codeHash: correct, channel: "email", now: expiresAt,
      expiresAt: new Date(Date.parse(expiresAt)+600000).toISOString(),
      resendAfter: new Date(Date.parse(expiresAt)+60000).toISOString(),
    })).rejects.toThrow("account_deletion.verification_not_available");
  });

  it("refuses audit-event tampering", async () => {
    const request = await createPostgresAccountDeletionRepository(pool).read({ tenantId, userId });
    await expect(pool.query(
      `DELETE FROM identity.account_deletion_events WHERE request_id=$1::uuid`,
      [request!.requestId],
    )).rejects.toThrow(/append-only/);
  });
});

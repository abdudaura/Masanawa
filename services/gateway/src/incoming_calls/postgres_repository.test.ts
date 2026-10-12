import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createPostgresPool, type Pool } from "@masanawa/postgres";
import { createPostgresIncomingCallRepository } from "./postgres_repository.js";
import { createPostgresCallHistoryRepository } from "../call_history/postgres_repository.js";
const url = process.env.MASANAWA_TEST_DATABASE_URL;
describe.skipIf(!url)("incoming PostgreSQL authority and races", () => {
  let admin: Pool, pool: Pool;
  let repo: ReturnType<typeof createPostgresIncomingCallRepository>;
  const name = "incoming_" + randomUUID().replaceAll("-", "");
  const actor = { tenantId: "a", userId: "u", characterIds: null };
  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: url!,
      applicationName: "incoming-admin",
    });
    await admin.query(`CREATE DATABASE "${name}"`);
    const u = new URL(url!);
    u.pathname = "/" + name;
    pool = createPostgresPool({
      connectionString: u.toString(),
      applicationName: "incoming-tests",
    });
    await pool.query("CREATE SCHEMA agents");
    for (const f of [
      "0002_agent_configurations.sql",
      "0004_platform_agent_preferences.sql",
      "0007_masana_call_history.sql",
      "0009_masana_incoming_calls.sql",
    ])
      await pool.query(
        await readFile(
          new URL(
            "../../../../packages/agents/migrations/" + f,
            import.meta.url,
          ),
          "utf8",
        ),
      );
    await pool.query(
      `INSERT INTO agents.agent_presentations(tenant_id,character_id,character_version_id,display_name,role_label) VALUES('a','masana','v','Amina','Masana'),('a','twin','v','Twin','retired'); INSERT INTO agents.platform_agent_profiles(tenant_id,character_id,voice_provider,voice_name) VALUES('a','masana','gemini','Kore')`,
    );
    repo = createPostgresIncomingCallRepository(pool);
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS "${name}" WITH(FORCE)`);
    await admin?.end();
  });
  const initiate = (requestId: string) =>
    repo.initiate({
      ...actor,
      characterId: "masana",
      requestId,
      ringDurationMs: 60000,
    });
  it("idempotently initiates and denies non-platform identities", async () => {
    const [a, b] = await Promise.all([initiate("same"), initiate("same")]);
    expect(a.callId).toBe(b.callId);
    await expect(
      repo.initiate({ ...actor, characterId: "twin", requestId: "bad" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      repo.initiate({ ...actor, characterId: "twin", requestId: "same" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("fences tenant account and persona reads/actions", async () => {
    const c = await initiate("scoped");
    for (const denied of [
      { ...actor, tenantId: "b" },
      { ...actor, userId: "x" },
      { ...actor, characterIds: [] },
    ]) {
      expect(await repo.get({ ...denied, callId: c.callId })).toBeNull();
      expect(
        await repo.transition({
          ...denied,
          callId: c.callId,
          state: "accepted",
        }),
      ).toBeNull();
    }
  });
  it("serializes accept/cancel and never revives terminals", async () => {
    const c = await initiate("race");
    const results = await Promise.all([
      repo.transition({ ...actor, callId: c.callId, state: "accepted" }),
      repo.transition({ ...actor, callId: c.callId, state: "cancelled" }),
    ]);
    expect(results[0]?.state).toBe(results[1]?.state);
    expect(
      (await repo.transition({ ...actor, callId: c.callId, state: "declined" }))
        ?.state,
    ).toBe(results[0]?.state);
  });
  it("expires without client and creates exactly one missed history", async () => {
    const c = await initiate("expired");
    await pool.query(
      `UPDATE agents.masana_incoming_calls SET created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE call_id=$1`,
      [c.callId],
    );
    await Promise.all([repo.expire(), repo.expire()]);
    expect((await repo.get({ ...actor, callId: c.callId }))?.state).toBe(
      "missed",
    );
    const h = await createPostgresCallHistoryRepository(pool).get({
      ...actor,
      callId: c.callId,
    });
    expect(h).toMatchObject({ direction: "incoming", state: "missed" });
    expect(
      (await repo.transition({ ...actor, callId: c.callId, state: "accepted" }))
        ?.state,
    ).toBe("missed");
  });
  it("attaches token history without outgoing duplicate and token claim is exclusive", async () => {
    const c = await initiate("token");
    await repo.transition({ ...actor, callId: c.callId, state: "accepted" });
    const claims = await Promise.all([
      repo.claimToken({ ...actor, callId: c.callId, admissionId: "paid" }),
      repo.claimToken({ ...actor, callId: c.callId, admissionId: "paid" }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const h = createPostgresCallHistoryRepository(pool);
    expect(
      await h.attachIssued!({
        ...actor,
        characterId: "masana",
        callId: c.callId,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      }),
    ).toBe(c.callId);
    await repo.finishToken({ ...actor, callId: c.callId, success: true });
    expect(
      await repo.claimToken({
        ...actor,
        callId: c.callId,
        admissionId: "paid",
      }),
    ).toBe(false);
    expect(
      (
        await pool.query(
          "SELECT * FROM agents.masana_call_history WHERE call_id=$1",
          [c.callId],
        )
      ).rowCount,
    ).toBe(1);
  });
  it("recovers crashed issuance without remint and ends informational history", async () => {
    const c = await initiate("crash");
    await repo.transition({ ...actor, callId: c.callId, state: "accepted" });
    await repo.claimToken({ ...actor, callId: c.callId, admissionId: "paid" });
    await pool.query(
      `UPDATE agents.masana_incoming_calls SET token_started_at=clock_timestamp()-interval '2 minutes' WHERE call_id=$1`,
      [c.callId],
    );
    await repo.expire();
    expect(
      (
        await pool.query(
          "SELECT token_status FROM agents.masana_incoming_calls WHERE call_id=$1",
          [c.callId],
        )
      ).rows[0]?.token_status,
    ).toBe("unknown");
    expect(
      await repo.claimToken({
        ...actor,
        callId: c.callId,
        admissionId: "paid",
      }),
    ).toBe(false);
    expect(
      (
        await pool.query(
          "SELECT ended_at FROM agents.masana_call_history WHERE call_id=$1",
          [c.callId],
        )
      ).rows[0]?.ended_at,
    ).toBeTruthy();
  });
  it("push retries after failure and suppresses expired invitation", async () => {
    await pool.query(
      `UPDATE agents.masana_incoming_push_outbox SET delivered_at=clock_timestamp()`,
    );
    const c = await initiate("push");
    const job = await repo.claimPush();
    expect(job?.call.callId).toBe(c.callId);
    expect(await repo.claimPush()).toBeNull();
    await repo.finishPush({
      callId: c.callId,
      leaseId: job!.leaseId,
      delivered: false,
    });
    await pool.query(
      `UPDATE agents.masana_incoming_push_outbox SET available_at=clock_timestamp()-interval '1 second' WHERE call_id=$1`,
      [c.callId],
    );
    expect((await repo.claimPush())?.call.callId).toBe(c.callId);
    await pool.query(
      `UPDATE agents.masana_incoming_calls SET created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE call_id=$1`,
      [c.callId],
    );
    expect(await repo.claimPush()).toBeNull();
  });
});

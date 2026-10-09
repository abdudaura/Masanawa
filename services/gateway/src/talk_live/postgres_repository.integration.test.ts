import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresPool, runMigrations, type Pool } from "@masanawa/postgres";
import { createPostgresTalkLiveRepository } from "./postgres_repository.js";

const databaseUrl = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("R02 live Host lease PostgreSQL acceptance", () => {
  let pool: Pool;
  const tenants: string[] = [];

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: databaseUrl!,
      applicationName: "masanawa-r02-session-integration-test",
      max: 4,
    });
    await runMigrations(pool, [{
      owner: "talks",
      directory: fileURLToPath(
        new URL("../../../../packages/talks/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    if (!pool) return;
    for (const tenantId of tenants) {
      await pool.query("DELETE FROM talks.live_sessions WHERE tenant_id = $1", [tenantId]);
      await pool.query("DELETE FROM talks.live_runtime WHERE tenant_id = $1", [tenantId]);
      await pool.query("DELETE FROM talks.live_canonical WHERE tenant_id = $1", [tenantId]);
      await pool.query("DELETE FROM talks.talks WHERE tenant_id = $1", [tenantId]);
    }
    await pool.end();
  });

  async function fixture(talkId = `talk_${randomUUID()}`) {
    const tenantId = `tenant_${randomUUID()}`;
    const hostUserId = `user_${randomUUID()}`;
    const at = new Date().toISOString();
    tenants.push(tenantId);
    await pool.query(
      `INSERT INTO talks.talks
        (tenant_id,talk_id,host_user_id,host_name,title,topic,state,
         started_at,created_at,updated_at)
       VALUES ($1,$2,$3,'Host','Audio verification','Reconnect test','live',$4,$4,$4)`,
      [tenantId, talkId, hostUserId, at],
    );
    return {
      tenantId, talkId, userId: hostUserId,
      now: at,
      reconnectGraceMs: 30_000,
    };
  }

  it("atomically replaces one connected Host lease and rejects superseded heartbeat", async () => {
    const input = await fixture();
    const repository = createPostgresTalkLiveRepository(pool);
    const firstId = `talk-live_${randomUUID()}`;
    const secondId = `talk-live_${randomUUID()}`;

    expect(await repository.connect({ ...input, sessionId: firstId }))
      .toMatchObject({ sessionId: firstId, role: "host", canPublishAudio: true });
    expect(await repository.connect({ ...input, sessionId: secondId }))
      .toMatchObject({ sessionId: secondId, role: "host", canPublishAudio: true });

    const active = await pool.query<{ session_id: string }>(
      `SELECT session_id FROM talks.live_sessions
        WHERE tenant_id=$1 AND talk_id=$2 AND role='host' AND connection_state='connected'`,
      [input.tenantId, input.talkId],
    );
    expect(active.rows).toEqual([{ session_id: secondId }]);
    expect(await repository.heartbeat({ ...input, sessionId: firstId })).toBeNull();
    expect(await repository.disconnect({ ...input, sessionId: firstId })).toBeNull();
    expect(await repository.heartbeat({ ...input, sessionId: secondId }))
      .toMatchObject({ role: "host", canPublishAudio: true, state: "live" });

    const state = await repository.state(input);
    expect(state).toMatchObject({ state: "live", hostConnected: true, aiGenerationAllowed: true });
  });

  it("serializes racing Host session connects under the existing partial unique index", async () => {
    const input = await fixture();
    const repository = createPostgresTalkLiveRepository(pool);
    const firstId = `talk-live_${randomUUID()}`;
    const secondId = `talk-live_${randomUUID()}`;

    const results = await Promise.all([
      repository.connect({ ...input, sessionId: firstId }),
      repository.connect({ ...input, sessionId: secondId }),
    ]);
    expect(results.every((session) => session?.role === "host")).toBe(true);

    const current = await pool.query<{ session_id: string }>(
      `SELECT session_id FROM talks.live_sessions
        WHERE tenant_id=$1 AND talk_id=$2 AND role='host' AND connection_state='connected'`,
      [input.tenantId, input.talkId],
    );
    expect(current.rows).toHaveLength(1);
    expect([firstId, secondId]).toContain(current.rows[0]!.session_id);
    const invalidId = current.rows[0]!.session_id === firstId ? secondId : firstId;
    expect(await repository.heartbeat({ ...input, sessionId: invalidId })).toBeNull();
  });

  it("does not resurrect ended Talks or cross tenant boundaries", async () => {
    const sharedTalkId = `talk_${randomUUID()}`;
    const alpha = await fixture(sharedTalkId);
    const beta = await fixture(sharedTalkId);
    const repository = createPostgresTalkLiveRepository(pool);
    const a = `talk-live_${randomUUID()}`;
    const b = `talk-live_${randomUUID()}`;

    await repository.connect({ ...alpha, sessionId: a });
    await repository.connect({ ...beta, sessionId: b });
    await pool.query(
      "UPDATE talks.talks SET state='ended',ended_at=$3 WHERE tenant_id=$1 AND talk_id=$2",
      [alpha.tenantId, alpha.talkId, new Date().toISOString()],
    );
    const ended = await repository.state(alpha);
    expect(ended).toMatchObject({ state: "ended", hostConnected: false, aiGenerationAllowed: false });
    expect(await repository.heartbeat({ ...alpha, sessionId: a })).toBeNull();
    await expect(repository.connect({
      ...alpha, sessionId: `talk-live_${randomUUID()}`,
    })).rejects.toThrow("talks.live.ended");
    expect(await repository.heartbeat({ ...beta, sessionId: b }))
      .toMatchObject({ role: "host", state: "live", canPublishAudio: true });
  });
});

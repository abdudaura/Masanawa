import { describe, expect, it } from "vitest";
import {
  createPostgresTalkLiveRepository,
  type TalkLiveSqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk live repository", () => {
  it("derives Host authority only from the persisted Talk owner", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        if (text.includes("SELECT host_user_id, state")) {
          return {
            rowCount: 1,
            rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[],
          };
        }
        if (text.includes("SELECT state, reconnect_grace_ends_at")) {
          return {
            rowCount: 1,
            rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[],
          };
        }
        if (text.includes("host_count")) {
          return {
            rowCount: 1,
            rows: [{ host_count: 1, listener_count: 0 }] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };

    const session = await createPostgresTalkLiveRepository(pool).connect({
      tenantId: "tenant_a",
      userId: "user_host",
      talkId: "talk_a",
      sessionId: "talk-live_host",
      now: "2026-10-07T10:00:00.000Z",
      reconnectGraceMs: 30_000,
    });

    expect(session).toMatchObject({
      role: "host",
      canPublishAudio: true,
      aiGenerationAllowed: true,
    });
    expect(calls.some((call) => call.text.includes("role"))).toBe(true);
  });

  it("never grants listener publish authority", async () => {
    const pool: TalkLiveSqlPool = {
      async query<Row>(text: string) {
        if (text.includes("SELECT host_user_id, state")) {
          return {
            rowCount: 1,
            rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[],
          };
        }
        if (text.includes("SELECT state, reconnect_grace_ends_at")) {
          return {
            rowCount: 1,
            rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[],
          };
        }
        if (text.includes("host_count")) {
          return {
            rowCount: 1,
            rows: [{ host_count: 1, listener_count: 1 }] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };

    const session = await createPostgresTalkLiveRepository(pool).connect({
      tenantId: "tenant_a",
      userId: "user_listener",
      talkId: "talk_a",
      sessionId: "talk-live_listener",
      now: "2026-10-07T10:00:00.000Z",
      reconnectGraceMs: 30_000,
    });

    expect(session).toMatchObject({
      role: "listener",
      canPublishAudio: false,
    });
  });

  it("expires stale Host presence into reconnecting and disables AI generation", async () => {
    const calls: string[] = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(text: string) {
        calls.push(text);
        if (text.includes("SELECT host_user_id, state")) {
          return {
            rowCount: 1,
            rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[],
          };
        }
        if (text.includes("UPDATE talks.live_sessions") && text.includes("last_seen_at <")) {
          return {
            rowCount: 1,
            rows: [{ role: "host" }] as unknown as Row[],
          };
        }
        if (text.includes("SELECT state, reconnect_grace_ends_at")) {
          return {
            rowCount: 1,
            rows: [{
              state: "reconnecting",
              reconnect_grace_ends_at: "2026-10-07T10:00:30.000Z",
            }] as unknown as Row[],
          };
        }
        if (text.includes("host_count")) {
          return {
            rowCount: 1,
            rows: [{ host_count: 0, listener_count: 4 }] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };

    const state = await createPostgresTalkLiveRepository(pool).state({
      tenantId: "tenant_a",
      userId: "user_listener",
      talkId: "talk_a",
      now: "2026-10-07T10:00:00.000Z",
      reconnectGraceMs: 30_000,
    });

    expect(state).toMatchObject({
      state: "reconnecting",
      hostConnected: false,
      listenerCount: 4,
      aiGenerationAllowed: false,
      reconnectGraceEndsAt: "2026-10-07T10:00:30.000Z",
    });
    expect(calls.some((text) => text.includes("state = 'reconnecting'"))).toBe(true);
  });

  it("atomically supersedes an existing Host lease without opening a second connected Host", async () => {
    const writes: string[] = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(sql: string) {
        if (sql.includes("INSERT INTO talks.live_sessions")) writes.push(sql);
        if (sql.includes("SELECT host_user_id, state")) {
          return { rowCount: 1, rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[] };
        }
        if (sql.includes("SELECT state, reconnect_grace_ends_at")) {
          return { rowCount: 1, rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[] };
        }
        if (sql.includes("host_count")) {
          return { rowCount: 1, rows: [{ host_count: 1, listener_count: 0 }] as unknown as Row[] };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkLiveRepository(pool);
    const input = {
      tenantId: "tenant_a", userId: "user_host", talkId: "talk_a",
      now: "2026-10-08T05:00:00.000Z", reconnectGraceMs: 30_000,
    };
    const first = await repository.connect({ ...input, sessionId: "talk-live_first" });
    const resumed = await repository.connect({ ...input, sessionId: "talk-live_resumed" });
    expect(first?.sessionId).toBe("talk-live_first");
    expect(resumed).toMatchObject({ sessionId: "talk-live_resumed", role: "host", canPublishAudio: true });
    expect(writes).toHaveLength(2);
    for (const sql of writes) {
      expect(sql).toContain("ON CONFLICT (tenant_id, talk_id)");
      expect(sql).toContain("WHERE role = 'host' AND connection_state = 'connected'");
      expect(sql).toContain("session_id = EXCLUDED.session_id");
      expect(sql).toContain("talks.live_sessions.user_id = EXCLUDED.user_id");
    }
  });

  it("does not apply Host takeover to human listener connections", async () => {
    const writes: string[] = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(sql: string) {
        if (sql.includes("INSERT INTO talks.live_sessions")) writes.push(sql);
        if (sql.includes("SELECT host_user_id, state")) {
          return { rowCount: 1, rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[] };
        }
        if (sql.includes("SELECT state, reconnect_grace_ends_at")) {
          return { rowCount: 1, rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[] };
        }
        if (sql.includes("host_count")) {
          return { rowCount: 1, rows: [{ host_count: 1, listener_count: 1 }] as unknown as Row[] };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    const listener = await createPostgresTalkLiveRepository(pool).connect({
      tenantId: "tenant_a", userId: "user_listener", talkId: "talk_a",
      sessionId: "talk-live_listener", now: "2026-10-08T05:00:00.000Z",
      reconnectGraceMs: 30_000,
    });
    expect(listener?.canPublishAudio).toBe(false);
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toContain("ON CONFLICT (tenant_id, talk_id)");
  });

  it("refuses disconnected Host heartbeat instead of restoring publish authority", async () => {
    const queries: string[] = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(sql: string) {
        queries.push(sql);
        if (sql.includes("SELECT host_user_id, state")) {
          return { rowCount: 1, rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[] };
        }
        if (sql.includes("SELECT state, reconnect_grace_ends_at")) {
          return { rowCount: 1, rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[] };
        }
        if (sql.includes("host_count")) {
          return { rowCount: 1, rows: [{ host_count: 1, listener_count: 0 }] as unknown as Row[] };
        }
        if (sql.includes("SET last_seen_at = $5")) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    const returned = await createPostgresTalkLiveRepository(pool).heartbeat({
      tenantId: "tenant_a", userId: "user_host", talkId: "talk_a",
      sessionId: "talk-live_revoked", now: "2026-10-08T05:00:00.000Z",
      reconnectGraceMs: 30_000,
    });
    expect(returned).toBeNull();
    expect(queries.find((sql) => sql.includes("SET last_seen_at = $5"))).toContain(
      "AND connection_state = 'connected'",
    );
    expect(queries.some((sql) => sql.includes("SET state = 'live'"))).toBe(false);
  });

  it("treats ended Talk as terminal despite a stale live runtime and never mutates presence", async () => {
    const queries: string[] = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(sql: string) {
        queries.push(sql);
        if (sql.includes("SELECT host_user_id, state")) {
          return { rowCount: 1, rows: [{ host_user_id: "user_host", state: "ended" }] as unknown as Row[] };
        }
        if (sql.includes("SELECT session_json->>'endReason'")) {
          return { rowCount: 1, rows: [{ end_reason: "host_ended" }] as unknown as Row[] };
        }
        throw new Error("unexpected SQL on terminal Talk: " + sql);
      },
    };
    const repository = createPostgresTalkLiveRepository(pool);
    const state = await repository.state({
      tenantId: "tenant_a", userId: "user_host", talkId: "talk_a",
      now: "2026-10-08T05:00:00.000Z", reconnectGraceMs: 30_000,
    });
    expect(state).toMatchObject({
      state: "ended", hostConnected: false, listenerCount: 0,
      aiGenerationAllowed: false, endReason: "host_ended",
    });
    expect(await repository.heartbeat({
      tenantId: "tenant_a", userId: "user_host", talkId: "talk_a",
      sessionId: "talk-live_old", now: "2026-10-08T05:00:01.000Z",
      reconnectGraceMs: 30_000,
    })).toBeNull();
    expect(queries.every((sql) => sql.trimStart().startsWith("SELECT"))).toBe(true);
  });

  it("fails closed rather than stealing a Host lease owned by another user", async () => {
    const pool: TalkLiveSqlPool = {
      async query<Row>(sql: string) {
        if (sql.includes("SELECT host_user_id, state")) {
          return { rowCount: 1, rows: [{ host_user_id: "user_host", state: "live" }] as unknown as Row[] };
        }
        if (sql.includes("SELECT state, reconnect_grace_ends_at")) {
          return { rowCount: 1, rows: [{ state: "live", reconnect_grace_ends_at: null }] as unknown as Row[] };
        }
        if (sql.includes("host_count")) {
          return { rowCount: 1, rows: [{ host_count: 1, listener_count: 0 }] as unknown as Row[] };
        }
        if (sql.includes("INSERT INTO talks.live_sessions")) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    await expect(createPostgresTalkLiveRepository(pool).connect({
      tenantId: "tenant_a", userId: "user_host", talkId: "talk_a",
      sessionId: "talk-live_new", now: "2026-10-08T05:00:00.000Z",
      reconnectGraceMs: 30_000,
    })).rejects.toThrow("talks.live.host_session_owner_mismatch");
  });
});


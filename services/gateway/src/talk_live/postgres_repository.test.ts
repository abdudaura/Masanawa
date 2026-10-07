import { describe, expect, it } from "vitest";
import {
  createPostgresTalkLiveRepository,
  type TalkLiveSqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk live repository", () => {
  it("derives Host authority only from the persisted Talk owner", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkLiveSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
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
});

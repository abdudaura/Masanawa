import { describe, expect, it } from "vitest";
import {
  createPostgresTalkLibraryRepository,
  type TalkLibrarySqlPool,
} from "./postgres_repository.js";

function talkRow(state: "draft" | "live" | "reconnecting" | "ended") {
  return {
    talk_id: "talk_1",
    host_user_id: "user_host",
    host_name: "Host",
    title: "A Talk",
    topic: "A topic",
    summary: "",
    state,
    listener_count: 5,
    duration_seconds: state === "ended" ? 60 : null,
    updated_at: "2026-10-07T10:00:00.000Z",
    host_avatar_url: null,
    comment_count: 2,
  };
}

describe("Postgres Talk library repository", () => {
  it("derives My Talks from canonical Host ownership and splits lifecycle", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        return {
          rowCount: 3,
          rows: [
            { ...talkRow("live"), talk_id: "talk_live" },
            { ...talkRow("ended"), talk_id: "talk_replay" },
            { ...talkRow("draft"), talk_id: "talk_draft" },
          ] as unknown as Row[],
        };
      },
    };

    const view = await createPostgresTalkLibraryRepository(pool).loadMine({
      tenantId: "tenant_a",
      userId: "user_host",
      limit: 100,
    });

    expect(calls[0]?.text).toContain("t.host_user_id = $2");
    expect(calls[0]?.values).toEqual(["tenant_a", "user_host", 100]);
    expect(view.live.map((talk) => talk.id)).toEqual(["talk_live"]);
    expect(view.replays.map((talk) => talk.id)).toEqual(["talk_replay"]);
    expect(view.drafts.map((draft) => draft.id)).toEqual(["talk_draft"]);
  });

  it("lists only visible saved Talk lifecycle states in saved order", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        return {
          rowCount: 1,
          rows: [{ ...talkRow("ended"), saved_at: "2026-10-07T10:01:00Z" }] as unknown as Row[],
        };
      },
    };

    const talks = await createPostgresTalkLibraryRepository(pool).loadSaved({
      tenantId: "tenant_a",
      userId: "user_viewer",
      limit: 100,
    });

    expect(calls[0]?.text).toContain("talks.saved_talks");
    expect(calls[0]?.text).toContain(
      "t.state IN ('live','reconnecting','ended')",
    );
    expect(calls[0]?.text).toContain("ORDER BY s.saved_at DESC");
    expect(talks[0]?.id).toBe("talk_1");
  });

  it("uses an idempotent upsert that preserves original saved order", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        return {
          rowCount: 1,
          rows: [{ saved: true }] as unknown as Row[],
        };
      },
    };

    const state = await createPostgresTalkLibraryRepository(pool).setSaved({
      tenantId: "tenant_a",
      userId: "user_viewer",
      talkId: "talk_1",
      saved: true,
      changedAt: "2026-10-07T10:00:00.000Z",
    });

    expect(state).toEqual({ saved: true });
    expect(calls[0]?.text).toContain(
      "ON CONFLICT (tenant_id, user_id, talk_id) DO UPDATE",
    );
    expect(calls[0]?.text).toContain("SET saved_at = existing.saved_at");
  });
});

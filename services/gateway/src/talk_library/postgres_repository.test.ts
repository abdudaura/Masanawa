import { describe, expect, it } from "vitest";
import {
  createPostgresTalkLibraryRepository,
  type TalkLibrarySqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk library repository", () => {
  it("scopes My Talks to authenticated tenant and Host", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, values });
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    await createPostgresTalkLibraryRepository(pool).listOwned({
      tenantId: "tenant_1",
      userId: "user_1",
      limit: 100,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("t.tenant_id = $1");
    expect(calls[0]!.text).toContain("t.host_user_id = $2");
    expect(calls[0]!.text).toContain("t.state IN ('live','reconnecting','ended')");
    expect(calls[0]!.values).toEqual(["tenant_1", "user_1", 100]);
  });

  it("keeps unpublished ended recordings out of Saved Talks", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, values });
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    await createPostgresTalkLibraryRepository(pool).listSaved({
      tenantId: "tenant_1",
      userId: "user_1",
      limit: 100,
    });

    const sql = calls[0]!.text;
    expect(sql).toContain("FROM talks.saved_talks s");
    expect(sql).toContain("s.tenant_id = $1");
    expect(sql).toContain("s.user_id = $2");
    expect(sql).toContain("FROM talks.replay_sessions r");
    expect(sql).toContain("r.recording_state = 'finalized'");
    expect(sql).toContain("r.publication_state = 'published'");
    expect(calls[0]!.values).toEqual(["tenant_1", "user_1", 100]);
  });

  it("checks replay-aware public visibility before saving", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkLibrarySqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, values });
        if (text.includes("SELECT EXISTS") && text.includes("FROM talks.talks")) {
          return {
            rowCount: 1,
            rows: [{ exists: true }] as Row[],
          };
        }
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    const result = await createPostgresTalkLibraryRepository(pool).setSaved({
      tenantId: "tenant_1",
      userId: "user_1",
      talkId: "talk_1",
      saved: true,
      changedAt: "2026-10-07T10:00:00.000Z",
    });

    expect(result).toBe(true);
    expect(calls[0]!.text).toContain("FROM talks.replay_sessions r");
    expect(calls[0]!.text).toContain("publication_state = 'published'");
    expect(calls[1]!.text).toContain("INSERT INTO talks.saved_talks");
    expect(calls[1]!.text).toContain(
      "ON CONFLICT (tenant_id, user_id, talk_id) DO NOTHING",
    );
    expect(calls[1]!.values).toEqual([
      "tenant_1",
      "user_1",
      "talk_1",
      "2026-10-07T10:00:00.000Z",
    ]);
  });
});


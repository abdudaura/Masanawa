import { describe, expect, it } from "vitest";
import { createPostgresTalkRepository, type TalkSqlPool } from "./postgres_repository.js";

function row(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: "tenant_a",
    talk_id: "talk_a",
    host_user_id: "user_host",
    host_name: "Host",
    title: "A Talk",
    topic: "A topic",
    summary: "",
    state: "live",
    listener_count: 3,
    duration_seconds: null,
    created_at: "2026-10-07T09:00:00.000Z",
    updated_at: "2026-10-07T09:00:00.000Z",
    ...overrides,
  };
}

describe("Postgres Talk repository", () => {
  it("persists a newly created Talk as live with its human Host and start time", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [row()] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkRepository(pool);

    const talk = await repository.createTalk({
      tenantId: "tenant_a",
      talkId: "talk_a",
      hostUserId: "user_host",
      hostName: "Host",
      title: "A Talk",
      topic: "A topic",
      createdAt: "2026-10-07T09:00:00.000Z",
    });

    expect(talk).toMatchObject({
      tenantId: "tenant_a",
      talkId: "talk_a",
      hostUserId: "user_host",
      hostName: "Host",
      state: "live",
    });
    expect(calls[0]?.text).toContain("started_at");
    expect(calls[0]?.text).toContain("'live'");
    expect(calls[0]?.values).toEqual([
      "tenant_a",
      "talk_a",
      "user_host",
      "Host",
      "A Talk",
      "A topic",
      "2026-10-07T09:00:00.000Z",
    ]);
  });

  it("updates metadata only for the canonical human Host", async () => {
    let call: { text: string; values?: unknown[] } | undefined;
    const pool: TalkSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        call = { text, values };
        return {
          rowCount: 1,
          rows: [row({
            title: "New title",
            topic: "New topic",
            summary: "Replay summary",
            updated_at: "2026-10-07T12:06:00.000Z",
          })] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkRepository(pool);
    const updated = await repository.updateMetadata({
      tenantId: "tenant_a",
      talkId: "talk_a",
      hostUserId: "user_host",
      title: "New title",
      topic: "New topic",
      summary: "Replay summary",
      updatedAt: "2026-10-07T12:06:00.000Z",
    });
    expect(updated).toMatchObject({
      title: "New title",
      topic: "New topic",
      summary: "Replay summary",
    });
    expect(call?.text).toContain("AND host_user_id=$3");
    expect(call?.values).toEqual([
      "tenant_a","talk_a","user_host","New title","New topic",
      "Replay summary","2026-10-07T12:06:00.000Z",
    ]);
  });

  it("keeps feed reads tenant scoped and distinguishes Explore from Live", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [row({
            comment_count: 4,
            reaction_count: 7,
            followed_host: true,
          })] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkRepository(pool);

    const live = await repository.listTalks({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      feed: "live",
      limit: 50,
    });
    const explore = await repository.listTalks({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      feed: "explore",
      limit: 50,
    });

    expect(live[0]).toMatchObject({
      commentCount: 4,
      reactionCount: 7,
      followedHost: true,
    });
    expect(explore[0]).toMatchObject({
      commentCount: 4,
      reactionCount: 7,
      followedHost: true,
    });
    expect(calls[0]?.values).toEqual(["tenant_a", "live", "user_viewer", 50]);
    expect(calls[1]?.values).toEqual(["tenant_a", "explore", "user_viewer", 50]);
    expect(calls[0]?.text).toContain("talks.participation");
    expect(calls[0]?.text).toContain("talks.follows");
    expect(calls[0]?.text).toContain("talks.safety_preferences");
    expect(calls[0]?.text).toContain("sp.viewer_user_id = $3");
    expect(calls[0]?.text).toContain("(sp.blocked OR sp.muted)");
    expect(calls[0]?.text).toContain("tenant_id = $1");
    expect(calls[0]?.text).toContain("state = 'live'");
  });

  it("projects active human and AI Seats with canonical identities", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [row({
            comment_count: 2,
            reaction_count: 3,
            followed_host: false,
            participants_json: [
              {
                id: "user_speaker",
                name: "Amina",
                kind: "human",
                avatarUrl: null,
                isHost: false,
              },
              {
                id: "persona_economist",
                name: "Economist",
                kind: "expert",
                avatarUrl: "https://example.test/economist.png",
                isHost: false,
              },
              {
                id: "persona_twin",
                name: "Amina Twin",
                kind: "twin",
                avatarUrl: null,
                isHost: false,
              },
            ],
          })] as unknown as Row[],
        };
      },
    };

    const [result] = await createPostgresTalkRepository(pool).listTalks({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      feed: "live",
      limit: 50,
    });

    expect(result?.participants).toEqual([
      {
        id: "user_speaker",
        name: "Amina",
        kind: "human",
        avatarUrl: null,
        isHost: false,
      },
      {
        id: "persona_economist",
        name: "Economist",
        kind: "expert",
        avatarUrl: "https://example.test/economist.png",
        isHost: false,
      },
      {
        id: "persona_twin",
        name: "Amina Twin",
        kind: "twin",
        avatarUrl: null,
        isHost: false,
      },
    ]);
    expect(calls[0]?.text).toContain("FROM talks.talk_seats s");
    expect(calls[0]?.text).toContain("s.active=true OR t.state='ended'");
    expect(calls[0]?.text).toContain(
      "CASE WHEN s.kind='human' THEN s.user_id ELSE s.persona_id END",
    );
    expect(calls[0]?.text).toContain("s.is_host=false");
  });

  it("applies viewer safety preferences to direct Talk reads", async () => {
    let sql = "";
    const pool: TalkSqlPool = {
      async query<Row>(text: string) {
        sql = text;
        return {
          rowCount: 1,
          rows: [row({comment_count: 0})] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkRepository(pool);
    await repository.getTalk({
      tenantId: "tenant_a",
      talkId: "talk_a",
      viewerUserId: "user_viewer",
    });
    expect(sql).toContain("talks.safety_preferences");
    expect(sql).toContain("sp.viewer_user_id = $3");
    expect(sql).toContain("sp.subject_user_id = t.host_user_id");
    expect(sql).toContain("(sp.blocked OR sp.muted)");
  });

  it("uses the same participant projection for direct Talk detail reads", async () => {
    let sql = "";
    const pool: TalkSqlPool = {
      async query<Row>(text: string) {
        sql = text;
        return {
          rowCount: 1,
          rows: [row({
            comment_count: 1,
            participants_json: [
              {
                id: "user_speaker",
                name: "Amina",
                kind: "human",
                avatarUrl: null,
                isHost: false,
              },
            ],
          })] as unknown as Row[],
        };
      },
    };

    const result = await createPostgresTalkRepository(pool).getTalk({
      tenantId: "tenant_a",
      talkId: "talk_a",
      viewerUserId: "user_viewer",
    });

    expect(result?.participants).toEqual([
      {
        id: "user_speaker",
        name: "Amina",
        kind: "human",
        avatarUrl: null,
        isHost: false,
      },
    ]);
    expect(sql).toContain("participants_json");
    expect(sql).toContain("FROM talks.talk_seats s");
  });

  it("returns null when a comment target Talk does not exist", async () => {
    const pool: TalkSqlPool = {
      async query<Row>() {
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkRepository(pool);

    await expect(
      repository.addComment({
        tenantId: "tenant_a",
        talkId: "talk_missing",
        commentId: "comment_a",
        authorUserId: "user_a",
        authorName: "Listener",
        body: "Hello",
        createdAt: "2026-10-07T09:05:00.000Z",
      }),
    ).resolves.toBeNull();
  });

  it("guards comment writes with viewer block/mute preference", async () => {
    let sql = "";
    const pool: TalkSqlPool = {
      async query<Row>(text: string) {
        sql = text;
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkRepository(pool);
    await repository.addComment({
      tenantId: "tenant_a",
      talkId: "talk_a",
      commentId: "comment_a",
      authorUserId: "user_viewer",
      authorName: "Viewer",
      body: "Hello",
      createdAt: "2026-10-07T09:05:00.000Z",
    });
    expect(sql).toContain("talks.safety_preferences");
    expect(sql).toContain("sp.viewer_user_id = $4");
    expect(sql).toContain("(sp.blocked OR sp.muted)");
    expect(sql).toContain("host_block.viewer_user_id = t.host_user_id");
    expect(sql).toContain("host_block.subject_user_id = $4");
    expect(sql).toContain("host_block.blocked");
  });
});


describe("F08 tenant- and viewer-fenced Talk comment visibility", () => {
  it("excludes restricted comment bodies and bidirectionally blocked or muted authors", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        return {
          rowCount: 1,
          rows: [{
            tenant_id: "tenant_a",
            talk_id: "talk_a",
            comment_id: "comment_allowed",
            author_user_id: "user_author",
            author_name: "Author",
            body: "Safe public comment",
            created_at: "2026-10-09T00:30:00.000Z",
          }] as unknown as Row[],
        };
      },
    };
    const result = await createPostgresTalkRepository(pool).listComments({
      tenantId: "tenant_a",
      talkId: "talk_a",
      viewerUserId: "viewer_authenticated",
      limit: 200,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual([
      "tenant_a", "talk_a", "viewer_authenticated", 200,
    ]);
    const sql = calls[0]!.sql;
    expect(sql).toContain("c.tenant_id = $1 AND c.talk_id = $2");
    expect(sql).toContain("comment_safety.tenant_id = c.tenant_id");
    expect(sql).toContain("comment_safety.target_kind = 'comment'");
    expect(sql).toContain("comment_safety.target_id = c.comment_id");
    expect(sql).toContain("comment_safety.visibility <> 'public'");
    expect(sql).toContain("viewer_preference.viewer_user_id = $3");
    expect(sql).toContain("viewer_preference.subject_user_id = c.author_user_id");
    expect(sql).toContain("(viewer_preference.blocked OR viewer_preference.muted)");
    expect(sql).toContain("author_block.viewer_user_id = c.author_user_id");
    expect(sql).toContain("author_block.subject_user_id = $3");
    expect(sql).toContain("author_block.blocked");
    expect(sql).toContain("ORDER BY c.created_at ASC, c.comment_id ASC");
    expect(sql).toContain("LIMIT $4");
    expect(result.map((item) => item.commentId)).toEqual(["comment_allowed"]);
  });

  it("filters public feed and detail counts through the exact same safety predicate", async () => {
    const sqlReads: Array<{ sql: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(sql: string, values?: unknown[]) {
        sqlReads.push({ sql, values });
        return {
          rowCount: 1,
          rows: [row({ comment_count: 1, reaction_count: 0, followed_host: false })] as unknown as Row[],
        };
      },
    };
    const repo = createPostgresTalkRepository(pool);
    await repo.listTalks({
      tenantId: "tenant_a", viewerUserId: "viewer_authenticated",
      feed: "explore", limit: 50,
    });
    await repo.getTalk({
      tenantId: "tenant_a", talkId: "talk_a",
      viewerUserId: "viewer_authenticated",
    });
    expect(sqlReads).toHaveLength(2);
    expect(sqlReads[0]?.values).toEqual(["tenant_a", "explore", "viewer_authenticated", 50]);
    expect(sqlReads[1]?.values).toEqual(["tenant_a", "talk_a", "viewer_authenticated"]);
    for (const { sql } of sqlReads) {
      expect(sql).toContain("FROM talks.comments c");
      expect(sql).toContain("c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id");
      expect(sql).toContain("comment_safety.target_kind = 'comment'");
      expect(sql).toContain("comment_safety.visibility <> 'public'");
      expect(sql).toContain("viewer_preference.viewer_user_id = $3");
      expect(sql).toContain("author_block.subject_user_id = $3");
    }
  });
});

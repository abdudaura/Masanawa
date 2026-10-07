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

  it("keeps feed reads tenant scoped and distinguishes Explore from Live", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [row({ comment_count: 4 })] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkRepository(pool);

    const live = await repository.listTalks({
      tenantId: "tenant_a",
      feed: "live",
      limit: 50,
    });
    const explore = await repository.listTalks({
      tenantId: "tenant_a",
      feed: "explore",
      limit: 50,
    });

    expect(live[0]).toMatchObject({ commentCount: 4 });
    expect(explore[0]).toMatchObject({ commentCount: 4 });
    expect(calls[0]?.values).toEqual(["tenant_a", "live", 50]);
    expect(calls[1]?.values).toEqual(["tenant_a", "explore", 50]);
    expect(calls[0]?.text).toContain("tenant_id = $1");
    expect(calls[0]?.text).toContain("state = 'live'");
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
});

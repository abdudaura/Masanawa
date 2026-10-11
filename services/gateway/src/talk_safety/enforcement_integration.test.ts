import { describe, expect, it } from "vitest";
import { createPostgresTalkRepository } from "../talks/postgres_repository.js";
import { createPostgresTalkSearchRepository } from "../talk_search/postgres_repository.js";
import { createPostgresTalkProfileRepository } from "../talk_profiles/postgres_repository.js";
import { createPostgresReplayMediaRepository } from "../talk_replay/egress/postgres_media_repository.js";

function recordingPool() {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    pool: {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 0, rows: [] as Row[] };
      },
    },
  };
}

describe("Talk safety enforcement integration", () => {
  it("hard-filters restricted or blocked Talks before Explore/Live ranking", async () => {
    const { pool, calls } = recordingPool();
    await createPostgresTalkRepository(pool).listTalks({
      tenantId: "tenant-a",
      viewerUserId: "viewer-a",
      feed: "explore",
      limit: 50,
    });

    const sql = calls[0]?.text ?? "";
    expect(sql).toContain("talks.safety_enforcement");
    expect(sql).toContain("se.target_kind = 'talk'");
    expect(sql).toContain("se.target_id = t.talk_id");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
    const outerOrder = sql.indexOf("ORDER BY CASE WHEN state");
    expect(outerOrder).toBeGreaterThan(-1);
    expect(sql.indexOf("safety_enforcement")).toBeLessThan(outerOrder);
  });

  it("lets the Host privately resolve a safety-hidden Talk detail while public viewers cannot", async () => {
    const { pool, calls } = recordingPool();
    await createPostgresTalkRepository(pool).getTalk({
      tenantId: "tenant-a",
      talkId: "talk-a",
      viewerUserId: "user-host",
    });

    const sql = calls[0]?.text ?? "";
    const normalized = sql.replace(/\s+/gu, " ");
    expect(normalized).toContain("t.host_user_id = $3 OR ( NOT EXISTS (");
    expect(normalized).toContain("FROM talks.safety_preferences sp");
    expect(normalized).toContain("sp.tenant_id = t.tenant_id");
    expect(normalized).toContain("sp.viewer_user_id = $3");
    expect(normalized).toContain("sp.subject_user_id = t.host_user_id");
    expect(normalized).toContain("AND (sp.blocked OR sp.muted) ) AND NOT EXISTS (");
    expect(normalized).toContain("FROM talks.safety_enforcement se");
    expect(normalized).toContain("se.tenant_id = t.tenant_id");
    expect(normalized).toContain("se.target_kind = 'talk'");
    expect(normalized).toContain("se.target_id = t.talk_id");
    expect(normalized).toContain("se.visibility IN ('restricted','blocked') ) ) )");
    expect(calls[0]?.values).toEqual(["tenant-a", "talk-a", "user-host"]);
  });

  it("prevents new public comments on safety-restricted or blocked Talks", async () => {
    const { pool, calls } = recordingPool();
    await createPostgresTalkRepository(pool).addComment({
      tenantId: "tenant-a",
      talkId: "talk-a",
      commentId: "comment-a",
      authorUserId: "user-a",
      authorName: "A",
      body: "hello",
      createdAt: "2026-10-07T10:00:00Z",
    });

    const sql = calls[0]?.text ?? "";
    expect(sql).toContain("talks.safety_enforcement");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
  });

  it("filters Talks, people and personas from global search before result ordering", async () => {
    const { pool, calls } = recordingPool();
    const repository = createPostgresTalkSearchRepository(pool);

    await repository.searchTalks({
      tenantId: "tenant-a",
      query: "economy",
      limit: 5,
    });
    await repository.searchPeople({
      tenantId: "tenant-a",
      query: "amina",
      limit: 5,
    });
    await repository.searchPersonas({
      tenantId: "tenant-a",
      query: "history",
      limit: 5,
    });

    expect(calls[0]?.text).toContain("se.target_kind = 'talk'");
    expect(calls[0]?.text).toContain("se.target_id = t.talk_id");
    expect(calls[1]?.text).toContain("se.target_kind = 'profile'");
    expect(calls[1]?.text).toContain("se.target_id = p.handle");
    expect(calls[2]?.text).toContain("se.target_kind = 'persona'");
    expect(calls[2]?.text).toContain("se.target_id = p.public_id");
    for (const call of calls) {
      expect(call.text.indexOf("safety_enforcement")).toBeLessThan(call.text.indexOf("ORDER BY"));
    }
  });

  it("hides restricted/blocked human and persona profiles and prevents following hidden profiles", async () => {
    const { pool, calls } = recordingPool();
    const repository = createPostgresTalkProfileRepository(pool);

    await repository.readHuman({
      tenantId: "tenant-a",
      viewerUserId: "viewer-a",
      handle: "amina",
    });
    await repository.readPersona({
      tenantId: "tenant-a",
      viewerUserId: "viewer-a",
      publicId: "twin-amina",
    });
    await repository.setFollowing({
      tenantId: "tenant-a",
      viewerUserId: "viewer-a",
      handle: "amina",
      following: true,
      changedAt: "2026-10-07T10:00:00Z",
    });

    expect(calls[0]?.text).toContain("se.target_kind = 'profile'");
    expect(calls[1]?.text).toContain("se.target_kind = 'persona'");
    expect(calls[2]?.text).toContain("se.target_kind = 'profile'");
  });

  it("never creates a signed replay source when either Talk or recording is safety-restricted/blocked", async () => {
    const { pool, calls } = recordingPool();
    await createPostgresReplayMediaRepository(pool).playbackObject({
      tenantId: "tenant-a",
      talkId: "talk-a",
      viewerUserId: "user-host",
    });

    const sql = calls[0]?.text ?? "";
    expect(sql).toContain("se.target_kind='talk'");
    expect(sql).toContain("se.target_kind='replay'");
    expect(sql).toContain("se.target_id=r.recording_id");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
    expect(sql.indexOf("safety_enforcement")).toBeLessThan(sql.indexOf("LIMIT 1"));
  });
});

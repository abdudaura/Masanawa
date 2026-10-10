import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAudioPostRepository } from "./repository.ts";

// Real adapter/source exercised with a deterministic PG boundary. The input
// deliberately loses precision in the pg Date parser; cursor_time remains the
// exact six-digit PostgreSQL timestamp from the SELECT alias.
function fixture({ hidden = false } = {}) {
  const stamps = [
    "2026-10-10T02:51:54.123789Z",
    "2026-10-10T02:51:54.123456Z",
    "2026-10-10T02:51:54.123123Z",
  ];
  const rows = stamps.map((stamp, index) => ({
    tenant_id: "tenantA", post_id: "p" + (index + 1),
    author_id: "author" + (index + 1),
    author_account_id: hidden && index === 1 ? "hidden" : "visible",
    author_kind: "human", asset_id: "private" + index,
    request_id: "request" + index, title: "Recorded Talk " + index,
    duration_ms: 20000, status: "published", revision: 1,
    created_at: new Date(stamp), published_at: new Date(stamp),
    cursor_time: stamp, like_count: 0, comment_count: 0,
  }));
  const calls = [];
  const pool = {
    async query(sql, params) {
      assert.match(sql, /AS cursor_time/);
      calls.push({ sql, params });
      const [tenantId, stamp, postId] = params;
      return { rows: rows.filter(row => row.tenant_id === tenantId &&
        (stamp === null || row.cursor_time < stamp ||
          (row.cursor_time === stamp && row.post_id < postId))) };
    },
  };
  const repo = createPostgresAudioPostRepository(pool, {
    async canView({ authorAccountId }) { return authorAccountId !== "hidden"; },
  });
  return { repo, calls };
}

test("Discover cursor preserves PostgreSQL microseconds across pages", async () => {
  const { repo, calls } = fixture();
  let cursor = null;
  const ids = [];
  for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
    const page = await repo.publicFeed({
      tenantId: "tenantA", viewerId: "viewerA", cursor, limit: 1,
    });
    ids.push(...page.items.map(post => post.postId));
    if (page.nextCursor === null) break;
    assert.match(page.nextCursor, /^[A-Za-z0-9_-]+$/);
    cursor = page.nextCursor;
  }
  assert.deepEqual(ids, ["p1", "p2", "p3"]);
  // A JS Date would be .123Z; the second query must keep .123789Z.
  assert.equal(calls[1].params[1], "2026-10-10T02:51:54.123789Z");
  assert.equal(calls[2].params[1], "2026-10-10T02:51:54.123456Z");
});

test("Hidden authors advance the cursor without a duplicate or lost Talk", async () => {
  const { repo } = fixture({ hidden: true });
  const first = await repo.publicFeed({
    tenantId: "tenantA", viewerId: "viewerA", cursor: null, limit: 1,
  });
  const second = await repo.publicFeed({
    tenantId: "tenantA", viewerId: "viewerA", cursor: first.nextCursor, limit: 1,
  });
  assert.deepEqual(first.items.map(x => x.postId), ["p1"]);
  assert.deepEqual(second.items.map(x => x.postId), ["p3"]);
  assert.equal(second.nextCursor, null);
});

test("Malformed Discover cursors fail before any database read", async () => {
  const { repo, calls } = fixture();
  for (const cursor of ["bad cursor", "123:p1", "!", "a".repeat(257),
                        Buffer.from('["wrong","p1"]').toString("base64url")]) {
    await assert.rejects(
      repo.publicFeed({ tenantId: "tenantA", viewerId: "viewerA", cursor, limit: 1 }),
      /audio_posts.invalid_cursor/,
    );
  }
  assert.equal(calls.length, 0);
});

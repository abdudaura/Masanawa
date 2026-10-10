import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresFollowingRepository } from "./following_repository.ts";

// Execute the real PostgreSQL adapter against a deterministic, scoped PG boundary.
// pg's Date parser truncates sub-millisecond values; cursor_time stays SQL text.
const stamps = [
  "2026-10-10T02:51:54.123789Z",
  "2026-10-10T02:51:54.123456Z",
  "2026-10-10T02:51:54.123123Z",
];
function fixture({ hidden = false, invalidRow = false } = {}) {
  const rows = stamps.map((stamp, index) => ({
    tenant_id: "tenantA", post_id: ["z", "a", "m"][index],
    author_id: "creatorA", author_kind: "human",
    author_account_id: hidden && index === 1 ? "hidden" : "creatorAccount",
    asset_id: "private" + index, request_id: "request" + index,
    title: "Talk " + index, duration_ms: 21000, status: "published",
    revision: 1, created_at: new Date(stamp), published_at: new Date(stamp),
    cursor_time: invalidRow && index === 0 ? "bad timestamp" : stamp,
    like_count: 0, comment_count: 0,
  }));
  const calls = [];
  const pool = {
    async query(sql, params) {
      assert.match(sql, /AS cursor_time/);
      assert.match(sql, /ORDER BY p\.created_at DESC,p\.post_id DESC/);
      assert.doesNotMatch(sql, /date_trunc\('milliseconds'/);
      calls.push({ sql, params });
      const creator = sql.includes("p.author_id=$2");
      const [tenant, viewerOrAuthor, third, fourth, fifth, sixth] = params;
      const timestamp = creator ? fourth : third;
      const postId = creator ? fifth : fourth;
      const limit = creator ? sixth : fifth;
      const filtered = rows.filter(row =>
        row.tenant_id === tenant &&
        (!creator || (viewerOrAuthor === row.author_id && third === row.author_kind)) &&
        (timestamp === null || row.cursor_time < timestamp ||
         (row.cursor_time === timestamp && row.post_id < postId)));
      return { rows: filtered.slice(0, limit) };
    },
  };
  const repo = createPostgresFollowingRepository(pool, {
    async canView({ authorAccountId }) { return authorAccountId !== "hidden"; },
  });
  const scope = { tenantId: "tenantA", viewerId: "viewerA", limit: 1 };
  return { repo, calls, scope };
}
async function collectPages(load, maxPages = 6) {
  const collected = [];
  const seen = new Set();
  let cursor = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await load(cursor);
    collected.push(...page.items.map(post => post.postId));
    if (page.nextCursor === null) return { collected, seen };
    assert.match(page.nextCursor, /^[A-Za-z0-9_-]+$/);
    assert.ok(!seen.has(page.nextCursor), "must advance the cursor");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw Error("pagination never terminated");
}
test("Following feed reads every post in true PostgreSQL microsecond order", async () => {
  const f = fixture();
  const result = await collectPages(cursor => f.repo.feed({ ...f.scope, cursor }));
  assert.deepEqual(result.collected, ["z", "a", "m"]);
  assert.equal(f.calls[1].params[2], stamps[0]);
  assert.equal(f.calls[2].params[2], stamps[1]);
});
test("Creator profile applies the same precise keyset without losing same-ms posts", async () => {
  const f = fixture();
  const result = await collectPages(cursor => f.repo.creatorFeed({
    ...f.scope, authorId: "creatorA", authorKind: "human", cursor,
  }));
  assert.deepEqual(result.collected, ["z", "a", "m"]);
  assert.equal(f.calls[1].params[3], stamps[0]);
});
test("Hidden author advances Following pagination without exposing or skipping neighbors", async () => {
  const f = fixture({ hidden: true });
  const result = await collectPages(cursor => f.repo.feed({ ...f.scope, cursor }));
  assert.deepEqual(result.collected, ["z", "m"]);
  assert.equal(f.calls.at(-1).params[2], stamps[0]);
});
test("Malformed, legacy, noncanonical and foreign timestamps fail before DB access", async () => {
  const f = fixture();
  const malformed = [
    "1700000000000:z", "not-valid", "_", "a".repeat(257),
    Buffer.from(JSON.stringify(["2026-02-30T02:51:54.123456Z", "z"])).toString("base64url"),
    Buffer.from(JSON.stringify(["2026-10-10T02:51:54.123Z", "z"])).toString("base64url"),
    Buffer.from(JSON.stringify(["2026-10-10T02:51:54.123456Z", "../bad"])).toString("base64url"),
    Buffer.from(JSON.stringify(["2026-10-10T02:51:54.123456Z", "z", "extra"])).toString("base64url"),
  ];
  for (const cursor of malformed) {
    await assert.rejects(f.repo.feed({ ...f.scope, cursor }), /audio_posts.invalid_following_cursor/);
  }
  assert.equal(f.calls.length, 0);
});
test("Missing or corrupt SQL microsecond alias fails closed instead of returning a cursor", async () => {
  const f = fixture({ invalidRow: true });
  await assert.rejects(f.repo.feed({ ...f.scope, cursor: null }), /audio_posts.invalid_following_row/);
});
test("Creator lookup remains tenant- and author-scoped with opaque cursors", async () => {
  const f = fixture();
  for (const scope of [
    { ...f.scope, tenantId: "tenantB", authorId: "creatorA", authorKind: "human" },
    { ...f.scope, authorId: "creatorB", authorKind: "human" },
    { ...f.scope, authorId: "creatorA", authorKind: "masana" },
  ]) {
    const page = await f.repo.creatorFeed({ ...scope, cursor: null });
    assert.deepEqual(page.items, []);
  }
});

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

function privateLibraryFixture() {
 const rows = ["123789","123456","123123"].map((fraction,i) => {
   const stamp="2026-10-10T02:51:54."+fraction+"Z";
   return {
     tenant_id:"tenantA",post_id:"post"+i,author_id:"creator"+i,
     author_account_id:i===1?"hidden":"ownerA",author_kind:"human",
     asset_id:"secret"+i,request_id:"key"+i,title:"Talk "+i,
     duration_ms:20000,status:i===2?"removed":"published",revision:1,
     created_at:new Date(stamp),published_at:null,cursor_time:stamp,
     like_count:0,comment_count:0,listen_count:0,
   };
 });
 const calls=[];
 const pool={
   async query(sql,params){
     assert.match(sql,/AS cursor_time/);
     const saved=sql.includes("JOIN social.audio_post_reactions");
     calls.push({sql,params,saved});
     const [tenant,account,stamp,id]=params;
     return {rows:rows.filter(r=>r.tenant_id===tenant &&
       (saved ? account==="viewerA" && r.status==="published" :
        r.author_account_id===account) &&
       (stamp===null || r.cursor_time<stamp ||
         (r.cursor_time===stamp && r.post_id<id))).slice(0,30)};
   },
 };
 const repo=createPostgresAudioPostRepository(pool,{
   async canView({authorAccountId}){return authorAccountId!=="hidden";},
 });
 return {repo,calls};
}
test("My Talks history uses account scope and microsecond-stable pages",async()=>{
 const {repo,calls}=privateLibraryFixture();
 const first=await repo.minePage({tenantId:"tenantA",accountId:"ownerA",cursor:null,limit:1});
 const second=await repo.minePage({tenantId:"tenantA",accountId:"ownerA",cursor:first.nextCursor,limit:1});
 assert.deepEqual(first.items.map(p=>p.postId),["post0"]);
 assert.deepEqual(second.items.map(p=>p.postId),["post2"]);
 assert.equal(second.items[0].status,"removed");
 assert.equal(calls[1].params[2],"2026-10-10T02:51:54.123789Z");
 assert.equal(calls[1].params[1],"ownerA");
 assert.equal((await repo.minePage({tenantId:"other",accountId:"ownerA",cursor:null,limit:1})).items.length,0);
});
test("Saved pages filter blocked creators, do not expose account ownership and reject invalid cursors",async()=>{
 const {repo,calls}=privateLibraryFixture();
 const page=await repo.savedPage({tenantId:"tenantA",viewerId:"viewerA",cursor:null,limit:2});
 assert.deepEqual(page.items.map(p=>p.postId),["post0"]);
 assert.equal(page.nextCursor,null);
 assert.equal(calls[0].saved,true);
 assert.equal(calls[0].params[1],"viewerA");
 const before=calls.length;
 await assert.rejects(repo.savedPage({
   tenantId:"tenantA",viewerId:"viewerA",cursor:"bad cursor",limit:2,
 }),/audio_posts.invalid_cursor/);
 assert.equal(calls.length,before);
 const stranger=await repo.savedPage({tenantId:"tenantA",viewerId:"stranger",cursor:null,limit:2});
 assert.deepEqual(stranger.items,[]);
});

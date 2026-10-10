import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresTalkListenStore } from "./listen_repository.js";

const tenantId="tenant-a", postId="post-a", viewerId="account-a";
const listenId="123e4567-e89b-42d3-a456-426614174000";
function fixture({elapsed="4000",expires=true,accepted=false,counted=false,
    postStatus="published",revision=2,count="4"}={}) {
  const calls=[];
  let released=false, added=0;
  const row={author_account_id:"creator-account",post_revision:2,duration_ms:12000,
    issued_at:new Date("2026-10-10T00:00:00Z"),expires_at:new Date("2026-10-10T00:10:00Z"),
    accepted,counted,post_status:postStatus,current_revision:revision};
  const db={
    async query(sql,params=[]) {
      calls.push({sql,params});
      if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return {rows:[]};
      if(sql.startsWith("INSERT INTO social.audio_post_listen_sessions"))
        return {rows:[{listen_id:listenId}]};
      if(sql.startsWith("SELECT p.author_account_id"))return {rows:[row]};
      if(sql.startsWith("SELECT GREATEST"))return {rows:[{elapsed,valid:expires}]};
      if(sql.startsWith("INSERT INTO social.audio_post_listen_days")){
        added++;return {rows:counted?[]:[{post_id:postId}]};
      }
      if(sql.startsWith("UPDATE social.audio_post_listen_sessions"))
        return {rows:[]};
      if(sql.startsWith("SELECT COUNT(*)::text"))
        return {rows:[{count}]};
      throw Error("Unexpected SQL "+sql);
    },
    release(){released=true;},
  };
  const pool={async connect(){return db;}};
  return {store:createPostgresTalkListenStore(pool),calls,
    getReleased:()=>released,getAdded:()=>added};
}
const verified={tenantId,postId,viewerId,listenId,playedMs:3500,
  canView:async author=>author==="creator-account"};

test("opening listens never creates a count or accepts a client session id",async()=>{
  const f=fixture();
  assert.equal(await f.store.open({tenantId,postId,viewerId,revision:2,durationMs:12000}),listenId);
  assert.equal(f.getAdded(),0);
  assert.ok(f.calls.some(c=>c.sql==="COMMIT"));
  assert.ok(f.getReleased());
});

test("qualified server-time-bounded listen is transactionally deduplicated per UTC day",async()=>{
  const f=fixture();
  assert.deepEqual(await f.store.complete(verified),{counted:true,listenCount:4});
  assert.equal(f.getAdded(),1);
  const insert=f.calls.find(c=>c.sql.startsWith("INSERT INTO social.audio_post_listen_days"));
  assert.ok(insert.sql.includes("ON CONFLICT DO NOTHING"));
  assert.ok(insert.sql.includes("now() AT TIME ZONE 'UTC'"));
  assert.deepEqual(insert.params,[tenantId,postId,viewerId]);
  assert.ok(f.calls.some(c=>c.sql==="COMMIT"));
});

test("repeated acknowledged session never inserts a second listen",async()=>{
  const f=fixture({accepted:true,counted:true});
  assert.deepEqual(await f.store.complete(verified),{counted:true,listenCount:4});
  assert.equal(f.getAdded(),0);
});
test("another session on the same day does not double-count",async()=>{
  const f=fixture({counted:true});
  assert.deepEqual(await f.store.complete(verified),{counted:false,listenCount:4});
  assert.equal(f.getAdded(),1);
});

test("early, seek-spoofed and expired progress roll back without counting",async()=>{
  for(const opts of [{elapsed:"1000"},{expires:false}]) {
    const f=fixture(opts);
    await assert.rejects(f.store.complete(verified),
      /audio_posts.listen_(insufficient_progress|expired)/);
    assert.equal(f.getAdded(),0);
    assert.ok(f.calls.some(c=>c.sql==="ROLLBACK"));
  }
  const f=fixture();
  await assert.rejects(f.store.complete({...verified,playedMs:500}),
    /audio_posts.listen_insufficient_progress/);
  assert.equal(f.getAdded(),0);
});

test("foreign user and moderated/deleted revision never count",async()=>{
  const f=fixture({postStatus:"removed"});
  await assert.rejects(f.store.complete(verified),/audio_posts.listen_not_visible/);
  assert.equal(f.getAdded(),0);
  const other=fixture();
  await assert.rejects(other.store.complete({...verified,
    canView:async()=>false}),/audio_posts.listen_not_visible/);
  assert.equal(other.getAdded(),0);
  const stale=fixture({revision:3});
  await assert.rejects(stale.store.complete(verified),/audio_posts.listen_not_visible/);
});

test("invalid ID, non-integer measured progress and oversized reports reject before SQL",async()=>{
  const f=fixture();
  for(const body of [{...verified,listenId:"foreign"}, {...verified,playedMs:Infinity},
    {...verified,playedMs:180001}, {...verified,tenantId:"bad id"}]) {
    await assert.rejects(f.store.complete(body),/audio_posts.listen_invalid_input/);
  }
  assert.equal(f.calls.length,0);
});

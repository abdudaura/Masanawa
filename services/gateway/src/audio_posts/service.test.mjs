import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPostService, AudioPostError } from "./service.js";

const actor = Object.freeze({ tenantId:"tenant1", accountId:"user1", authorId:"user1", authorKind:"human" });
const second = Object.freeze({ tenantId:"tenant1", accountId:"user2", authorId:"user2", authorKind:"human" });
const accepted = {assetId:"asset1",ownerAccountId:"user1",durationMs:25000,bytes:50000,mime:"audio/ogg",state:"ready"};

function fixture() {
 const rows = new Map(), keys = new Map(), saves = new Set(), comments = new Map();
 let lookups=0, verifications=0, decisions=0, id=0;
 const repo = {
  async byRequest(t,a,k) {return rows.get(keys.get([t,a,k].join("/"))) ?? null},
  async byId(t,p) {const row=rows.get(p);return row?.tenantId===t?row:null},
  async createOnce(intent) {
   const key=[intent.actor.tenantId,intent.actor.accountId,intent.requestId].join("/");
   if(keys.has(key)) return rows.get(keys.get(key));
   const record = {tenantId:intent.actor.tenantId,postId:intent.postId,
    authorId:intent.actor.authorId,authorAccountId:intent.actor.accountId,
    authorKind:intent.actor.authorKind,assetId:intent.asset.assetId,
    requestId:intent.requestId,title:intent.title,durationMs:intent.asset.durationMs,
    status:"processing",revision:0,createdAt:intent.createdAt,publishedAt:null};
   rows.set(record.postId,record);keys.set(key,record.postId);return record;
  },
  async saved({tenantId,viewerId,limit}) {
   return [...rows.values()].filter(r => r.tenantId===tenantId && r.status==='published' &&
      viewerId!=='blocked' && saves.has([tenantId,viewerId,r.postId].join('/'))).slice(0,limit);
  },
  async removeOwn({tenantId,accountId,postId}) {
   const r=rows.get(postId);
   if(!r || r.tenantId!==tenantId || r.authorAccountId!==accountId) return null;
   if(r.status==='removed') return r;
   const next={...r,status:'removed',revision:r.revision+1,publishedAt:null};
   rows.set(postId,next);return next;
  },
  async settle({tenantId,postId,expectedRevision,status}) {
   const r=rows.get(postId);
   if(!r||r.tenantId!==tenantId||r.revision!==expectedRevision||r.status!=="processing")throw Error("conflict");
   const next={...r,status,revision:r.revision+1,publishedAt:status==="published"?"2026-10-10T00:00:00Z":null};
   rows.set(postId,next);return next;
  },
  async publicFeed({tenantId,viewerId}) {
   lookups++;return {items:[...rows.values()].filter(r=>r.tenantId===tenantId&&r.status==="published"&&viewerId!=="blocked"),nextCursor:null};
  },
  async mine({tenantId,accountId}) {
   return [...rows.values()].filter(r=>r.tenantId===tenantId&&r.authorAccountId===accountId);
  },
  async listComments({tenantId,viewerId,postId,limit}) {
   const post=rows.get(postId);
   if(!post || post.tenantId!==tenantId || post.status!=='published' || viewerId==='blocked'){
    throw Error('audio_posts.not_visible');
   }
   return [...comments.values()].filter(c=>c.tenantId===tenantId&&c.postId===postId&&!c.removed).slice(0,limit);
  },
  async addComment({tenantId,viewerId,postId,commentId,requestId,body,createdAt}) {
   const post=rows.get(postId);
   if(!post || post.tenantId!==tenantId || post.status!=='published' || viewerId==='blocked'){
    throw Error('audio_posts.not_visible');
   }
   const key=[tenantId,postId,viewerId,requestId].join('/');
   const existing=comments.get(key);
   if(existing){
    if(existing.body!==body || existing.removed)throw Error('audio_posts.comment_conflict');
    return existing;
   }
   const record={tenantId,postId,commentId,authorAccountId:viewerId,requestId,body,createdAt,removed:false};
   comments.set(key,record);
   return record;
  },
  async removeOwnComment({tenantId,viewerId,postId,commentId}) {
   const entry=[...comments.entries()].find(([,c])=>
     c.tenantId===tenantId && c.postId===postId && c.commentId===commentId && c.authorAccountId===viewerId);
   if(!entry)return false;
   comments.set(entry[0],{...entry[1],body:'',removed:true});
   return true;
  },
  async setReaction({tenantId,viewerId,postId,kind,enabled}) {
   const r=rows.get(postId);
   if(!r||r.tenantId!==tenantId||r.status!=="published"||viewerId==="blocked")throw Error("not_visible");
   if(kind==='save'){
    const key=[tenantId,viewerId,postId].join('/');
    if(enabled) saves.add(key); else saves.delete(key);
   }
   return {enabled};
  },
 };
 const service=createAudioPostService({
  repository:repo,
  assets:{async verifyOwnedReady(){verifications++;return {...accepted}}},
  moderation:{async approve(){decisions++;return true}},
  newId:()=> "post"+(++id),now:()=> "2026-10-10T00:00:00.000Z",
 });
 return {service,rows,get counters(){return {lookups,verifications,decisions}}};
}
const input={requestId:"request1",assetId:"asset1",title:"A first audio post"};

test("publish creates one pending audio post then trusted moderation publishes",async()=>{
 const f=fixture();
 const post=await f.service.publish(actor,input);
 assert.equal(post.status,"processing");
 const ready=await f.service.settle({tenantId:actor.tenantId,postId:post.postId,expectedRevision:0});
 assert.equal(ready.status,"published");assert.equal(ready.revision,1);
 assert.equal((await f.service.feed({tenantId:"tenant1",viewerId:"user2"})).items.length,1);
 assert.equal((await f.service.mine(actor))[0].postId,post.postId);
});
test("same publish key returns persisted record, no second asset verification",async()=>{
 const f=fixture();
 const one=await f.service.publish(actor,input);
 const two=await f.service.publish(actor,input);
 assert.equal(one.postId,two.postId);
 assert.equal(f.rows.size,1);
 assert.equal(f.counters.verifications,1);
});
test("changed title with same request ID rejects conflicting replay",async()=>{
 const f=fixture();await f.service.publish(actor,input);
 await assert.rejects(f.service.publish(actor,{...input,title:"Different"}),e=>e.code==="CONFLICT");
});
test("client may not spoof author, state or a signed media URL",async()=>{
 const f=fixture();
 for(const key of ["authorId","authorKind","status","mediaUrl","tenantId"]){
  await assert.rejects(f.service.publish(actor,{...input,[key]:"spoof"}),e=>e.code==="VALIDATION");
 }
 assert.equal(f.counters.verifications,0);
});
test("rejects Unicode bidi spoofing and invalid asset lengths",async()=>{
 const f=fixture();
 await assert.rejects(f.service.publish(actor,{...input,title:"Test\u202eabc"}),e=>e.code==="VALIDATION");
 await assert.rejects(f.service.publish(actor,{...input,title:""}),e=>e.code==="VALIDATION");
 assert.equal(f.rows.size,0);
});
test("cross-account object and unsupported formats reject before persistence",async()=>{
 const f=fixture();
 const altered=createAudioPostService({
  repository:{
   byRequest:async()=>null, createOnce:async()=>{throw Error("should not persist");},
   byId:async()=>null,publicFeed:async()=>({items:[],nextCursor:null}),
   mine:async()=>[],saved:async()=>[],removeOwn:async()=>null,settle:async()=>{throw Error("should not settle");},
   setReaction:async()=>({enabled:false}),
  },
  assets:{verifyOwnedReady:async()=>({...accepted,ownerAccountId:"user2"})},
  moderation:{approve:async()=>true},newId:()=>"unused",now:()=>new Date().toISOString(),
 });
 await assert.rejects(altered.publish(actor,input),e=>e.code==="VALIDATION");
 assert.equal(f.rows.size,0);
});
test("only processing revision can settle once",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:"tenant1",postId:post.postId,expectedRevision:0});
 await assert.rejects(f.service.settle({tenantId:"tenant1",postId:post.postId,expectedRevision:0}),e=>e.code==="CONFLICT");
 assert.equal(f.counters.decisions,1);
});
test("feed page has strict bounded cursor/limit and requires viewer",async()=>{
 const f=fixture();
 for(const limit of [-1,0,31,1.5,NaN]){
  await assert.rejects(f.service.feed({tenantId:"tenant1",viewerId:"user2",limit}),e=>e.code==="VALIDATION");
 }
 await assert.rejects(f.service.feed({tenantId:"tenant1",viewerId:"user2",cursor:"bad cursor"}),e=>e.code==="VALIDATION");
 await assert.rejects(f.service.feed({tenantId:"tenant1",viewerId:"",limit:1}),e=>e.code==="VALIDATION");
});
test("owner can remove a published post, repeat safely, and hide it from feeds",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0});
 const removed=await f.service.removeOwn(actor,post.postId);
 assert.equal(removed.status,'removed');
 assert.equal(removed.publishedAt,null);
 assert.equal(removed.revision,2);
 assert.equal((await f.service.feed({tenantId:'tenant1',viewerId:'user2'})).items.length,0);
 const again=await f.service.removeOwn(actor,post.postId);
 assert.deepEqual(again,removed);
 assert.equal(f.rows.size,1);
 assert.equal((await f.service.mine(actor))[0].status,'removed');
});
test("non-owner, missing and cross-tenant deletion cannot reveal or mutate posts",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await assert.rejects(f.service.removeOwn(second,post.postId),e=>e.code==='NOT_FOUND');
 await assert.rejects(f.service.removeOwn({...actor,tenantId:'tenant2'},post.postId),e=>e.code==='NOT_FOUND');
 await assert.rejects(f.service.removeOwn(actor,'not-found'),e=>e.code==='NOT_FOUND');
 await assert.rejects(f.service.removeOwn(actor,'bad/path'),e=>e.code==='VALIDATION');
 assert.equal(f.rows.get(post.postId).status,'processing');
});
test("removed pending post cannot later be published by an old moderation revision",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await f.service.removeOwn(actor,post.postId);
 await assert.rejects(f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0}),e=>e.code==='CONFLICT');
 assert.equal(f.counters.decisions,0);
});
test("saved library uses the same stored reaction and hides deleted posts",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0});
 assert.equal((await f.service.saved(second)).length,0);
 await f.service.reaction(second,{postId:post.postId,kind:'save',enabled:true});
 await f.service.reaction(second,{postId:post.postId,kind:'save',enabled:true});
 assert.equal((await f.service.saved(second)).length,1);
 assert.equal((await f.service.saved(actor)).length,0);
 await f.service.removeOwn(actor,post.postId);
 assert.equal((await f.service.saved(second)).length,0);
});
test("saved preference can be removed and reads stay account-scoped",async()=>{
 const f=fixture();const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0});
 await f.service.reaction(second,{postId:post.postId,kind:'save',enabled:true});
 await f.service.reaction(second,{postId:post.postId,kind:'save',enabled:false});
 assert.equal((await f.service.saved(second)).length,0);
 assert.equal((await f.service.saved({...second,tenantId:'tenant2'})).length,0);
});
test("reaction accepts only a boolean and explicit like/save",async()=>{
 const f=fixture();
 await assert.rejects(f.service.reaction(second,{postId:"post1",kind:"hack",enabled:true}),e=>e.code==="VALIDATION");
 await assert.rejects(f.service.reaction(second,{postId:"post1",kind:"like",enabled:"yes"}),e=>e.code==="VALIDATION");
 const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:"tenant1",postId:post.postId,expectedRevision:0});
 assert.deepEqual(await f.service.reaction(second,{postId:post.postId,kind:"save",enabled:true}),{enabled:true});
});

test("comments persist under the published post, replay once, and remain author-scoped",async()=>{
 const f=fixture(),post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0});
 const first=await f.service.comment(second,post.postId,{requestId:'req1',body:' Welcome! '});
 assert.equal(first.body,'Welcome!');
 const again=await f.service.comment(second,post.postId,{requestId:'req1',body:'Welcome!'});
 assert.equal(first.commentId,again.commentId);
 const read=await f.service.comments(second,post.postId);
 assert.equal(read.length,1);
 assert.equal(read[0].isMine,true);
 assert.equal(Object.hasOwn(read[0],'authorAccountId'),false);
 assert.equal(first.isMine,true);
 assert.equal(Object.hasOwn(first,'authorAccountId'),false);
 const otherView=await f.service.comments(actor,post.postId);
 assert.equal(otherView[0].isMine,false);
 await assert.rejects(f.service.comment(second,post.postId,{requestId:'req1',body:'Edited'}),e=>e.code==='CONFLICT');
 await assert.rejects(f.service.removeOwnComment(actor,post.postId,first.commentId),e=>e.code==='NOT_FOUND');
 assert.deepEqual(await f.service.removeOwnComment(second,post.postId,first.commentId),{removed:true});
 assert.deepEqual(await f.service.removeOwnComment(second,post.postId,first.commentId),{removed:true});
 assert.equal((await f.service.comments(actor,post.postId)).length,0);
 await assert.rejects(f.service.comment(second,post.postId,{requestId:'req1',body:'Welcome!'}),e=>e.code==='CONFLICT');
});
test("cannot comment on processing/removed or another tenant post",async()=>{
 const f=fixture(),post=await f.service.publish(actor,input);
 await assert.rejects(f.service.comment(second,post.postId,{requestId:'one',body:'text'}),e=>e.code==='NOT_FOUND');
 await f.service.settle({tenantId:'tenant1',postId:post.postId,expectedRevision:0});
 await assert.rejects(f.service.comments({...second,tenantId:'tenant2'},post.postId),e=>e.code==='NOT_FOUND');
 await f.service.removeOwn(actor,post.postId);
 await assert.rejects(f.service.comments(second,post.postId),e=>e.code==='NOT_FOUND');
 await assert.rejects(f.service.comment(second,post.postId,{requestId:'two',body:'text'}),e=>e.code==='NOT_FOUND');
});
test("rejects malformed comments and attempts to impersonate authors",async()=>{
 const f=fixture(),post=await f.service.publish(actor,input);
 const invalid=[
  {requestId:'new',body:''},{requestId:'new',body:'x'.repeat(401)},
  {requestId:'new',body:'h\u202eex'},{requestId:'new',body:'hello',authorAccountId:'user1'},
  {requestId:'bad/path',body:'valid'},{requestId:'new',body:42},
 ];
 for(const body of invalid) {
  await assert.rejects(f.service.comment(second,post.postId,body),e=>e.code==='VALIDATION');
 }
 assert.equal(f.rows.size,1);
});

test("public DTOs conceal storage and caller identifiers but retain persisted social counts", async () => {
  const f = fixture();
  const pending = await f.service.publish(actor, input);
  await f.service.settle({tenantId: actor.tenantId, postId: pending.postId, expectedRevision: 0});
  f.rows.set(pending.postId, {...f.rows.get(pending.postId), likeCount: 7, commentCount: 2});
  const publicFeed = await f.service.feed({tenantId: actor.tenantId, viewerId: second.accountId});
  assert.equal(publicFeed.items.length, 1);
  const publicPost = publicFeed.items[0];
  assert.deepEqual([publicPost.likeCount, publicPost.commentCount], [7, 2]);
  for (const secret of ["authorAccountId", "tenantId", "requestId", "assetId"]) {
    assert.equal(Object.hasOwn(publicPost, secret), false, secret + " must not escape");
  }
  for (const list of [await f.service.mine(actor),
                      await (async () => {
                        await f.service.reaction(second, {postId: pending.postId, kind: "save", enabled: true});
                        return f.service.saved(second);
                      })()]) {
    assert.equal(list.length, 1);
    assert.deepEqual([list[0].likeCount, list[0].commentCount], [7, 2]);
    assert.equal(Object.hasOwn(list[0], "assetId"), false);
    assert.equal(Object.hasOwn(list[0], "authorAccountId"), false);
  }
});

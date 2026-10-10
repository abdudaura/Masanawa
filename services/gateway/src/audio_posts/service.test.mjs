import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPostService, AudioPostError } from "./service.js";

const actor = Object.freeze({ tenantId:"tenant1", accountId:"user1", authorId:"user1", authorKind:"human" });
const second = Object.freeze({ tenantId:"tenant1", accountId:"user2", authorId:"user2", authorKind:"human" });
const accepted = {assetId:"asset1",ownerAccountId:"user1",durationMs:25000,bytes:50000,mime:"audio/ogg",state:"ready"};

function fixture() {
 const rows = new Map(), keys = new Map();
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
  async setReaction({tenantId,viewerId,postId,kind,enabled}) {
   const r=rows.get(postId);
   if(!r||r.tenantId!==tenantId||r.status!=="published"||viewerId==="blocked")throw Error("not_visible");
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
   mine:async()=>[],settle:async()=>{throw Error("should not settle");},
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
test("reaction accepts only a boolean and explicit like/save",async()=>{
 const f=fixture();
 await assert.rejects(f.service.reaction(second,{postId:"post1",kind:"hack",enabled:true}),e=>e.code==="VALIDATION");
 await assert.rejects(f.service.reaction(second,{postId:"post1",kind:"like",enabled:"yes"}),e=>e.code==="VALIDATION");
 const post=await f.service.publish(actor,input);
 await f.service.settle({tenantId:"tenant1",postId:post.postId,expectedRevision:0});
 assert.deepEqual(await f.service.reaction(second,{postId:post.postId,kind:"save",enabled:true}),{enabled:true});
});

import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPostService } from "./service.js";
import { registerAudioPostRoutes } from "./routes.js";

const actor = {tenantId:"tenantA",accountId:"viewerA",authorId:"viewerA",authorKind:"human"};
const entries = Array.from({length:57},(_,i)=>({
  tenantId:"tenantA",postId:"post1",commentId:"c"+(100-i),
  authorAccountId:i===0?"viewerA":"someone",requestId:"r"+i,
  body:"Comment "+i,createdAt:new Date(2026,9,10,10,0,0,100-i).toISOString(),removed:false,
}));
function fixture() {
  const calls=[];
  const service=createAudioPostService({
    repository:{async listComments({tenantId,viewerId,postId,limit,beforeCommentId}) {
      calls.push({tenantId,viewerId,postId,limit,beforeCommentId});
      if(tenantId!=="tenantA"||viewerId==="blocked"||postId!=="post1")throw Error("audio_posts.not_visible");
      const start=beforeCommentId==null?0:entries.findIndex(e=>e.commentId===beforeCommentId)+1;
      if(beforeCommentId!=null&&start===0)throw Error("audio_posts.invalid_comment_cursor");
      return entries.slice(start,start+limit);
    }},
    assets:{verifyOwnedReady:async()=>null},moderation:{approve:async()=>false},
    newId:()=> "unused",now:()=>new Date().toISOString(),
  });
  return {service,calls};
}

test("50/7 cursor pages, stable no-duplicate IDs and account-private projection",async()=>{
  const f=fixture();
  const p1=await f.service.commentsPage(actor,"post1");
  assert.equal(p1.items.length,50);
  assert.equal(p1.nextCursor,p1.items.at(-1).commentId);
  assert.deepEqual(Object.keys(p1.items[0]).sort(),
    ["postId","commentId","body","createdAt","removed","isMine"].sort());
  assert.equal(p1.items[0].isMine,true);
  assert.equal(p1.items[1].isMine,false);
  const p2=await f.service.commentsPage(actor,"post1",p1.nextCursor);
  assert.equal(p2.items.length,7);assert.equal(p2.nextCursor,null);
  assert.equal(new Set([...p1.items,...p2.items].map(x=>x.commentId)).size,57);
  assert.equal(f.calls[0].limit,51);
  assert.equal(f.calls[1].beforeCommentId,p1.nextCursor);
});
test("unknown/malformed and foreign cursor or viewer denied",async()=>{
  const f=fixture();
  for(const cursor of ["invalid","bad cursor","","x".repeat(129)]) {
    await assert.rejects(f.service.commentsPage(actor,"post1",cursor),e=>e.code==="VALIDATION");
  }
  await assert.rejects(f.service.commentsPage({...actor,tenantId:"foreign"},"post1"),e=>e.code==="NOT_FOUND");
  await assert.rejects(f.service.commentsPage({...actor,accountId:"blocked"},"post1"),e=>e.code==="NOT_FOUND");
});
test("authenticated route cannot accept spoofed tenant, preserves scoped pagination",async()=>{
  const routes=new Map();const f=fixture();
  registerAudioPostRoutes({
    get:(path,fn)=>routes.set(path,fn),post:()=>{},put:()=>{},delete:()=>{},
  },{
    service:f.service,requireActor:async h=>{assert.equal(h,"Bearer active");return actor;},
  });
  const route=routes.get("/v1/audio-posts/:postId/comments/page");
  assert.equal(typeof route,"function");
  const reply={code(n){this.status=n;return this;},send(result){return result;}};
  const p1=await route({headers:{authorization:"Bearer active"},params:{postId:"post1"},query:{}},reply);
  assert.equal(p1.items.length,50);
  const p2=await route({headers:{authorization:"Bearer active"},params:{postId:"post1"},query:{cursor:p1.nextCursor}},reply);
  assert.equal(p2.items.length,7);
  const bad=await route({headers:{authorization:"Bearer active"},params:{postId:"post1"},query:{tenantId:"foreign"}},reply);
  assert.equal(reply.status,400);assert.equal(bad.code,"VALIDATION");
  assert.ok(f.calls.every(c=>c.tenantId==="tenantA"));
});

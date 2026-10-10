import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPostPlaybackService, registerAudioPostPlaybackRoutes } from "./playback.js";
import { toPublicAudioPost } from "./contract.js";

const actor = {tenantId:"tenant-a",accountId:"account-a",authorId:"account-a",authorKind:"human"};
const post = {tenantId:"tenant-a",postId:"post-a",authorId:"creator-a",
  authorAccountId:"creator-account",authorKind:"human",assetId:"asset-a",
  requestId:"original",title:"Hello",durationMs:12000,status:"published",
  revision:2,createdAt:"2026-10-10T00:00:00Z",publishedAt:"2026-10-10T00:00:00Z"};
const listenSessionId = "123e4567-e89b-42d3-a456-426614174000";
const signed = {url:"https://storage.example.com/audio/a?sig=private",
  expiresAtMs:2000000040000,cacheControl:"private, no-store"};

function fixture() {
  const calls = {opens:[],completions:[],media:0};
  let visible = true;
  let currentActor = {...actor};
  const store = {
    async open(input) {calls.opens.push(input);return listenSessionId;},
    async complete(input) {
      calls.completions.push(input);
      if (!await input.canView(post.authorAccountId)) {
        throw Error("audio_posts.listen_not_visible");
      }
      return {counted:true,listenCount:7};
    },
  };
  const service = createAudioPostPlaybackService({
    repository:{async byId() {return post;}},
    visibility:{async canView(){return visible;}},
    media:{async issue(){calls.media++;return signed;}},
    signerHost:"storage.example.com",nowMs:()=>2000000000000,
    listens:store,
  });
  return {service,calls,store,setVisibility:v=>{visible=v;},
    setActor:v=>{currentActor=v;},currentActor:()=>currentActor};
}

test("ticket only opens a durable scoped listen session after verified media authorization", async()=>{
  const f=fixture();
  const ticket=await f.service.ticket({
    actor,postId:"post-a",currentActor:f.currentActor,
  });
  assert.equal(ticket.listenSessionId,listenSessionId);
  assert.equal(f.calls.opens.length,1);
  assert.deepEqual(f.calls.opens[0],{
    tenantId:"tenant-a",viewerId:"account-a",postId:"post-a",
    revision:2,durationMs:12000,
  });
  assert.equal(f.calls.completions.length,0);
  assert.equal(f.calls.media,1);
});

test("authenticated qualified progress uses immutable principal, not spoofed body",async()=>{
  const f=fixture();
  const receipt=await f.service.countListen({
    actor,postId:"post-a",currentActor:f.currentActor,
    body:{listenSessionId,playedMs:3900},
  });
  assert.deepEqual(receipt,{counted:true,listenCount:7});
  assert.equal(f.calls.completions.length,1);
  assert.equal(f.calls.completions[0].viewerId,"account-a");
  assert.equal(f.calls.completions[0].tenantId,"tenant-a");
  assert.equal(f.calls.completions[0].playedMs,3900);
});

test("foreign actor, new auth session, forged fields and malformed progress fail closed",async()=>{
  const f=fixture();
  for(const body of [
    {listenSessionId,playedMs:4000,tenantId:"foreign"},
    {listenSessionId,playedMs:-3},
    {listenSessionId:"bad",playedMs:4000},
    {listenSessionId,playedMs:4000.1},
    {listenSessionId,playedMs:"4000"},
    [],
  ]) {
    await assert.rejects(f.service.countListen({
      actor,postId:"post-a",currentActor:f.currentActor,body,
    }),e=>e.code==="VALIDATION");
  }
  f.setActor({...actor,accountId:"different"});
  await assert.rejects(f.service.countListen({
    actor,postId:"post-a",currentActor:f.currentActor,
    body:{listenSessionId,playedMs:4000},
  }),e=>e.code==="AUTH_REQUIRED");
  assert.equal(f.calls.completions.length,0);
});

test("revoked visibility rejects both ticket and counting",async()=>{
  const f=fixture();
  f.setVisibility(false);
  await assert.rejects(f.service.ticket({
    actor,postId:"post-a",currentActor:f.currentActor,
  }),e=>e.code==="NOT_FOUND");
  await assert.rejects(f.service.countListen({
    actor,postId:"post-a",currentActor:f.currentActor,
    body:{listenSessionId,playedMs:4000},
  }),e=>e.code==="NOT_FOUND");
  assert.equal(f.calls.opens.length,0);
});

test("authenticated HTTP listen route maps errors and never trusts account body",async()=>{
  const f=fixture(), routes=new Map();
  registerAudioPostPlaybackRoutes({
    get:(path,handler)=>routes.set("GET "+path,handler),
    post:(path,handler)=>routes.set("POST "+path,handler),
  },{service:f.service,requireActor:async auth=>{
    assert.equal(auth,"Bearer granted");return actor;
  }});
  const handler=routes.get("POST /v1/audio-posts/:postId/listen");
  assert.equal(typeof handler,"function");
  const reply={status:200,headers:{},header(k,v){this.headers[k]=v;return this;},
    code(n){this.status=n;return this;},send(v){return v;}};
  const ok=await handler({headers:{authorization:"Bearer granted"},
    params:{postId:"post-a"},body:{listenSessionId,playedMs:4000}},reply);
  assert.equal(ok.listenCount,7);
  assert.equal(reply.headers["Cache-Control"],"private, no-store");
  const denied=await handler({headers:{authorization:"Bearer granted"},
    params:{postId:"post-a"},body:{listenSessionId,playedMs:0,userId:"attacker"}},reply);
  assert.equal(reply.status,400);
  assert.equal(denied.code,"VALIDATION");
});

test("public qualified-listen projection never reveals viewer or signed grant",()=>{
  const dto=toPublicAudioPost({...post,listenCount:9});
  assert.equal(dto.listenCount,9);
  assert.equal(dto.likeCount,0);
  assert.equal(dto.commentCount,0);
  for(const privateKey of ["tenantId","authorAccountId","assetId","requestId","listenSessionId"]) {
    assert.equal(Object.hasOwn(dto,privateKey),false);
  }
});

test("optional listening analytics outage never blocks otherwise authorized private playback",async()=>{
  const f=fixture();
  f.store.open=async()=>{throw Error("database temporarily unavailable")};
  const ticket=await f.service.ticket({
    actor,postId:"post-a",currentActor:f.currentActor,
  });
  assert.equal(ticket.listenSessionId,undefined);
  assert.equal(ticket.url,signed.url);
  assert.equal(f.calls.media,1);
  assert.equal(f.calls.completions.length,0);
});

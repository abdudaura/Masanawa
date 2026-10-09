// Dependency-free verification of the F09 credential boundary; Node >=22.
// Run: node --experimental-strip-types --test services/gateway/src/talk_replay/egress/verify_livekit_boundary.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createLiveKitReplayEgress } from "./livekit_egress.ts";

const base={
  serverUrl:"wss://live.example.test",apiKey:"key",apiSecret:"0123456789abcdef0123456789abcdef",
  s3:{endpoint:"https://ams3.example.test",region:"ams3",bucket:"private",accessKey:"space-key",secret:"my-SECRET1234"},
  now:()=>new Date("2026-10-07T10:00:00.000Z"),
};
for(const serverUrl of [
  "http://live.example.test","ws://live.example.test","https://user:pass@live.example.test",
  "wss://live.example.test/path","wss://live.example.test/?secret=1",
  "https://live.example.test/#hash","not a URL",
]){
  test("reject LiveKit URL "+serverUrl,()=>{
    assert.throws(()=>createLiveKitReplayEgress({...base,serverUrl}),TypeError);
  });
}
for(const endpoint of [
  "http://s3.example.test","https://user:pass@s3.example.test","https://s3.example.test/path",
  "https://s3.example.test/?secret=1","https://s3.example.test/#hash",
]){
  test("reject S3 endpoint "+endpoint,()=>{
    assert.throws(()=>createLiveKitReplayEgress({...base,s3:{...base.s3,endpoint}}),TypeError);
  });
}
test("start preserves canonical secure URL, JWT and storage fields",async()=>{
  let uri,opts;
  const client=createLiveKitReplayEgress({...base,fetchImpl:async(u,i)=>{
    uri=u;opts=i;return new Response(JSON.stringify({egress_id:"EG_one"}),{status:200});
  }});
  assert.deepEqual(await client.start({roomName:"talk1",objectKey:"talk-replays/abc.ogg"}),{egressId:"EG_one"});
  assert.equal(uri,"https://live.example.test/twirp/livekit.Egress/StartEgress");
  assert.equal(opts.redirect,"manual");
  assert.equal(JSON.parse(opts.body).storage.s3.secret,"my-SECRET1234");
  const [head,payload,signature]=opts.headers.authorization.substring(7).split(".");
  assert.equal(signature,createHmac("sha256",base.apiSecret).update(head+"."+payload,"utf8").digest("base64url"));
});
test("StartEgress never follows 307 to alternate host",async()=>{
  let seen=0;
  const client=createLiveKitReplayEgress({...base,fetchImpl:async(_u,o)=>{
    seen++;assert.equal(o.redirect,"manual");
    return new Response(null,{status:307,headers:{location:"https://attacker.example/collect"}});
  }});
  await assert.rejects(client.start({roomName:"talk1",objectKey:"test.ogg"}),/egress_startegress_failed/);
  assert.equal(seen,1);
});
test("StopEgress never follows 308 to alternate host",async()=>{
  let seen=0;
  const client=createLiveKitReplayEgress({...base,fetchImpl:async(_u,o)=>{
    seen++;assert.equal(o.redirect,"manual");
    return new Response(null,{status:308,headers:{location:"https://attacker.example/collect"}});
  }});
  await assert.rejects(client.stop("EG_one"),/egress_stopegress_failed/);
  assert.equal(seen,1);
});
test("reject streamed >64KiB reply",async()=>{
  const client=createLiveKitReplayEgress({...base,fetchImpl:async()=>new Response("x".repeat(65537),{status:200})});
  await assert.rejects(client.start({roomName:"talk1",objectKey:"test.ogg"}),/egress_response_too_large/);
});
test("reject declared >64KiB reply",async()=>{
  const client=createLiveKitReplayEgress({...base,fetchImpl:async()=>
    new Response('{"egress_id":"EG_one"}',{status:200,headers:{"content-length":"99999"}})});
  await assert.rejects(client.start({roomName:"talk1",objectKey:"test.ogg"}),/egress_response_too_large/);
});
for(const body of ["not json","null","[]","23"]){
  test("reject wrong JSON "+body,async()=>{
    const client=createLiveKitReplayEgress({...base,fetchImpl:async()=>new Response(body,{status:200})});
    await assert.rejects(client.start({roomName:"talk1",objectKey:"test.ogg"}),/egress_invalid_response/);
  });
}
test("StopEgress preserves request shape and success",async()=>{
  let payload;
  const client=createLiveKitReplayEgress({...base,fetchImpl:async(_u,o)=>{
    payload=JSON.parse(o.body);return new Response("{}",{status:200});
  }});
  await client.stop("EG_one");
  assert.deepEqual(payload,{egress_id:"EG_one"});
});

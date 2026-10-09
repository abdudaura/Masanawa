// Standalone boundary checks when pnpm/Vitest is unavailable.
// Execute from the repository: node --experimental-strip-types --test services/gateway/src/talk_replay/playback/verify_s3_boundary.mjs
// Requires Node.js 22+. This checks only the S3 adapter and fake fetch response
// behavior, not actual S3, auth, database, audio or deployed Gateway integration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReplayObjectStore } from "./s3_object_store.ts";

const settings={
  endpoint:"https://s3.example.test",
  region:"test",
  bucket:"private",
  accessKey:"access",
  secret:"0123456789abcdef",
  now:()=>new Date("2026-10-07T10:00:00.000Z"),
};
const key="talk-replays/talk/replay.ogg";

test("signed GET stays on the configured origin, retains SigV4 and hashes",async()=>{
  const payload=new TextEncoder().encode("recorded audio");
  let calls=0;
  const store=createReplayObjectStore({...settings,fetchImpl:async(url,init)=>{
    calls++;
    assert.equal(init?.redirect,"manual");
    assert.equal(new URL(url).host,"s3.example.test");
    assert.match(init?.headers?.authorization,/^AWS4-HMAC-SHA256 Credential=access\//);
    return new Response(payload,{status:200,headers:{"content-length":String(payload.byteLength)}});
  }});
  assert.equal(await store.checksumSha256(key),
    createHash("sha256").update(payload).digest("hex"));
  assert.equal(calls,1);
});

test("GET 307 never follows a signed request to an untrusted origin",async()=>{
  let calls=0;
  const store=createReplayObjectStore({...settings,fetchImpl:async(_url,init)=>{
    calls++;
    assert.equal(init?.redirect,"manual");
    return new Response(null,{status:307,headers:{location:"https://evil.example/steal"}});
  }});
  await assert.rejects(()=>store.checksumSha256(key),/talks\.replay\.object_unavailable/);
  assert.equal(calls,1);
});

test("DELETE 308 cannot count as successful deletion or leak credentials",async()=>{
  let calls=0;
  const store=createReplayObjectStore({...settings,fetchImpl:async(_url,init)=>{
    calls++;
    assert.equal(init?.redirect,"manual");
    assert.equal(init?.method,"DELETE");
    return new Response(null,{status:308,headers:{location:"https://evil.example/steal"}});
  }});
  await assert.rejects(()=>store.deleteObject(key),/talks\.replay\.object_delete_failed/);
  assert.equal(calls,1);
});

test("S3 endpoint requires clean HTTPS origin without URL extras",()=>{
  for(const endpoint of [
    "http://s3.example.test",
    "https://user:pass@s3.example.test",
    "https://s3.example.test/?x=1",
    "https://s3.example.test/#fragment",
    "https://s3.example.test/bucket",
  ]){
    assert.throws(()=>createReplayObjectStore({...settings,endpoint}),/must be an HTTPS origin/);
  }
});

test("successful DELETE keeps explicit manual redirect policy",async()=>{
  const store=createReplayObjectStore({...settings,fetchImpl:async(_url,init)=>{
    assert.equal(init?.method,"DELETE");
    assert.equal(init?.redirect,"manual");
    return new Response(null,{status:204});
  }});
  await store.deleteObject(key);
});

test("404 bounded retry still processes an eventually available object",async()=>{
  let calls=0;
  const waits=[];
  const store=createReplayObjectStore({...settings,availabilityAttempts:3,
    availabilityDelayMs:4,sleep:async n=>{waits.push(n);},
    fetchImpl:async()=>{
      calls++;
      return calls===3?new Response("ok",{status:200}):new Response(null,{status:404});
    }});
  assert.equal(await store.checksumSha256(key),
    createHash("sha256").update("ok").digest("hex"));
  assert.equal(calls,3);
  assert.deepEqual(waits,[4,8]);
});

test("signed playback URL still has HTTPS, SigV4 and bounded expiry",async()=>{
  const store=createReplayObjectStore(settings);
  const credential=await store.presignGet(key,300);
  const url=new URL(credential.url);
  assert.equal(url.protocol,"https:");
  assert.equal(url.hostname,"s3.example.test");
  assert.equal(url.searchParams.get("X-Amz-Expires"),"300");
  assert.ok(url.searchParams.has("X-Amz-Signature"));
  assert.equal(credential.expiresAt,"2026-10-07T10:05:00.000Z");
  assert.doesNotMatch(credential.url,/0123456789abcdef/);
});

test("oversized S3 object is refused before checksum processing",async()=>{
  const store=createReplayObjectStore({...settings,maxObjectBytes:3,
    fetchImpl:async()=>new Response("12345",{status:200,headers:{"content-length":"5"}})});
  await assert.rejects(()=>store.checksumSha256(key),/talks\.replay\.object_too_large/);
});

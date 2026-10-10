import { test } from "node:test";
import assert from "node:assert/strict";
import { createTalkReplayCoordinator } from "./coordinator.ts";

// Run: node --experimental-strip-types --test services/gateway/src/talk_replay/egress/verify_attempt_identity.mjs
// This invokes the actual TypeScript coordinator without Vitest or external
// providers. It is NOT a substitute for live Postgres/LiveKit/S3 verification.
const request = {
  tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
  startedAt:"2026-10-07T10:00:00.000Z",
};

function harness(rejectedClaims = new Set(), preexisting = null) {
  const keys=[],stopped=[],deleted=[],created=[];
  let claims=0;
  const media={
    async current(){return preexisting;},
    async currentForTalk(){return null;},
    async createStarted(value){
      created.push(value);
      if(rejectedClaims.has(++claims)) throw Error("talks.replay.media_identity_conflict");
      return {...value,status:"recording",completedAt:null,checksumSha256:null};
    },
    async markStopped(){},
    async markReady(){},
    async markAborted(){},
    async playbackObject(){return null;},
  };
  const coordinator=createTalkReplayCoordinator({
    replay:{},
    media,
    egress:{
      async start({roomName,objectKey}){
        assert.equal(roomName,request.talkId);
        keys.push(objectKey);
        return {egressId:`EG_${keys.length}`};
      },
      async stop(id){stopped.push(id);},
    },
    objects:{
      async deleteObject(key){deleted.push(key);},
      async checksumSha256(){throw Error("unused");},
      async presignGet(){throw Error("unused");},
    },
    playbackTtlSeconds:300,
  });
  return {coordinator,keys,stopped,deleted,created};
}

test("concurrent loser cleanup cannot delete or overwrite winning object",async()=>{
  const f=harness(new Set([2]));
  const results=await Promise.allSettled([
    f.coordinator.start(request),f.coordinator.start(request),
  ]);
  assert.deepEqual(results.map(result=>result.status),["fulfilled","rejected"]);
  assert.equal(f.keys.length,2);
  assert.notEqual(f.keys[0],f.keys[1]);
  for(const key of f.keys){
    assert.ok(key.startsWith("talk-replays/tenant_1/talk_1/recording_1_"));
    assert.match(key,/_[0-9a-f-]{36}[.]ogg$/);
  }
  assert.deepEqual(f.stopped,["EG_2"]);
  assert.deepEqual(f.deleted,[f.keys[1]]);
  assert.notEqual(f.created[0].objectKey,f.created[1].objectKey);
});

test("retry after SQL write failure always uses a fresh object key",async()=>{
  const f=harness(new Set([1]));
  await assert.rejects(f.coordinator.start(request),/media_identity_conflict/);
  await f.coordinator.start(request);
  assert.notEqual(f.keys[0],f.keys[1]);
  assert.deepEqual(f.stopped,["EG_1"]);
  assert.deepEqual(f.deleted,[f.keys[0]]);
});

test("already recorded identity is idempotently ignored before new Egress",async()=>{
  const f=harness(new Set(),{status:"recording"});
  await f.coordinator.start(request);
  assert.deepEqual(f.keys,[]);
  assert.deepEqual(f.deleted,[]);
});

test("invalid scoped storage identifier rejects before external Egress",async()=>{
  const f=harness();
  await assert.rejects(f.coordinator.start({...request,tenantId:"!"}),
    /Replay storage identifier is invalid/);
  assert.deepEqual(f.keys,[]);
  assert.deepEqual(f.deleted,[]);
});

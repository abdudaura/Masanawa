import {test} from "node:test";
import assert from "node:assert/strict";
import {createTalkReplayCoordinator} from "./coordinator.ts";

// Exact production coordinator, native Node 22 TypeScript stripping. No
// gateway boot, credentials, network or database changes.
// node --experimental-strip-types --test services/gateway/src/talk_replay/egress/verify_compensation_stop.mjs

const request={tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",startedAt:"2026-10-07T10:00:00.000Z"};

function harness(mode){
  const events=[];
  let objectKey;
  const media={
    async current(){return mode==="exists"?{status:"recording"}:null;},
    async createStarted(data){
      events.push("postgres:claim");
      if(mode!=="exists"&&mode!=="success") throw Error("postgres unavailable");
      return {...data,status:"recording"};
    },
  };
  const egress={
    async start({objectKey:key}){
      objectKey=key;
      events.push("livekit:start");
      return {egressId:"EG_1"};
    },
    async stop(id){
      assert.equal(id,"EG_1");
      events.push("livekit:stop");
      if(mode==="stop-failed") throw Error("livekit unavailable");
    },
  };
  const objects={
    async deleteObject(key){
      assert.equal(key,objectKey);
      events.push("s3:delete");
      if(mode==="delete-failed") throw Error("s3 unavailable");
    },
  };
  return {events,coordinator:createTalkReplayCoordinator({
    replay:{},media,egress,objects,playbackTtlSeconds:300,
  })};
}
test("uncertain stop never deletes an object still being written",async()=>{
  const {coordinator,events}=harness("stop-failed");
  const failure=await coordinator.start(request).then(()=>null,error=>error);
  assert.ok(failure instanceof AggregateError);
  assert.equal(failure.message,"talks.replay.egress_compensation_stop_uncertain");
  assert.deepEqual(failure.errors.map(error=>error.message),["postgres unavailable","livekit unavailable"]);
  assert.deepEqual(events,["livekit:start","postgres:claim","livekit:stop"]);
});
test("stop confirmed before S3 DELETE; delete failures are surfaced",async()=>{
  const {coordinator,events}=harness("delete-failed");
  const failure=await coordinator.start(request).then(()=>null,error=>error);
  assert.ok(failure instanceof AggregateError);
  assert.equal(failure.message,"talks.replay.egress_compensation_delete_failed");
  assert.deepEqual(failure.errors.map(error=>error.message),["postgres unavailable","s3 unavailable"]);
  assert.deepEqual(events,["livekit:start","postgres:claim","livekit:stop","s3:delete"]);
});
test("normal compensation rethrows the database failure",async()=>{
  const {coordinator,events}=harness("clean");
  await assert.rejects(coordinator.start(request),/postgres unavailable/);
  assert.deepEqual(events,["livekit:start","postgres:claim","livekit:stop","s3:delete"]);
});
test("persisted job and preexisting identity require no compensation",async()=>{
  const existing=harness("exists");
  await existing.coordinator.start(request);
  assert.deepEqual(existing.events,[]);
  const fresh=harness("success");
  await fresh.coordinator.start(request);
  assert.deepEqual(fresh.events,["livekit:start","postgres:claim"]);
});

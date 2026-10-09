import {test} from "node:test";
import assert from "node:assert/strict";
import {createLiveKitReplayEgress} from "./livekit_egress.ts";

// Dependency-free Node 22 source-level regression:
// node --experimental-strip-types --test services/gateway/src/talk_replay/egress/verify_livekit_timeout.mjs
// Simulates provider behavior; does not contact LiveKit, S3 or PostgreSQL.
const settings={
  serverUrl:"wss://live.example.test",
  apiKey:"example-key",
  apiSecret:"0123456789abcdef0123456789abcdef",
  s3:{endpoint:"https://s3.example.test",region:"test",bucket:"test",
    accessKey:"test-id",secret:"12345678"},
};

for(const operation of ["start","stop"]){
  test(`timeout aborts one ${operation} RPC, reporting uncertain side effect`,async()=>{
    let requests=0;
    let observedSignal;
    const client=createLiveKitReplayEgress({...settings,requestTimeoutMs:20,
      fetchImpl:async(_url,init)=>{
        requests++;
        observedSignal=init.signal;
        return await new Promise((_resolve,reject)=>{
          init.signal.addEventListener("abort",()=>reject(init.signal.reason),{once:true});
        });
      },
    });
    const promise=operation==="start"
      ?client.start({roomName:"talk",objectKey:"private/attempt.ogg"})
      :client.stop("EG_inflight");
    await assert.rejects(promise,new RegExp(`talks.replay.egress_${operation==="start"?"startegress":"stopegress"}_timeout_uncertain`));
    assert.equal(requests,1);
    assert.equal(observedSignal.aborted,true);
  });
}

test("timeout configuration rejects unsupported values",()=>{
  for(const requestTimeoutMs of [0,-1,1,9,120001,1.5,NaN,Infinity]){
    assert.throws(()=>createLiveKitReplayEgress({...settings,requestTimeoutMs}),/request timeout/);
  }
});
test("normal provider 403 remains distinguishable from uncertain timeout",async()=>{
  const client=createLiveKitReplayEgress({...settings,requestTimeoutMs:50,
    fetchImpl:async()=>new Response(null,{status:403}),
  });
  await assert.rejects(client.stop("EG_denied"),/egress_stopegress_failed/);
});
test("successful StartEgress preserves the returned provider identity",async()=>{
  let calls=0;
  const client=createLiveKitReplayEgress({...settings,requestTimeoutMs:50,
    fetchImpl:async(_url,init)=>{
      calls++;
      assert.ok(init.signal);
      assert.equal(init.redirect,"manual");
      return new Response(JSON.stringify({egress_id:"EG_live"}),{status:200});
    },
  });
  assert.deepEqual(await client.start({roomName:"talk",objectKey:"private/attempt.ogg"}),{egressId:"EG_live"});
  assert.equal(calls,1);
});

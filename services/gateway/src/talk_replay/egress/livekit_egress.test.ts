import { createHmac } from "node:crypto";
import { describe,expect,it } from "vitest";
import { createLiveKitReplayEgress } from "./livekit_egress.js";

describe("LiveKit replay Egress client",()=>{
  it("starts an audio-only OGG recording into private S3-compatible storage",async()=>{
    const calls:Array<{url:string;init:RequestInit}>=[];
    const client=createLiveKitReplayEgress({
      serverUrl:"wss://live.example.test",
      apiKey:"api-key",
      apiSecret:"0123456789abcdef0123456789abcdef",
      s3:{
        endpoint:"https://ams3.digitaloceanspaces.com",
        region:"ams3",
        bucket:"masanawa-private",
        accessKey:"space-key",
        secret:"space-secret",
      },
      now:()=>new Date("2026-10-07T10:00:00.000Z"),
      fetchImpl:async(url,init)=>{
        calls.push({url:String(url),init:init??{}});
        return new Response(JSON.stringify({egress_id:"EG_test"}),{status:200,headers:{"content-type":"application/json"}});
      },
    });

    await expect(client.start({
      roomName:"talk_1",
      objectKey:"talk-replays/tenant/talk/recording.ogg",
    })).resolves.toEqual({egressId:"EG_test"});

    expect(calls[0]?.url).toContain("/twirp/livekit.Egress/StartEgress");
    const body=JSON.parse(String(calls[0]?.init.body));
    expect(body).toMatchObject({
      room_name:"talk_1",
      template:{audio_only:true},
      outputs:[{file:{file_type:"OGG",filepath:"talk-replays/tenant/talk/recording.ogg"}}],
      storage:{s3:{
        bucket:"masanawa-private",
        endpoint:"https://ams3.digitaloceanspaces.com",
        force_path_style:true,
      }},
    });
    const auth=String((calls[0]?.init.headers as Record<string,string>).authorization);
    const token=auth.replace("Bearer ","");
    const [header,payload,signature]=token.split(".");
    const claims=JSON.parse(Buffer.from(payload!,"base64url").toString("utf8"));
    expect(claims.video).toEqual({roomRecord:true});
    expect(signature).toBe(
      createHmac("sha256","0123456789abcdef0123456789abcdef")
        .update(`${header}.${payload}`,"utf8").digest("base64url"),
    );
  });

  it("stops an egress by id",async()=>{
    let body:unknown;
    const client=createLiveKitReplayEgress({
      serverUrl:"https://live.example.test",
      apiKey:"api-key",
      apiSecret:"0123456789abcdef0123456789abcdef",
      s3:{endpoint:"https://s3.example.test",region:"test",bucket:"bucket",accessKey:"key",secret:"12345678"},
      fetchImpl:async(_url,init)=>{
        body=JSON.parse(String(init?.body));
        return new Response(JSON.stringify({egress_id:"EG_test"}),{status:200,headers:{"content-type":"application/json"}});
      },
    });
    await client.stop("EG_test");
    expect(body).toEqual({egress_id:"EG_test"});
  });
});


const config={
  serverUrl:"wss://live.example.test",
  apiKey:"api-key",
  apiSecret:"0123456789abcdef0123456789abcdef",
  s3:{endpoint:"https://ams3.digitaloceanspaces.com",region:"ams3",bucket:"private-replay",accessKey:"access-id",secret:"12345678"},
} as const;

describe("LiveKit Egress credential boundary",()=>{
  it.each([
    "http://live.example.test",
    "ws://live.example.test",
    "https://user:password@live.example.test",
    "wss://live.example.test/custom/path",
    "wss://live.example.test/?token=secret",
    "https://live.example.test/#fragment",
    "not a URL",
  ])("rejects insecure or non-origin LiveKit URL %s before any request",(serverUrl)=>{
    expect(()=>createLiveKitReplayEgress({...config,serverUrl})).toThrow();
  });

  it.each([
    "http://spaces.example.test",
    "https://user:password@spaces.example.test",
    "https://spaces.example.test/custom",
    "https://spaces.example.test/?token=secret",
    "https://spaces.example.test/#fragment",
  ])("rejects non-clean S3 destination %s before forwarding credentials",(endpoint)=>{
    expect(()=>createLiveKitReplayEgress({
      ...config,s3:{...config.s3,endpoint},
    })).toThrow();
  });

  it("does not follow a redirect carrying the signed token or S3 secret",async()=>{
    const calls:RequestInit[]=[];
    const client=createLiveKitReplayEgress({
      ...config,
      fetchImpl:async(_url,init)=>{
        calls.push(init??{});
        return new Response(null,{status:307,headers:{location:"https://attacker.example.test/ingest"}});
      },
    });
    await expect(client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"}))
      .rejects.toThrow("talks.replay.egress_startegress_failed");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.redirect).toBe("manual");
    expect(String(calls[0]?.body)).toContain('"secret":"12345678"');
  });

  it("never retries or follows StopEgress redirects",async()=>{
    const calls:RequestInit[]=[];
    const client=createLiveKitReplayEgress({
      ...config,
      fetchImpl:async(_url,init)=>{
        calls.push(init??{});
        return new Response(null,{status:308,headers:{location:"https://other.example.test/stop"}});
      },
    });
    await expect(client.stop("EG_test"))
      .rejects.toThrow("talks.replay.egress_stopegress_failed");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.redirect).toBe("manual");
  });

  it("bounds streamed response bytes even without a Content-Length header",async()=>{
    const client=createLiveKitReplayEgress({
      ...config,
      fetchImpl:async()=>new Response("x".repeat(65*1024),{status:200}),
    });
    await expect(client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"}))
      .rejects.toThrow("talks.replay.egress_response_too_large");
  });

  it("rejects declared excessive response length before body consumption",async()=>{
    const client=createLiveKitReplayEgress({
      ...config,
      fetchImpl:async()=>new Response('{"egress_id":"EG_1"}',{
        status:200,headers:{"content-length":"999999"},
      }),
    });
    await expect(client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"}))
      .rejects.toThrow("talks.replay.egress_response_too_large");
  });

  it.each(["not-json","[]","null","23"])("rejects malformed or non-object LiveKit responses",(body)=>{
    const client=createLiveKitReplayEgress({...config,fetchImpl:async()=>new Response(body,{status:200})});
    await expect(client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"}))
      .rejects.toThrow("talks.replay.egress_invalid_response");
  });

  it("keeps secure WebSocket origin conversion and normal StartEgress response working",async()=>{
    let observedUrl="";
    const client=createLiveKitReplayEgress({
      ...config,
      fetchImpl:async(url)=>{
        observedUrl=String(url);
        return new Response(JSON.stringify({egress_id:"EG_secure"}),{status:200});
      },
    });
    await expect(client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"}))
      .resolves.toEqual({egressId:"EG_secure"});
    expect(observedUrl).toBe("https://live.example.test/twirp/livekit.Egress/StartEgress");
  });
});


describe("F09 bounded LiveKit Egress side-effect uncertainty",()=>{
  it.each(["start","stop"] as const)(
    "aborts an unresponsive %s request without blindly retrying",async(operation)=>{
      let calls=0;
      let signalSeen:AbortSignal|undefined;
      const client=createLiveKitReplayEgress({
        ...config,
        requestTimeoutMs:20,
        fetchImpl:async(_url,init)=>{
          calls++;
          signalSeen=init?.signal??undefined;
          return await new Promise<Response>((_resolve,reject)=>{
            if(!init?.signal) return reject(new Error("missing AbortSignal"));
            init.signal.addEventListener("abort",()=>{
              reject(init.signal?.reason??new Error("aborted"));
            },{once:true});
          });
        },
      });
      const attempt=operation==="start"
        ? client.start({roomName:"talk_1",objectKey:"talk-replays/tenant/recording.ogg"})
        : client.stop("EG_active");
      await expect(attempt).rejects.toThrow(
        `talks.replay.egress_${operation==="start"?"startegress":"stopegress"}_timeout_uncertain`,
      );
      expect(calls).toBe(1);
      expect(signalSeen?.aborted).toBe(true);
    },
  );

  it.each([0,-1,1,9,120001,1.5,Number.NaN,Number.POSITIVE_INFINITY])(
    "rejects unsafe request timeout %s before any provider operation",(requestTimeoutMs)=>{
      expect(()=>createLiveKitReplayEgress({...config,requestTimeoutMs}))
        .toThrow("LiveKit Egress request timeout");
    },
  );

  it("keeps ordinary provider denial distinct from timeout uncertainty",async()=>{
    const client=createLiveKitReplayEgress({
      ...config,requestTimeoutMs:50,
      fetchImpl:async()=>new Response("denied",{status:403}),
    });
    await expect(client.stop("EG_active"))
      .rejects.toThrow("talks.replay.egress_stopegress_failed");
  });
});

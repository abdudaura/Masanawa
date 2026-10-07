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

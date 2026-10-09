import { createHmac } from "node:crypto";
import { describe,expect,it } from "vitest";
import { createLiveKitTalkMediaAdmin } from "./livekit_admin.js";

describe("LiveKit Talk media admin",()=>{
  it("revokes publish permission immediately through RoomService",async()=>{
    const calls:Array<{url:string;init:RequestInit}>=[];
    const admin=createLiveKitTalkMediaAdmin({
      serverUrl:"wss://live.example.test",apiKey:"key",apiSecret:"0123456789abcdef0123456789abcdef",
      now:()=>new Date("2026-10-07T10:00:00.000Z"),
      fetchImpl:async (url,init)=>{calls.push({url:String(url),init:init??{}});return new Response("{}",{status:200});},
    });
    await admin.setCanPublish({room:"talk_1",identity:"user:session",canPublish:false});
    expect(calls[0]?.url).toContain("/twirp/livekit.RoomService/UpdateParticipant");
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      room:"talk_1",identity:"user:session",
      permission:{can_publish:false,can_subscribe:true,can_publish_data:false},
    });
    const auth=String((calls[0]?.init.headers as Record<string,string>).authorization);
    const jwt=auth.replace("Bearer ","");
    const [h,p,s]=jwt.split(".");
    expect(createHmac("sha256","0123456789abcdef0123456789abcdef").update(`${h}.${p}`,"utf8").digest("base64url")).toBe(s);
  });
  it("forcibly removes a participant from the room",async()=>{
    let body:unknown;
    const admin=createLiveKitTalkMediaAdmin({
      serverUrl:"wss://live.example.test",apiKey:"key",apiSecret:"0123456789abcdef0123456789abcdef",
      fetchImpl:async (_url,init)=>{body=JSON.parse(String(init?.body));return new Response("{}",{status:200});},
    });
    await admin.removeParticipant({room:"talk_1",identity:"user:session"});
    expect(body).toMatchObject({
      room:"talk_1",
      identity:"user:session",
    });
    expect((body as {revoke_token_ts:number}).revoke_token_ts).toBeGreaterThan(1_700_000_000_000);
  });

  it("uses exact Unix milliseconds for LiveKit Cloud revocation, not JWT seconds",async()=>{
    let body:unknown;
    const now=new Date("2026-10-08T06:30:00.000Z");
    const admin=createLiveKitTalkMediaAdmin({
      serverUrl:"wss://live.example.test",
      apiKey:"key",
      apiSecret:"0123456789abcdef0123456789abcdef",
      now:()=>now,
      fetchImpl:async (_url,init)=>{
        body=JSON.parse(String(init?.body));
        return new Response("{}",{status:200});
      },
    });
    await admin.removeParticipant({room:"talk_1",identity:"user:talk-live_old"});
    expect(body).toMatchObject({
      room:"talk_1",
      identity:"user:talk-live_old",
      revoke_token_ts:now.getTime(),
    });
  });
});


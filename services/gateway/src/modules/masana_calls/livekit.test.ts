import {describe,it,expect} from "vitest";
import {createMasanaLiveKitProvider} from "./livekit.js";
describe("J04 LiveKit one-room least-privilege issuance",()=>{
  it("never grants camera, data, room admin or Talk seat authority",async()=>{
    const provider=createMasanaLiveKitProvider({
      url:"wss://lk.example",apiKey:"key",
      apiSecret:"secret-with-required-length",
      dispatch:async()=>{},stop:async()=>{},
      now:()=>new Date("2026-10-11T03:00:00Z"),
    });
    const result=await provider.token({
      callId:"call-a",roomName:"masana-server-only",fanUserId:"fan-a",
    });
    const payload=JSON.parse(Buffer.from(result.token.split(".")[1]!,"base64url").toString());
    expect(payload.video.room).toBe("masana-server-only");
    expect(payload.video.canPublishSources).toEqual(["microphone"]);
    expect(payload.video.canPublishData).toBe(false);
    expect(payload.video.roomAdmin).toBeUndefined();
    expect(payload.exp-payload.iat).toBe(90);
  });
  it("refuses non-WSS or missing secrets",()=>{
    expect(()=>createMasanaLiveKitProvider({
      url:"https://unsafe.example",apiKey:"key",apiSecret:"short",
      dispatch:async()=>{},stop:async()=>{},
    })).toThrow();
  });
});

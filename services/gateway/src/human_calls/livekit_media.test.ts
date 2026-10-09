import {describe,it,expect} from "vitest";
import {createHumanCallMediaIssuer} from "./livekit_media.js";
import type {HumanCall} from "./service.js";
const call:HumanCall={
  callId:"11111111-1111-4111-8111-111111111111",
  conversationId:"22222222-2222-4222-8222-222222222222",
  callerUserId:"user_a",calleeUserId:"user_b",
  kind:"audio",state:"active",
  createdAt:"2026-10-09T05:00:00Z",answeredAt:"2026-10-09T05:00:01Z",endedAt:null,
};
function setup() {
  const rooms:string[]=[];
  const issuer=createHumanCallMediaIssuer({
    serverUrl:"wss://live.example/",
    apiKey:"public-provider-key",apiSecret:"strong-sever-secret-testing-32bytes",
    now:()=>new Date("2026-10-09T05:00:10Z"),ttlSeconds:45,
    revoker:{async closeRoom(room){rooms.push(room);}},
  });
  return {issuer,rooms};
}
function claims(token:string) {
  return JSON.parse(Buffer.from(token.split(".")[1]!,"base64url").toString("utf8")) as {
    sub:string;exp:number;video:Record<string,unknown>;
  };
}
describe("C09 LiveKit private media scope",()=>{
  it("never sends media for ringing/ended or unrelated participants",async()=>{
    const {issuer}=setup();
    await expect(issuer.mint({call:{...call,state:"ringing"},userId:"user_a"})).rejects.toThrow();
    await expect(issuer.mint({call,userId:"user_c"})).rejects.toThrow();
  });
  it("audio token can publish ONLY mic, never stage/media admin",async()=>{
    const {issuer}=setup();
    const token=await issuer.mint({call,userId:"user_a"});
    const decoded=claims(token.participant_token);
    expect(decoded.video).toMatchObject({
      roomJoin:true,room:"human-call_"+call.callId,canSubscribe:true,
      canPublishSources:["microphone"],canPublishData:false,
      roomAdmin:false,roomRecord:false,
    });
    expect(decoded.sub).not.toContain("user_a");
    expect(decoded.exp).toBe(1791522055);
  });
  it("video token permits only mic and camera with no screen share",async()=>{
    const {issuer}=setup();
    const token=await issuer.mint({call:{...call,kind:"video"},userId:"user_b"});
    const decoded=claims(token.participant_token);
    expect(decoded.video.canPublishSources).toEqual(["microphone","camera"]);
    expect(token.room_name).toBe("human-call_"+call.callId);
  });
  it("terminates provider room through required backend revoker",async()=>{
    const {issuer,rooms}=setup();
    await issuer.terminate(call.callId);
    expect(rooms).toEqual(["human-call_"+call.callId]);
  });
  it("refuses plaintext or credential-embedded websocket URLs",()=>{
    for(const url of ["ws://live.example/","wss://user:pass@live.example/",
      "wss://live.example/?token=secret","wss://live.example/path"]) {
      expect(()=>createHumanCallMediaIssuer({
        serverUrl:url,apiKey:"a",apiSecret:"strong-secret-32-bytes",
        revoker:{async closeRoom(){}},
      })).toThrow();
    }
  });
});

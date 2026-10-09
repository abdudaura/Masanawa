import { describe,expect,it } from "vitest";
import { createLiveKitHumanCallRoomRevoker } from "./livekit_room_revoker.js";

const room = "human-call_11111111-1111-4111-8111-111111111111";
function revoker(fetchImpl:typeof fetch) {
  return createLiveKitHumanCallRoomRevoker({
    serverUrl:"wss://private.livekit.example/",
    apiKey:"lk-key",apiSecret:"integration-test-secret-32-chars",
    now:()=>new Date("2026-10-09T09:00:00Z"),
    fetchImpl,
  });
}
describe("C09 concrete LiveKit room deletion",()=>{
  it("sends scoped signed admin token to HTTPS Twirp DeleteRoom, not a public call",async()=>{
    const requests:{url:string;opts:RequestInit}[]=[];
    const client=revoker(async (url,options)=>{
      requests.push({url:String(url),opts:options!});
      return new Response("{}",{status:200});
    });
    await client.closeRoom(room);
    expect(requests).toHaveLength(1);
    const {url,opts}=requests[0]!;
    expect(url).toBe("https://private.livekit.example/twirp/livekit.RoomService/DeleteRoom");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(String(opts.body))).toEqual({room});
    const headers=opts.headers as Record<string,string>;
    const token=headers.Authorization?.split(" ")[1]!;
    const jwt=JSON.parse(Buffer.from(token.split(".")[1]!,"base64url").toString("utf8"));
    expect(jwt.video).toEqual({roomCreate:true,room});
    expect(jwt.sub).toBe("c09-room-revoker");
    expect(jwt.exp-jwt.iat).toBe(30);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(String(opts.body)).not.toContain("user_a");
    expect(token.split(".")).toHaveLength(3);
  });

  it("treats only genuine room-not-found Twirp 404 as idempotent",async()=>{
    await expect(revoker(async()=>new Response(
      JSON.stringify({code:"not_found",msg:"room not found"}),
      {status:404,headers:{"content-type":"application/json"}},
    )).closeRoom(room)).resolves.toBeUndefined();
    await expect(revoker(async()=>new Response(
      JSON.stringify({code:"not_found",msg:"different error"}),
      {status:500},
    )).closeRoom(room)).rejects.toThrow("termination unconfirmed");
    await expect(revoker(async()=>new Response(
      "<html>wrong deployment endpoint</html>",{status:404},
    )).closeRoom(room)).rejects.toThrow("termination unconfirmed");
  });

  it("redacts provider errors even when upstream body contains credentials",async()=>{
    const client=revoker(async()=>new Response(
      "auth-secret do-not-log",{status:503},
    ));
    await expect(client.closeRoom(room)).rejects.toThrow(
      "Private call room termination unconfirmed",
    );
    try {await client.closeRoom(room);} catch(error) {
      expect(String(error)).not.toContain("auth-secret");
    }
  });

  it("refuses untrusted room names, URL credentials and non-TLS host",async()=>{
    let invoked=0;
    const safeFetch:typeof fetch=async()=>{invoked++;return new Response("{}");};
    const client=revoker(safeFetch);
    await expect(client.closeRoom("public-talk_1")).rejects.toThrow(
      "Invalid private human-call",
    );
    await expect(client.closeRoom("human-call_bad/../../room")).rejects.toThrow();
    expect(invoked).toBe(0);
    for(const url of ["ws://private.example/","wss://u:p@private.example/",
      "wss://private.example/?token=secret","wss://private.example/path"]) {
      expect(()=>createLiveKitHumanCallRoomRevoker({
        serverUrl:url,apiKey:"key",apiSecret:"integration-secret-32chars",
      })).toThrow();
    }
  });

  it("requires bounded timeout and valid LiveKit provider credentials",()=>{
    expect(()=>createLiveKitHumanCallRoomRevoker({
      serverUrl:"wss://private.example/",apiKey:"key",apiSecret:"test-short",
    })).toThrow();
    expect(()=>createLiveKitHumanCallRoomRevoker({
      serverUrl:"wss://private.example/",apiKey:"key",
      apiSecret:"integration-secret-32chars",timeoutMs:90000,
    })).toThrow();
  });
});

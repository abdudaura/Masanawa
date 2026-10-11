import {describe,it,expect,vi} from "vitest";
import {createMasanaLiveKitDispatch} from "./livekit_dispatch.js";
describe("J04 LiveKit dispatch transport",()=>{
  const setup=(enabled=true)=>{
    const fetchImpl=vi.fn(async (_url:string, _options:RequestInit)=>({ok:true,status:200} as Response));
    const provider=createMasanaLiveKitDispatch({
      url:"wss://lk.example",apiKey:"key",apiSecret:"secret-with-required-length",
      enabled:async()=>enabled,fetchImpl:fetchImpl as unknown as typeof fetch,
      now:()=>new Date("2026-10-11T03:00:00Z"),
    });
    return {provider,fetchImpl};
  };
  it("dispatches only a server-named agent to a server room with qualified metadata",async()=>{
    const {provider,fetchImpl}=setup();
    await provider.dispatch({tenantId:"t",callId:"call-a",characterId:"character-a",roomName:"masana-a"});
    const [url,options]=fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://lk.example/twirp/livekit.AgentDispatchService/CreateDispatch");
    const body=JSON.parse((options as RequestInit).body as string);
    expect(body.agent_name).toBe("masanawa-calls");
    expect(body.room).toBe("masana-a");
    expect(JSON.parse(body.metadata)).toEqual({
      schemaVersion:1,tenantId:"t",callId:"call-a",characterId:"character-a",roomName:"masana-a",
    });
    const token=(options as RequestInit).headers as Record<string,string>;
    const admin=JSON.parse(Buffer.from(token.authorization.split(".")[1]!,"base64url").toString());
    expect(admin.video.roomAdmin).toBe(true);
    expect(admin.video.room).toBe("masana-a");
    expect(admin.exp-admin.iat).toBe(45);
  });
  it("revokes whole call room when ended",async()=>{
    const {provider,fetchImpl}=setup();
    await provider.stop({callId:"call-a",roomName:"masana-a"});
    expect(fetchImpl.mock.calls[0]![0]).toContain("/RoomService/DeleteRoom");
  });
  it("refuses provider activity behind default-off flag",async()=>{
    const {provider,fetchImpl}=setup(false);
    await expect(provider.dispatch({tenantId:"t",callId:"a",characterId:"c",roomName:"r"})).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

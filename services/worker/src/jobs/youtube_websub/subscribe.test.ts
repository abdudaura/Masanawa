import { describe, expect, it, vi } from "vitest";
import { createYouTubeHubSubscriber } from "./subscribe.js";
const source={tenantId:"t",sourceId:"s",channelId:"UC"+"X".repeat(22),
  callbackToken:"A".repeat(48),signatureSecret:"z".repeat(40),
  enabled:true,apiQualified:true,mode:"authorized_api" as const};
describe("official YouTube WebSub lease renewal",()=>{
  it("requests the fixed official hub with a server-configured callback",async()=>{
    const fetchImpl=vi.fn(async(_url:unknown,_options:unknown)=>({ok:true}));
    const c=createYouTubeHubSubscriber({callbackBaseUrl:"https://gateway.example.test/",
      allowedCallbackHost:"gateway.example.test",fetchImpl:fetchImpl as unknown as typeof fetch});
    await expect(c.requestLease(source)).resolves.toEqual({requested:true,verified:false});
    const [url,options]=fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://pubsubhubbub.appspot.com/subscribe");
    const data=new URLSearchParams((options as {body:string}).body);
    expect(data.get("hub.callback")).toBe("https://gateway.example.test/v1/webhooks/youtube/"+source.callbackToken);
    expect(data.get("hub.secret")).toBe(source.signatureSecret);
  });
  it("denies manual or unqualified sources before network access",async()=>{
    const fetchImpl=vi.fn();
    const c=createYouTubeHubSubscriber({callbackBaseUrl:"https://gateway.example.test/",
      allowedCallbackHost:"gateway.example.test",fetchImpl:fetchImpl as unknown as typeof fetch});
    await expect(c.requestLease({...source,apiQualified:false})).rejects.toMatchObject({code:"not_authorized"});
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects private networks, external redirect URLs and callback credentials",()=>{
    expect(()=>createYouTubeHubSubscriber({callbackBaseUrl:"http://gateway.example.test/",allowedCallbackHost:"gateway.example.test"}))
      .toThrow("invalid_source");
    expect(()=>createYouTubeHubSubscriber({callbackBaseUrl:"https://gateway.example.test.evil.test/",allowedCallbackHost:"gateway.example.test"}))
      .toThrow("invalid_source");
    expect(()=>createYouTubeHubSubscriber({callbackBaseUrl:"https://user:pass@gateway.example.test/",allowedCallbackHost:"gateway.example.test"}))
      .toThrow("invalid_source");
  });
});

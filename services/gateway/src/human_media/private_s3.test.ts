import { describe,expect,it,vi } from "vitest";
import { createPrivateVoiceS3 } from "./private_s3.js";
const sha="e".repeat(32);
const key="dm-voice/"+sha+"/00000000-0000-4000-8000-000000000001/"+
 sha+"/00000000-0000-4000-8000-000000000002.ogg";
const config={
 endpoint:"https://s3.example.invalid/",region:"us-east-1",
 bucket:"my-private-audio",accessKey:"TEST_ACCESS",secretKey:"test-secret-must-be-long-enough",
 now:()=>new Date("2026-10-08T10:59:00Z"),
};
describe("C04 private encrypted S3 key boundaries",()=>{
 it("signs scoped PUT with SSE and never uses public CDN URLs",async()=>{
  const observed:{url?:string;headers?:HeadersInit | undefined;method?:string | undefined}={};
  const fetchImpl=vi.fn(async(url:URL|RequestInfo,init?:RequestInit | undefined)=>{
   observed.url=String(url);observed.method=init?.method;observed.headers=init?.headers;
   return new Response(null,{status:200});
  });
  const store=createPrivateVoiceS3({...config,fetchImpl:fetchImpl as typeof fetch});
  await store.put(key,Buffer.alloc(100,1));
  expect(observed.url).toContain("/my-private-audio/dm-voice/");
  expect(observed.method).toBe("PUT");
  expect(observed.headers).toMatchObject({
    "x-amz-server-side-encryption":"AES256",
    "content-type":"audio/ogg",
  });
  expect((observed.headers as Record<string,string>).authorization).toContain("AWS4-HMAC-SHA256");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
 it("rejects arbitrary keys and insecure hosts",async()=>{
  expect(()=>createPrivateVoiceS3({...config,endpoint:"http://example.invalid"})).toThrow();
  const store=createPrivateVoiceS3({...config,fetchImpl:vi.fn() as unknown as typeof fetch});
  await expect(store.get("../outside",100)).rejects.toThrow();
  await expect(store.put(key,Buffer.alloc(1536*1024+1))).rejects.toThrow();
 });
 it("uses private signed GET without redirecting and enforces bounded stream",async()=>{
  const bytes=Buffer.alloc(90,0xaa);
  const fetchImpl=vi.fn(async(_url:URL|RequestInfo,init?:RequestInit | undefined)=>{
    expect(init?.redirect).toBe("error");
    return new Response(bytes,{status:200});
  });
  const store=createPrivateVoiceS3({...config,fetchImpl:fetchImpl as typeof fetch});
  expect(await store.get(key,100)).toEqual(bytes);
  await expect(store.get(key,84)).rejects.toThrow("messages.voice.storage_oversize");
 });
});

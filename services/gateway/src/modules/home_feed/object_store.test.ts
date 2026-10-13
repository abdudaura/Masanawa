import {describe,it,expect,vi} from "vitest";
import {createReplayObjectStore} from "../../talk_replay/playback/s3_object_store.js";
const config={endpoint:"https://store.example",region:"us-east-1",bucket:"canonical-masana",accessKey:"test-access",secret:"test-secret-not-real",now:()=>new Date("2026-10-12T08:00:00Z")};
describe("Status uses existing S3 metadata/signing implementation",()=>{
 it("signs HEAD without redirects/downloads and signs the exact same key for GET",async()=>{
  const fetchImpl=vi.fn(async()=>new Response(null,{status:200,headers:{"content-type":"image/png; charset=binary","content-length":"42"}}));
  const store=createReplayObjectStore({...config,fetchImpl});
  expect(await store.statObject!("tenant/approved image.png")).toEqual({contentType:"image/png",bytes:42});
  const [url,options]=fetchImpl.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.href).toBe("https://store.example/canonical-masana/tenant/approved%20image.png");
  expect(options.method).toBe("HEAD");expect(options.redirect).toBe("error");expect(options.signal).toBeInstanceOf(AbortSignal);
  expect((options.headers as Record<string,string>).authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access\//);
  const grant=await store.presignGet("tenant/approved image.png",120);
  expect(new URL(grant.url).pathname).toBe(url.pathname);
  expect(new URL(grant.url).searchParams.get("X-Amz-Expires")).toBe("120");
  expect(grant.expiresAt).toBe("2026-10-12T08:02:00.000Z");
 });
 it("rejects missing/invalid metadata and storage errors, while absence is null",async()=>{
  for(const headers of [{},{"content-type":"image/png"},{"content-type":"image/png","content-length":"0"},{"content-type":"image/png","content-length":"99999999999999999999"}]){
   const store=createReplayObjectStore({...config,fetchImpl:async()=>new Response(null,{status:200,headers})});
   await expect(store.statObject!("key")).rejects.toThrow("object_metadata_invalid");
  }
  const missing=createReplayObjectStore({...config,fetchImpl:async()=>new Response(null,{status:404})});
  expect(await missing.statObject!("key")).toBeNull();
  const denied=createReplayObjectStore({...config,fetchImpl:async()=>new Response(null,{status:403})});
  await expect(denied.statObject!("key")).rejects.toThrow("object_metadata_unavailable");
 });
 it("denies traversal or absolute keys before making a storage request",async()=>{
  const fetchImpl=vi.fn();const store=createReplayObjectStore({...config,fetchImpl});
  for(const key of ["/foreign","../foreign","a/../foreign",""])
   await expect(store.statObject!(key)).rejects.toThrow("object key is invalid");
  expect(fetchImpl).not.toHaveBeenCalled();
 });
});

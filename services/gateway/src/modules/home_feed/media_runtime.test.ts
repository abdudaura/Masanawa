import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {createStatusMediaRuntime} from "./media_runtime.js";
import {registerStatusRuntime} from "./runtime.js";
const post={tenantId:"tenant_real",postId:"381026c2-9d56-47b1-b73d-1784e24e41e2",mediaId:"media_abcdefgh",authorMasanaId:"masana",kind:"image" as const,transcript:null};
function fixture(){
 const object=vi.fn(async()=>({objectKey:"canonical/tenant_real/approved.png"}));
 const find=vi.fn(async():Promise<{tenantId:string;postId:string;mediaId:string;authorMasanaId:string;kind:"image"|"audio";transcript:string|null}|null>=>post);
 const statObject=vi.fn(async()=>({contentType:"image/png",bytes:1024}));
 const presignGet=vi.fn(async()=>({url:"https://media.example/signed",expiresAt:new Date(Date.now()+120000).toISOString()}));
 const input={eligibility:{object},published:{find},configuration:{objects:{statObject,presignGet},approvedDownloadOrigins:["https://media.example"]}};
 return {object,find,statObject,presignGet,input,runtime:createStatusMediaRuntime(input)};
}
describe("Status cleared canonical image signing",()=>{
 it("uses server catalogue key and 120s grant; public DTO never exposes key",async()=>{
  const f=fixture();const grant=await f.runtime.media.sign(post);
  expect(f.object).toHaveBeenCalledWith("tenant_real","masana","media_abcdefgh","image");
  expect(f.presignGet).toHaveBeenCalledWith("canonical/tenant_real/approved.png",120);
  expect(grant).toMatchObject({contentType:"image/png"});expect(JSON.stringify(grant)).not.toContain("canonical/");
  expect(await f.runtime.approved("tenant_real","masana","media_abcdefgh","image")).toBe(true);
 });
 it("denies absent store, unapproved object, audio relabelling, invalid MIME and oversized files",async()=>{
  const f=fixture();const disabled=createStatusMediaRuntime({eligibility:f.input.eligibility,published:f.input.published});
  await expect(disabled.media.sign(post)).rejects.toThrow("status.media_store_unavailable");
  expect(await disabled.approved("tenant_real","masana","media_abcdefgh","image")).toBe(false);
  expect(await f.runtime.approved("tenant_real","masana","media_abcdefgh","audio")).toBe(false);
  for(const metadata of [{contentType:"text/html",bytes:1},{contentType:"image/svg+xml",bytes:1},{contentType:"image/png",bytes:11*1024*1024},{contentType:"image/png",bytes:0}]){
   f.statObject.mockResolvedValueOnce(metadata);expect(await f.runtime.media.sign(post)).toBeNull();
  }
  f.object.mockResolvedValueOnce(null as never);expect(await f.runtime.media.sign(post)).toBeNull();
  expect(f.presignGet).not.toHaveBeenCalled();
 });

 it("signs only rights-cleared audio with bounded MIME, size and current publication",async()=>{
  const f=fixture();const audioPost={...post,kind:"audio" as const,transcript:"Spoken update"};
  f.find.mockResolvedValue(audioPost);
  f.statObject.mockResolvedValue({contentType:"audio/mpeg",bytes:8192});
  const signed=await f.runtime.media.sign(audioPost);
  expect(signed).toMatchObject({contentType:"audio/mpeg"});
  expect(f.object).toHaveBeenCalledWith("tenant_real","masana","media_abcdefgh","audio");
  expect(await f.runtime.approved("tenant_real","masana","media_abcdefgh","audio")).toBe(true);
  f.statObject.mockResolvedValueOnce({contentType:"image/png",bytes:8192});
  expect(await f.runtime.media.sign(audioPost)).toBeNull();
  f.statObject.mockResolvedValueOnce({contentType:"audio/mpeg",bytes:40*1024*1024});
  expect(await f.runtime.media.sign(audioPost)).toBeNull();
  f.find.mockResolvedValueOnce(null as never);
  expect(await f.runtime.media.sign(audioPost)).toBeNull();
 });
 it("rechecks revocation and replacement after network metadata lookup",async()=>{
  const f=fixture();f.object.mockResolvedValueOnce({objectKey:"old.png"}).mockResolvedValueOnce({objectKey:"new.png"});
  expect(await f.runtime.media.sign(post)).toBeNull();
  f.find.mockResolvedValueOnce(null as never);expect(await f.runtime.media.sign(post)).toBeNull();
  expect(f.presignGet).not.toHaveBeenCalled();
 });
 it("fails transient storage safely and permits retry, including rights revocation at HTTP scope",async()=>{
  const f=fixture(),app=Fastify();
  await registerStatusRuntime(app,{sessions:{authorize:async()=>({tenantId:"tenant_real",userId:"fan"})},
   feed:{} as never,editorial:{} as never,media:f.runtime.media});
  const request={url:`/v1/posts/${post.postId}/media/${post.mediaId}`,headers:{authorization:"Bearer session"}};
  f.statObject.mockRejectedValueOnce(new Error("secret storage failure"));
  const failure=await app.inject(request);expect(failure.statusCode).toBe(503);
  expect(failure.json()).toEqual({code:"media_signer_unavailable"});
  expect((await app.inject(request)).statusCode).toBe(200);
  f.object.mockResolvedValueOnce(null as never);expect((await app.inject(request)).statusCode).toBe(404);
  const before=f.presignGet.mock.calls.length;
  f.find.mockResolvedValueOnce(null as never);expect((await app.inject(request)).statusCode).toBe(404);
  expect(f.presignGet.mock.calls.length).toBe(before);await app.close();
 });
 it("rejects origin paths, HTTP, embedded credentials; route rejects unapproved grant hosts",async()=>{
  const f=fixture();for(const origin of ["http://media.example","https://media.example/path","https://user:password@media.example"])
   expect(()=>createStatusMediaRuntime({...f.input,configuration:{...f.input.configuration,approvedDownloadOrigins:[origin]}})).toThrow();
  const app=Fastify();f.presignGet.mockResolvedValueOnce({url:"https://foreign.example/signed",expiresAt:new Date(Date.now()+120000).toISOString()});
  await registerStatusRuntime(app,{sessions:{authorize:async()=>({tenantId:"tenant_real",userId:"fan"})},feed:{} as never,editorial:{} as never,media:f.runtime.media});
  expect((await app.inject({url:`/v1/posts/${post.postId}/media/${post.mediaId}`,headers:{authorization:"Bearer session"}})).statusCode).toBe(503);await app.close();
 });
});

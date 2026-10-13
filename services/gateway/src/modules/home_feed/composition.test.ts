import {afterEach,describe,it,expect,vi} from "vitest";
import {EventEmitter} from "node:events";
import {FeedService,type Repository} from "@masanawa/feed";
import {EditorialReviewService,type EditorialRepository} from "@masanawa/feed";
import type {PlatformSessionRepository} from "@masanawa/security";
import {createGatewayApp,type GatewayAppOptions} from "../../app.js";
import {createPlatformCustomerSessionAuthorizer} from "../../customer_auth.js";
import {startGatewayService,type ServiceProcess,type ServiceDatabaseDependency} from "../../main.js";
const apps:ReturnType<typeof createGatewayApp>[]=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));});
function fixture(){
 const resolveAccess=vi.fn(async()=>({tenantId:"tenant_real",userId:"fan_real"}));
 const sessions={resolveAccess} as unknown as PlatformSessionRepository;
 const list=vi.fn(async()=>[]);
 const repo={list} as unknown as Repository;
 const editorial={} as EditorialRepository;
 return {resolveAccess,sessions,list,repo,editorial};
}
describe("Status production composition source",()=>{
 it("mounts feed in the actual Gateway with canonical bearer auth and recovers after storage failure",async()=>{
  const f=fixture();
  const app=createGatewayApp({status:{sessions:createPlatformCustomerSessionAuthorizer({repository:f.sessions}),
   feed:new FeedService(f.repo,async()=>true),editorial:new EditorialReviewService(f.editorial,async()=>true,async()=>false)}});
  apps.push(app);
  expect((await app.inject("/v1/feed")).statusCode).toBe(401);
  const request={url:"/v1/feed",headers:{authorization:`Bearer msw_access_${"a".repeat(64)}`,"x-tenant-id":"foreign","x-user-id":"other"}};
  expect((await app.inject(request)).statusCode).toBe(200);
  expect(f.list).toHaveBeenCalledWith("tenant_real","fan_real","for_you",null,21);
  f.list.mockRejectedValueOnce(new Error("private database internals"));
  const failure=await app.inject(request);expect(failure.statusCode).toBe(503);
  expect(failure.json()).toEqual({code:"status_unavailable"});
  expect((await app.inject(request)).statusCode).toBe(200);
  f.resolveAccess.mockResolvedValueOnce(null as never);
  expect((await app.inject(request)).statusCode).toBe(401);
  const denied=await app.inject({method:"POST",url:"/v1/admin/feed/drafts",headers:{...request.headers,"x-role":"content_editor"},payload:{authorMasanaId:"masana",kind:"text",body:"human post"}});
  expect(denied.statusCode).toBe(403);
 });
 it("startup binds the existing database stores and only server-listed editor identities",async()=>{
  const f=fixture();let composition:GatewayAppOptions|undefined;
  const processRef=Object.assign(new EventEmitter(),{exitCode:undefined,exit:()=>{throw Error("unexpected exit");}}) as ServiceProcess;
  const database={readinessCheck:{name:"database",check:async()=>({ready:true})},close:vi.fn(async()=>{}),
   platformSessions:f.sessions,status:{feed:f.repo,editorial:f.editorial,eligibility:{author:async()=>true,object:async()=>null},published:{find:async()=>null}}} as unknown as ServiceDatabaseDependency;
  const runtime=await startGatewayService({env:{NODE_ENV:"test",MASANAWA_ADMIN_USER_IDS:"editor_real"},processRef,
   databaseFactory:()=>database,logger:{info:()=>{},error:()=>{}},
   appFactory:options=>{composition=options;return {listen:async()=>"http://local",close:async()=>{}};}});
  expect(composition?.status?.media).toBeDefined();
  await expect(composition!.status!.media!.sign({tenantId:"tenant_real",postId:"381026c2-9d56-47b1-b73d-1784e24e41e2",
   authorMasanaId:"masana",mediaId:"media_abcdefgh",kind:"image",transcript:null})).rejects.toThrow("status.media_store_unavailable");
  expect(composition?.status?.feed).toBeInstanceOf(FeedService);
  expect(composition?.status?.editorial).toBeInstanceOf(EditorialReviewService);
  expect(await composition?.status?.isEditor?.({tenantId:"tenant_real",userId:"fan_real"})).toBe(false);
  expect(await composition?.status?.isEditor?.({tenantId:"tenant_real",userId:"editor_real"})).toBe(true);
  await runtime.shutdown("SIGTERM");
  expect(database.close).toHaveBeenCalledTimes(1);
 });
 it("startup connects supplied canonical image store and safely closes on invalid origin configuration",async()=>{
  const f=fixture();const post={tenantId:"tenant_real",postId:"381026c2-9d56-47b1-b73d-1784e24e41e2",
   authorMasanaId:"masana",mediaId:"media_abcdefgh",kind:"image" as const,transcript:null};
  let composition:GatewayAppOptions|undefined;
  const database={readinessCheck:{name:"database",check:async()=>({ready:true})},close:vi.fn(async()=>{}),
   platformSessions:f.sessions,status:{feed:f.repo,editorial:f.editorial,
    eligibility:{author:async()=>true,object:async()=>({objectKey:"canonical/image.png"})},
    published:{find:async()=>post}}} as unknown as ServiceDatabaseDependency;
  const statObject=vi.fn(async()=>({contentType:"image/png",bytes:1024}));
  const presignGet=vi.fn(async()=>({url:"https://media.example/signed",expiresAt:new Date(Date.now()+120000).toISOString()}));
  const processRef=()=>Object.assign(new EventEmitter(),{exitCode:undefined,exit:()=>{throw Error("unexpected exit");}}) as ServiceProcess;
  const settings={objects:{statObject,presignGet},approvedDownloadOrigins:["https://media.example"]};
  const runtime=await startGatewayService({env:{NODE_ENV:"test"},processRef:processRef(),logger:{info:()=>{},error:()=>{}},
   databaseFactory:()=>database,statusMedia:settings,appFactory:options=>{composition=options;return {listen:async()=>"http://local",close:async()=>{}};}});
  expect(await composition!.status!.media!.sign(post)).toMatchObject({contentType:"image/png",url:"https://media.example/signed"});
  expect(statObject).toHaveBeenCalledWith("canonical/image.png");expect(presignGet).toHaveBeenCalledWith("canonical/image.png",120);
  await runtime.shutdown();vi.mocked(database.close).mockClear();
  const appFactory=vi.fn();
  await expect(startGatewayService({env:{NODE_ENV:"test"},processRef:processRef(),logger:{info:()=>{},error:()=>{}},
   databaseFactory:()=>database,statusMedia:{...settings,approvedDownloadOrigins:["http://invalid.example"]},appFactory})).rejects.toThrow("exact HTTPS");
  expect(database.close).toHaveBeenCalledTimes(1);expect(appFactory).not.toHaveBeenCalled();
 });

});

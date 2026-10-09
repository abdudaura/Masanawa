import { describe,expect,it } from "vitest";
import Fastify from "fastify";
import { registerTalkSafetyRoutes } from "./talk_safety_routes.js";
import type { TalkSafetyService } from "./talk_safety/service.js";

function app(){
  const server=Fastify();
  const service:TalkSafetyService={
    async report(input){
      if(input.authorizationHeader!=="Bearer customer"){
        throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      }
      return {reportId:"report-1",accepted:true};
    },
    async readPreference(){ return {blocked:false,muted:false}; },
    async setPreference(input){ return {blocked:input.blocked,muted:input.muted}; },
    async readUserPreference(){ return {blocked:false,muted:true}; },
    async setUserPreference(input){ return {blocked:input.blocked,muted:input.muted}; },
    async readEnforcement(input){
      if(input.authorizationHeader!=="Bearer safety-admin"){
        throw Object.assign(new Error("FORBIDDEN"),{statusCode:403});
      }
      return {
        schemaVersion:1,tenantId:"tenant-1",
        target:{kind:input.targetKind,id:input.targetId},
        revision:1,visibility:"public",reasonCode:null,
        updatedAt:"2026-10-07T10:00:00.000Z",
      };
    },
    async setEnforcement(input){
      if(input.authorizationHeader!=="Bearer safety-admin"){
        throw Object.assign(new Error("FORBIDDEN"),{statusCode:403});
      }
      return {
        schemaVersion:1,tenantId:"tenant-1",
        target:{kind:input.targetKind,id:input.targetId},
        revision:input.expectedRevision+1,
        visibility:input.visibility,reasonCode:input.reasonCode,
        updatedAt:"2026-10-07T10:00:00.000Z",
      };
    },
  };
  registerTalkSafetyRoutes(server,service);
  return server;
}

describe("Talk safety HTTP routes",()=>{
  it("accepts authenticated reports with 202",async()=>{
    const response=await app().inject({
      method:"POST",
      url:"/safety/reports",
      headers:{authorization:"Bearer customer"},
      payload:{
        targetKind:"comment",targetId:"comment-1",reason:"spam",
        clientRequestId:"request-1",
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({reportId:"report-1",accepted:true});
  });

  it("accepts a public AI persona report only from an authenticated customer",async()=>{
    const payload={
      targetKind:"persona",targetId:"persona-public-7",reason:"fraud",
      detail:"Concern about misleading identity",clientRequestId:"request-stable-1",
    };
    const unauthenticated=await app().inject({
      method:"POST",url:"/safety/reports",payload,
    });
    expect(unauthenticated.statusCode).toBe(401);
    const accepted=await app().inject({
      method:"POST",url:"/safety/reports",
      headers:{authorization:"Bearer customer"},
      payload,
    });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toEqual({reportId:"report-1",accepted:true});
    const wrongKind=await app().inject({
      method:"POST",url:"/safety/reports",
      headers:{authorization:"Bearer customer"},
      payload:{...payload,targetKind:"private-ai-chat"},
    });
    expect(wrongKind.statusCode).toBe(400);
  });

  it("validates malformed report reasons at route boundary",async()=>{
    const response=await app().inject({
      method:"POST",
      url:"/safety/reports",
      headers:{authorization:"Bearer customer"},
      payload:{
        targetKind:"talk",targetId:"talk-1",reason:"anything",
        clientRequestId:"request-1",
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("reads and updates customer safety preference by verified user id",async()=>{
    const read=await app().inject({
      method:"GET",
      url:"/safety/users/user-host/preference",
      headers:{authorization:"Bearer customer"},
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual({blocked:false,muted:true});

    const updated=await app().inject({
      method:"PUT",
      url:"/safety/users/user-host/preference",
      headers:{authorization:"Bearer customer"},
      payload:{blocked:true,muted:false},
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({blocked:true,muted:false});
  });

  it("does not let customer auth mutate platform enforcement",async()=>{
    const denied=await app().inject({
      method:"PUT",
      url:"/admin/talk-safety/talk/talk-1",
      headers:{authorization:"Bearer customer"},
      payload:{
        expectedRevision:0,visibility:"blocked",reasonCode:"policy.abuse",
      },
    });
    expect(denied.statusCode).toBe(403);

    const allowed=await app().inject({
      method:"PUT",
      url:"/admin/talk-safety/talk/talk-1",
      headers:{authorization:"Bearer safety-admin"},
      payload:{
        expectedRevision:0,visibility:"blocked",reasonCode:"policy.abuse",
      },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({revision:1,visibility:"blocked"});
  });
});


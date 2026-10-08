import {describe,expect,it} from "vitest";
import Fastify from "fastify";
import {createTalkSafetyService} from "./service.js";
import {registerTalkSafetyRoutes} from "../talk_safety_routes.js";
import type {TalkSafetyRepository} from "./repository.js";
import type {TalkSafetyUserPreference} from "./policy.js";

function fixture(){
  const preferences=new Map<string,TalkSafetyUserPreference>();
  const repository={
    async resolveProfileUser({tenantId,handle}:{tenantId:string;handle:string}){
      return handle==="amina" ? tenantId+"-user-amina" : null;
    },
    async readPreference({tenantId,viewerUserId,subjectUserId}:{
      tenantId:string;viewerUserId:string;subjectUserId:string;
    }){
      return preferences.get([tenantId,viewerUserId,subjectUserId].join(":"))??null;
    },
    async setPreference(value:TalkSafetyUserPreference){
      preferences.set([value.tenantId,value.viewerUserId,value.subjectUserId].join(":"),value);
      return value;
    },
  } as TalkSafetyRepository;
  const service=createTalkSafetyService({
    repository,
    customerAuthorizer:{
      async authorize({authorizationHeader}){
        if(authorizationHeader==="Bearer tenant-a")return {
          tenantId:"tenant-a" as never,userId:"viewer-a" as never,
          profile:{
            tenantId:"tenant-a" as never,userId:"viewer-a" as never,
            name:"Viewer A",email:null,phone:null,locale:"en",
            createdAt:"2026-10-08T00:00:00Z",
          },
        };
        if(authorizationHeader==="Bearer tenant-b")return {
          tenantId:"tenant-b" as never,userId:"viewer-b" as never,
          profile:{
            tenantId:"tenant-b" as never,userId:"viewer-b" as never,
            name:"Viewer B",email:null,phone:null,locale:"en",
            createdAt:"2026-10-08T00:00:00Z",
          },
        };
        throw Object.assign(new Error("Unauthorized"),{statusCode:401});
      },
    },
    platformAuthority:{
      async authorize(){throw Object.assign(new Error("Forbidden"),{statusCode:403});},
    },
    now:()=> "2026-10-08T00:00:00Z",
  });
  const server=Fastify();
  registerTalkSafetyRoutes(server,service);
  return {server,preferences};
}

describe("authenticated human profile block/mute HTTP",()=>{
  const path="/safety/profiles/amina/preference";
  it("rejects unauthenticated preference reads and writes",async()=>{
    const {server,preferences}=fixture();
    const read=await server.inject({method:"GET",url:path});
    const write=await server.inject({
      method:"PUT",url:path,payload:{blocked:true,muted:true},
    });
    expect(read.statusCode).toBe(401);
    expect(write.statusCode).toBe(401);
    expect(preferences.size).toBe(0);
  });
  it("persists desired block and mute independently for each tenant",async()=>{
    const {server,preferences}=fixture();
    const a=await server.inject({
      method:"PUT",url:path,
      headers:{authorization:"Bearer tenant-a"},
      payload:{blocked:true,muted:false},
    });
    expect(a.statusCode).toBe(200);
    expect(a.json()).toEqual({blocked:true,muted:false});
    const aRead=await server.inject({
      method:"GET",url:path,headers:{authorization:"Bearer tenant-a"},
    });
    const bRead=await server.inject({
      method:"GET",url:path,headers:{authorization:"Bearer tenant-b"},
    });
    expect(aRead.json()).toEqual({blocked:true,muted:false});
    expect(bRead.json()).toEqual({blocked:false,muted:false});
    const b=await server.inject({
      method:"PUT",url:path,headers:{authorization:"Bearer tenant-b"},
      payload:{blocked:false,muted:true},
    });
    expect(b.statusCode).toBe(200);
    expect(preferences.size).toBe(2);
    const retry=await server.inject({
      method:"PUT",url:path,headers:{authorization:"Bearer tenant-a"},
      payload:{blocked:true,muted:false},
    });
    expect(retry.statusCode).toBe(200);
    expect(preferences.size).toBe(2);
    expect((await server.inject({
      method:"GET",url:path,headers:{authorization:"Bearer tenant-b"},
    })).json()).toEqual({blocked:false,muted:true});
  });
  it("rejects unknown profile handles and malformed preference bodies",async()=>{
    const {server,preferences}=fixture();
    const missing=await server.inject({
      method:"GET",url:"/safety/profiles/no_such_user/preference",
      headers:{authorization:"Bearer tenant-a"},
    });
    expect(missing.statusCode).toBe(404);
    const malformed=await server.inject({
      method:"PUT",url:path,
      headers:{authorization:"Bearer tenant-a"},
      payload:{blocked:"true",muted:false},
    });
    expect(malformed.statusCode).toBe(400);
    const extra=await server.inject({
      method:"PUT",url:path,
      headers:{authorization:"Bearer tenant-a"},
      payload:{blocked:true,muted:false,admin:true},
    });
    expect(extra.statusCode).toBe(400);
    expect(preferences.size).toBe(0);
  });
});

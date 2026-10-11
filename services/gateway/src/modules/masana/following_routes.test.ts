import { afterEach, describe, expect, it } from "vitest";
import Fastify, {type FastifyInstance} from "fastify";
import { registerFollowingRoutes,type FollowingStore } from "./following_routes.js";

describe("C46 authorized private Following API",()=>{
  const calls:string[]=[];
  const store:FollowingStore={
    async list(v){calls.push("list:"+v.tenantId+":"+v.fanId+":"+v.language);
      return {items:[],nextCursor:null};},
    async setMute(v){calls.push("mute:"+v.tenantId+":"+v.fanId+":"+v.characterId+":"+v.muted);
      return v.characterId==="missing"?null:v.muted;}
  };
  const open:FastifyInstance[]=[];
  const app=async()=>{
    const server=Fastify();
    server.setErrorHandler((error,_request,reply)=>reply.code(error.statusCode??500)
      .send({code:error.message}));
    registerFollowingRoutes(server,{auth:{async fan(header){
      if(header!=="Bearer fan")throw Object.assign(new Error("unauthorized"),{statusCode:401});
      return {tenantId:"tenant_real",userId:"fan_real"};
    }},store});
    await server.ready();open.push(server);return server;
  };
  afterEach(async()=>{await Promise.all(open.splice(0).map(a=>a.close()));calls.length=0;});
  it("rejects unauthenticated and forged fan identity before touching the store",async()=>{
    const server=await app();
    expect((await server.inject({method:"GET",url:"/v1/me/following?tenantId=other&fanId=victim"})).statusCode).toBe(401);
    expect(calls).toEqual([]);
    const res=await server.inject({method:"GET",url:"/v1/me/following?tenantId=other&fanId=victim&language=ha",
      headers:{authorization:"Bearer fan"}});
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(["list:tenant_real:fan_real:ha"]);
  });
  it("rejects invalid page bounds and language before querying",async()=>{
    const server=await app(),headers={authorization:"Bearer fan"};
    expect((await server.inject({method:"GET",url:"/v1/me/following?limit=1000",headers})).statusCode).toBe(400);
    expect((await server.inject({method:"GET",url:"/v1/me/following?language=other-invalid",headers})).statusCode).toBe(400);
    expect(calls).toEqual([]);
  });
  it("rejects unknown/forged mute payload and never mutates a different fan",async()=>{
    const server=await app(),headers={authorization:"Bearer fan"};
    const bad=await server.inject({method:"PUT",url:"/v1/me/following/masana_a/mute",
      headers,payload:{muted:true,userId:"victim"}});
    expect(bad.statusCode).toBe(400);
    expect(calls).toEqual([]);
    const ok=await server.inject({method:"PUT",url:"/v1/me/following/masana_a/mute",
      headers,payload:{muted:false,tenantId:undefined}});
    expect(ok.statusCode).toBe(400);
    expect(calls).toEqual([]);
    const mute=await server.inject({method:"PUT",url:"/v1/me/following/masana_a/mute",
      headers,payload:{muted:true}});
    expect(mute.statusCode).toBe(200);
    expect(mute.json()).toEqual({characterId:"masana_a",muted:true});
    expect(calls).toEqual(["mute:tenant_real:fan_real:masana_a:true"]);
  });
  it("cannot mute a Masana that the caller does not follow",async()=>{
    const server=await app();
    const res=await server.inject({method:"PUT",url:"/v1/me/following/missing/mute",
      headers:{authorization:"Bearer fan"},payload:{muted:true}});
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({code:"masana_not_followed"});
  });
});

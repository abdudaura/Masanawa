import Fastify from "fastify";
import { describe,expect,it } from "vitest";
import { registerMissionRoutes } from "./routes.js";
import type { MissionRepository } from "@masanawa/masana-missions/ports";
describe("Admin J12 mission admission",()=>{
  const fake={} as MissionRepository;
  const start=(roles:string[],enabled=true)=>{
    const app=Fastify();
    registerMissionRoutes(app,{repository:fake,enabled:()=>enabled,
      authorize:async(_header)=>({tenantId:"tenant_a",userId:"staff",roles})});
    return app;
  };
  it("rejects fan even if a role is forged in body",async()=>{
    const app=start(["fan"]);
    const res=await app.inject({method:"POST",url:"/v1/admin/missions",
      payload:{roles:["super_admin"],characterId:"masana_a"}});
    expect(res.statusCode).toBe(403);await app.close();
  });
  it("denies every path while feature off",async()=>{
    const app=start(["ops_admin"],false);
    const res=await app.inject({method:"GET",url:"/v1/admin/missions"});
    expect(res.statusCode).toBe(410);await app.close();
  });
  it("returns 401 for rejected staff session without echoing credentials",async()=>{
    const app=Fastify();
    registerMissionRoutes(app,{repository:fake,enabled:()=>true,
      authorize:async()=>{throw Object.assign(new Error("jwt_private_do_not_leak"),{statusCode:401});}});
    const res=await app.inject({method:"GET",url:"/v1/admin/missions"});
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({code:"authentication_required"});
    expect(res.body).not.toContain("jwt_private");
    await app.close();
  });
  it("returns 403 when staff authority denies mission capability",async()=>{
    const app=Fastify();
    registerMissionRoutes(app,{repository:fake,enabled:()=>true,
      authorize:async()=>{throw Object.assign(new Error("no_permissions"),{statusCode:403});}});
    const res=await app.inject({method:"GET",url:"/v1/admin/missions"});
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({code:"staff_role_required"});
    await app.close();
  });
  it("rejects invalid or stale revision before storage",async()=>{
    const app=start(["ops_admin"]);
    const res=await app.inject({method:"PATCH",url:"/v1/admin/missions/mission_one/state",
      payload:{state:"active",revision:0}});
    expect(res.statusCode).toBe(422);await app.close();
  });
});

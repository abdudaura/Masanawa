import Fastify from "fastify";
import { describe,it,expect,vi } from "vitest";
import { createMasanaCallService } from "./service.js";
import { registerMasanaCallRoutes } from "./routes.js";
const id="character_0199f0d0-0000-7000-8000-000000000003";
const reqId="request_0199f0d0-0000-7000-8000-000000000004";
function harness(qualified=true,enabled=true) {
  const app=Fastify();
  const store={
    qualified:vi.fn(async()=>qualified),
    create:vi.fn(async()=>true),
    markActive:vi.fn(async()=>true),
    finish:vi.fn(async()=>true),
    get:vi.fn(async()=>null),
  };
  const provider={
    dispatch:vi.fn(async()=>{}),
    token:vi.fn(async()=>({url:"wss://lk.example",token:"short-lived",expiresAt:"2026-10-11T05:00:00Z"})),
    stop:vi.fn(async()=>{}),
  };
  const service=createMasanaCallService({store,provider,
    resolveFan:async()=>({tenantId:"tenant-a",fanUserId:"fan-a"}),
    enabled:async()=>enabled});
  registerMasanaCallRoutes(app,service);
  return {app,store,provider};
}
describe("J04 API admission + fail-closed LiveKit dispatch",()=>{
  it("denies non-Masana / human targets before room creation",async()=>{
    const h=harness(false);
    try{
      const r=await h.app.inject({method:"POST",url:"/v1/calls",
        headers:{authorization:"Bearer fan"},payload:{characterId:id,requestId:reqId}});
      expect(r.statusCode).toBe(403);
      expect(h.store.create).not.toHaveBeenCalled();
      expect(h.provider.dispatch).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
  it("refuses all provider calls when kill switch is off",async()=>{
    const h=harness(true,false);
    try{
      const r=await h.app.inject({method:"POST",url:"/v1/calls",
        headers:{authorization:"Bearer fan"},payload:{characterId:id,requestId:reqId}});
      expect(r.statusCode).toBe(503);
      expect(h.store.qualified).not.toHaveBeenCalled();
      expect(h.provider.dispatch).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
  it("binds actor and generates server-only room, ignoring forged body fields",async()=>{
    const h=harness();
    try{
      const r=await h.app.inject({method:"POST",url:"/v1/calls",
        headers:{authorization:"Bearer fan"},
        payload:{characterId:id,requestId:reqId,fanUserId:"victim",tenantId:"other",roomName:"attack"}});
      expect(r.statusCode).toBe(200);
      expect(h.store.create).toHaveBeenCalledWith(expect.objectContaining({
        tenantId:"tenant-a",fanUserId:"fan-a",characterId:id,requestId:reqId,
      }));
      expect(r.json().roomName).toMatch(/^masana-/);
      expect(h.provider.dispatch).toHaveBeenCalledOnce();
    }finally{await h.app.close();}
  });
  it("marks failed and issues no token after provider failure",async()=>{
    const h=harness();
    h.provider.dispatch.mockRejectedValueOnce(new Error("service_down"));
    try{
      const r=await h.app.inject({method:"POST",url:"/v1/calls",
        headers:{authorization:"Bearer fan"},payload:{characterId:id,requestId:reqId}});
      expect(r.statusCode).toBe(503);
      expect(h.store.finish).toHaveBeenCalledWith(expect.objectContaining({
        tenantId:"tenant-a",fanUserId:"fan-a",state:"failed",
      }));
      expect(h.provider.token).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
  it("rejects missing auth and malformed inputs",async()=>{
    const h=harness();
    try{
      const a=await h.app.inject({method:"POST",url:"/v1/calls",
        payload:{characterId:id,requestId:reqId}});
      const b=await h.app.inject({method:"POST",url:"/v1/calls",
        headers:{authorization:"Bearer fan"},payload:{characterId:"human_a",requestId:reqId}});
      expect(a.statusCode).toBe(401);
      expect(b.statusCode).toBe(422);
      expect(h.provider.dispatch).not.toHaveBeenCalled();
    }finally{await h.app.close();}
  });
});

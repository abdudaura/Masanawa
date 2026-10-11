import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import {mintPlatformSessionToken,type FanDeviceSessionStore} from "@masanawa/security";
import {registerFanDeviceRoutes} from "./device_sessions.js";

const token=mintPlatformSessionToken("access"),header="Bearer "+token;
const id="4eadd05d-d474-4fd0-848f-8c5791db63f6";
function setup() {
  const app=Fastify();
  const store:FanDeviceSessionStore={
    list:vi.fn(async()=>[{id,startedAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),
      expiresAt:new Date().toISOString(),current:false}]),
    revoke:vi.fn(async()=>"revoked")
  };
  const authorize=vi.fn(async(h:string|undefined)=>h===header?{tenantId:"ten",fanUserId:"fan"}:null);
  registerFanDeviceRoutes(app,{authorize,store});
  return {app,store,authorize};
}
describe("C09 trusted device-security routes",()=>{
  it("never accepts forged tenant/user headers or unauthenticated requests",async()=>{
    const {app,store}=setup();
    const r=await app.inject({method:"GET",url:"/v1/account/devices",
      headers:{"x-tenant-id":"victim","x-user-id":"victim"}});
    expect(r.statusCode).toBe(401);expect(store.list).not.toHaveBeenCalled();await app.close();
  });
  it("binds list to resolved tenant and hashes only the current bearer",async()=>{
    const {app,store}=setup();
    const r=await app.inject({method:"GET",url:"/v1/account/devices",
      headers:{authorization:header,"x-tenant-id":"victim"}});
    expect(r.statusCode).toBe(200);
    expect(store.list).toHaveBeenCalledWith({tenantId:"ten",fanUserId:"fan"},expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(r.body).not.toContain(token);await app.close();
  });
  it("rejects forged scope/body and current-device revocation",async()=>{
    const {app,store}=setup();
    let r=await app.inject({method:"POST",url:`/v1/account/devices/${id}/revoke`,
      headers:{authorization:header},payload:{idempotencyKey:"revoke-key-001",fanUserId:"victim"}});
    expect(r.statusCode).toBe(422);expect(store.revoke).not.toHaveBeenCalled();
    (store.revoke as ReturnType<typeof vi.fn>).mockResolvedValue("current");
    r=await app.inject({method:"POST",url:`/v1/account/devices/${id}/revoke`,
      headers:{authorization:header},payload:{idempotencyKey:"revoke-key-001"}});
    expect(r.statusCode).toBe(409);
    (store.revoke as ReturnType<typeof vi.fn>).mockResolvedValue("step_up_required");
    r=await app.inject({method:"POST",url:`/v1/account/devices/${id}/revoke`,
      headers:{authorization:header},payload:{idempotencyKey:"revoke-key-002"}});
    expect(r.statusCode).toBe(428);
    expect(r.json()).toEqual({code:"recent_verification_required"});
    await app.close();
  });
});

import {describe,it,expect,vi} from "vitest";
import {createModerationAuthority} from "./auth.js";
import type {PlatformSessionIdentity} from "@masanawa/security";
const identity={tenantId:"tenant_1",userId:"user_1",profile:{
 tenantId:"tenant_1",userId:"user_1",name:"fan",email:null,phone:null,
 locale:"en",createdAt:"2026-10-10T00:00:00Z"}} as PlatformSessionIdentity;
describe("J13 auth authority",()=>{
 it("never derives staff or Gwani authority from unverified user input",async()=>{
  const roles=vi.fn().mockResolvedValue([]);
  const sessions={authorize:vi.fn().mockResolvedValue(identity)};
  const targetAccess={canRead:vi.fn().mockResolvedValue(true)};
  const a=createModerationAuthority({sessions,staffRoles:{roles},targetAccess});
  expect((await a.authorize("Bearer msw_access_token")).kind).toBe("fan");
  await expect(a.authorize("Bearer msw_agent_forged")).rejects.toMatchObject({statusCode:401});
  await expect(a.authorize(undefined)).rejects.toMatchObject({statusCode:401});
  expect(sessions.authorize).toHaveBeenCalledTimes(1);
 });
 it("requires canonical moderator role and denies inaccessible or failing sources",async()=>{
  const sessions={authorize:vi.fn().mockResolvedValue(identity)};
  const roles=vi.fn().mockResolvedValue(["moderator","pricing_manager"]);
  const canRead=vi.fn().mockRejectedValue(new Error("source offline"));
  const a=createModerationAuthority({sessions,staffRoles:{roles},targetAccess:{canRead}});
  const who=await a.authorize("Bearer authenticated");
  expect(who.roles).toEqual(["moderator"]);
  expect(who.kind).toBe("staff");
  await expect(a.canReadTarget(who,{kind:"comment",id:"comment_1"}))
   .rejects.toMatchObject({statusCode:403});
 });
});

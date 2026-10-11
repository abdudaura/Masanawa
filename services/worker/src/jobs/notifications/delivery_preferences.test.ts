import {describe,it,expect,vi} from "vitest";
import {maySendOptionalPush} from "./delivery_preferences.js";
const event={tenantId:"tenant_1",fanUserId:"fan_1",kind:"wallet" as const};
describe("optional pushes never remove durable inbox notices",()=>{
 it("requires consent",async()=>{
  expect(await maySendOptionalPush(event,{pushEnabled:vi.fn().mockResolvedValue(true)})).toBe(true);
  expect(await maySendOptionalPush(event,{pushEnabled:vi.fn().mockResolvedValue(false)})).toBe(false);
 });
 it("fails closed on provider/prefs database failure",async()=>{
  expect(await maySendOptionalPush(event,{pushEnabled:vi.fn().mockRejectedValue(new Error("down"))})).toBe(false);
 });
});

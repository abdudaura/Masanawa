import {describe,it,expect,vi} from "vitest";
import {deliverReversal} from "./reversal.js";
describe("J13 reversal",()=>{
 it("refuses a disputed job without applied action and never calls provider",async()=>{
  const revert=vi.fn();
  const job={tenantId:"tenant_test",actionId:"action_test",operationId:"outbox-event_test",fence:1,
   action:{tenantId:"tenant_test",actionId:"action_test",caseId:"case_test",kind:"user_ban" as const,
   targetKind:"account" as const,targetId:"user_a",state:"approved" as const,reason:"reason",proposedBy:"gwani",
   approvedBy:"moderator1",secondApprovedBy:"moderator2",expiresAt:null,version:3}};
  await expect(deliverReversal(job,{enabled:true,adapter:{revert},repository:{acknowledgeReversal:vi.fn()}})).rejects.toThrow();
  expect(revert).not.toHaveBeenCalled();
 });
});

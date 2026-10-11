import {describe,it,expect,vi} from "vitest";
import {deliverApprovedAction} from "./actions.js";
const action={tenantId:"t1",actionId:"action1",caseId:"case1",targetKind:"comment" as const,targetId:"comment1",kind:"hide_comment" as const,state:"approved" as const,reason:"spam",proposedBy:"gwani",approvedBy:"staff",secondApprovedBy:null,expiresAt:"2027-01-01T00:00:00Z",version:2};
describe("J13 worker approval boundary",()=>{
 it("keeps live enforcement off unless flag enabled",async()=>{
  const apply=vi.fn();const ack=vi.fn();
  expect(await deliverApprovedAction({action,operationId:"op",fence:1},{enabled:false,adapter:{apply},repository:{acknowledge:ack}})).toBe("disabled");
  expect(apply).not.toHaveBeenCalled();
 });
 it("refuses unapproved, self-reviewed and expired proposals",async()=>{
  const adapter={apply:vi.fn()},repository={acknowledge:vi.fn()};
  const base={operationId:"op",fence:1};
  for(const candidate of [{...action,state:"proposed" as const},{...action,approvedBy:"gwani"},{...action,expiresAt:"2000-01-01T00:00:00Z"}]){
   await expect(deliverApprovedAction({...base,action:candidate},{enabled:true,adapter,repository})).rejects.toThrow();
  }
  expect(adapter.apply).not.toHaveBeenCalled();
 });
 it("requires second distinct approver for bans",async()=>{
  const adapter={apply:vi.fn()},repository={acknowledge:vi.fn()};
  await expect(deliverApprovedAction({action:{...action,kind:"user_ban",targetKind:"account",secondApprovedBy:null,expiresAt:null},operationId:"op",fence:1},{enabled:true,adapter,repository})).rejects.toThrow();
 });
});

import {describe,it,expect} from "vitest";
import {CaseError,assertActionTarget,decisionRequiredApprovals,requireCaseViewer,requireModerator} from "./index.js";
const record={tenantId:"tenant-a",caseId:"case-1",reporterUserId:"user-a",targetKind:"comment" as const,targetId:"comment-1",category:"spam" as const,details:"spam",state:"open" as const,version:1,slaDueAt:"2026-10-11T00:00:00Z",createdAt:"2026-10-10T00:00:00Z",updatedAt:"2026-10-10T00:00:00Z"};
describe("J13 authority and actions",()=>{
 it("allows only tenant and case owner to view",()=>{
  expect(()=>requireCaseViewer({tenantId:"tenant-a",userId:"user-a",kind:"fan",roles:[]},record)).not.toThrow();
  expect(()=>requireCaseViewer({tenantId:"tenant-b",userId:"user-a",kind:"staff",roles:["super_admin"]},record)).toThrow(CaseError);
  expect(()=>requireCaseViewer({tenantId:"tenant-a",userId:"user-b",kind:"fan",roles:[]},record)).toThrow(CaseError);
 });
 it("fences Gwani and role-free staff from staff decisions",()=>{
  for(const kind of ["gwani","fan"] as const)expect(()=>requireModerator({tenantId:"tenant-a",userId:"x",kind,roles:["moderator"]})).toThrow();
  expect(()=>requireModerator({tenantId:"tenant-a",userId:"staff",kind:"staff",roles:["moderator"]})).not.toThrow();
 });
 it("refuses unrelated targets and requires dual approval for bans",()=>{
  expect(()=>assertActionTarget("hide_comment","transaction")).toThrow();
  expect(()=>assertActionTarget("hide_comment","comment")).not.toThrow();
  expect(decisionRequiredApprovals("user_ban")).toBe(2);
  expect(decisionRequiredApprovals("room_mute")).toBe(1);
 });
});

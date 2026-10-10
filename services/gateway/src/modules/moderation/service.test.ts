import {describe,it,expect,vi} from "vitest";
import {CaseError,type Actor,type CaseRecord,type ActionRecord,type AppealRecord} from "@masanawa/moderation";
import {createCaseService,type CaseRepository} from "./service.js";
const fan:Actor={tenantId:"tenant_demo",userId:"fan1",kind:"fan",roles:[]};
const stranger:Actor={tenantId:"tenant_demo",userId:"fan2",kind:"fan",roles:[]};
const differentTenant:Actor={tenantId:"tenant_other",userId:"fan1",kind:"fan",roles:[]};
const gwani:Actor={tenantId:"tenant_demo",userId:"masana-gwani",kind:"gwani",roles:[]};
const mod:Actor={tenantId:"tenant_demo",userId:"staff1",kind:"staff",roles:["moderator"]};
const record:CaseRecord={
 tenantId:"tenant_demo",caseId:"case_demo",reporterUserId:"fan1",
 targetKind:"comment",targetId:"comment1",category:"spam",details:"suspicious links",
 state:"investigating",version:2,slaDueAt:"2026-10-11T00:00:00Z",
 createdAt:"2026-10-10T00:00:00Z",updatedAt:"2026-10-10T00:00:00Z"
};
const action:ActionRecord={tenantId:"tenant_demo",actionId:"action1",caseId:record.caseId,
 targetKind:record.targetKind,targetId:record.targetId,kind:"hide_comment",state:"proposed",
 reason:"spam evidence",proposedBy:"masana-gwani",approvedBy:null,secondApprovedBy:null,
 expiresAt:"2027-01-01T00:00:00Z",version:1};
const appeal:AppealRecord={tenantId:"tenant_demo",caseId:record.caseId,appealId:"appeal1",
 appellantUserId:"fan1",reason:"reconsider",state:"pending",reviewedBy:null,
 secondReviewedBy:null,version:1,createdAt:"2026-10-10T00:00:00Z"};
function harness(){
 const create=vi.fn<CaseRepository["create"]>().mockImplementation(async c=>c);
 const find=vi.fn<CaseRepository["find"]>().mockImplementation(async(tenant,id)=>
  tenant===record.tenantId&&id===record.caseId?{...record,events:[],actions:[action],appeals:[appeal],evidence:[]}:null);
 const list=vi.fn<CaseRepository["list"]>().mockResolvedValue([record]);
 const propose=vi.fn<CaseRepository["propose"]>().mockResolvedValue(action);
 const review=vi.fn<CaseRepository["review"]>().mockResolvedValue(action);
 const resolveAppeal=vi.fn<CaseRepository["resolveAppeal"]>().mockResolvedValue(appeal);
 const appendAppeal=vi.fn<CaseRepository["appeal"]>().mockResolvedValue(undefined);
 const dismiss=vi.fn<CaseRepository["dismiss"]>().mockResolvedValue(record);
 const identities:Record<string,Actor>={fan,stranger,differentTenant,gwani,mod};
 const canReadTarget=vi.fn().mockImplementation(async (_a:Actor,t:{kind:string;id:string})=>t.id==="comment1");
 const service=createCaseService({
  repository:{create,find,list,propose,review,appeal:appendAppeal,resolveAppeal},
  authority:{authorize:async header=>identities[header??""]??Promise.reject(new CaseError("unauthorized",401)),
             canReadTarget},now:()=>new Date("2026-10-10T10:00:00Z"),id:()=> "deterministic",
 });
 return {service,create,find,list,propose,review,resolveAppeal,appendAppeal,canReadTarget};
}
describe("J13 fan report → moderator decision → appeal",()=>{
 it("persists exact authorized fan target, reporter, request ID and SLA",async()=>{
  const h=harness();
  const out=await h.service.report("fan",{targetKind:"comment",targetId:"comment1",category:"spam",
   details:"suspicious links",clientRequestId:"request_123"});
  expect(out).toMatchObject({caseId:"case_deterministic",state:"open"});
  expect(h.create).toHaveBeenCalledWith(expect.objectContaining({
   tenantId:"tenant_demo",reporterUserId:"fan1",targetKind:"comment",targetId:"comment1",
   clientRequestId:"request_123",slaDueAt:"2026-10-11T10:00:00.000Z"
  }));
 });
 it("does not store reports for invisible targets, wrong actor, or anonymous caller",async()=>{
  const h=harness();const data={targetKind:"comment",targetId:"secret",category:"spam",details:"test",clientRequestId:"request_1"};
  await expect(h.service.report("fan",data)).rejects.toMatchObject({statusCode:404});
  await expect(h.service.report("mod",data)).rejects.toMatchObject({statusCode:403});
  await expect(h.service.report(undefined,data)).rejects.toMatchObject({statusCode:401});
  expect(h.create).not.toHaveBeenCalled();
 });
 it("never permits fan or cross-tenant case lookup, admin queue, proposals or reviews",async()=>{
  const h=harness();
  await expect(h.service.read("stranger",record.caseId)).rejects.toMatchObject({statusCode:404});
  await expect(h.service.read("differentTenant",record.caseId)).rejects.toMatchObject({statusCode:404});
  await expect(h.service.adminCases("fan")).rejects.toMatchObject({statusCode:403});
  await expect(h.service.review("gwani",record.caseId,action.actionId,{approve:true,expectedVersion:1}))
   .rejects.toMatchObject({statusCode:403});
  expect(h.review).not.toHaveBeenCalled();
 });
 it("lets Gwani propose only compatible reversible measures and keeps execution separate",async()=>{
  const h=harness();
  const submitted=await h.service.propose("gwani",record.caseId,{kind:"hide_comment",
   expectedCaseVersion:2,reason:"spam",expiresAt:"2026-10-11T00:00:00Z"});
  expect(submitted).toEqual(action);
  expect(h.propose).toHaveBeenCalledWith(expect.objectContaining({state:"proposed",approvedBy:null,secondApprovedBy:null}),2);
  await expect(h.service.propose("gwani",record.caseId,{kind:"user_ban",reason:"no",
   expectedCaseVersion:2})).rejects.toMatchObject({statusCode:400});
 });
 it("enforces moderator role on appeal review and reporter identity on new appeals",async()=>{
  const h=harness();
  await expect(h.service.reviewAppeal("fan",record.caseId,appeal.appealId,
   {uphold:true,expectedVersion:1})).rejects.toMatchObject({statusCode:403});
  await expect(h.service.appeal("stranger",record.caseId,"reconsider")).rejects.toMatchObject({statusCode:404});
  const value=await h.service.reviewAppeal("mod",record.caseId,appeal.appealId,
   {uphold:true,expectedVersion:1});
  expect(value).toEqual(appeal);
  expect(h.resolveAppeal).toHaveBeenCalledWith(record.tenantId,record.caseId,appeal.appealId,mod.userId,true,1);
 });
});

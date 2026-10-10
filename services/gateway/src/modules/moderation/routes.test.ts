import Fastify from "fastify";
import {afterEach,describe,it,expect,vi} from "vitest";
import type {Actor} from "@masanawa/moderation";
import {createCaseService,type CaseRepository} from "./service.js";
import {registerModerationRoutes} from "./routes.js";
const fan:Actor={tenantId:"tenant_j13",userId:"fan_j13",kind:"fan",roles:[]};
const mod:Actor={tenantId:"tenant_j13",userId:"staff_j13",kind:"staff",roles:["moderator"]};
const stranger:Actor={tenantId:"tenant_j13",userId:"fan_stranger",kind:"fan",roles:[]};
function fixture(){
 const fastify=Fastify();
 const opened={tenantId:"tenant_j13",caseId:"case_j13",reporterUserId:"fan_j13",
  targetKind:"comment" as const,targetId:"comment_j13",category:"spam" as const,
  details:"Spam",state:"open" as const,version:1,
  slaDueAt:"2026-10-11T00:00:00Z",createdAt:"2026-10-10T00:00:00Z",updatedAt:"2026-10-10T00:00:00Z"};
 const repo:CaseRepository={
  create:async request=>({...opened,caseId:request.caseId}),
  find:async(t,id)=>t===opened.tenantId&&id===opened.caseId?
    {...opened,events:[],actions:[],appeals:[],evidence:[]}:null,
  list:async(_t,reporterId)=>reporterId===null||reporterId==="fan_j13"?[opened]:[],
  propose:vi.fn().mockRejectedValue(new Error("not needed")),
  review:vi.fn().mockRejectedValue(new Error("not needed")),
  appeal:vi.fn().mockResolvedValue(undefined),
  resolveAppeal:vi.fn().mockRejectedValue(new Error("not needed")),
  dismiss:vi.fn().mockResolvedValue(opened),
 };
 const auth={authorize:async(header:string|undefined):Promise<Actor>=>{
   if(header==="Bearer fan")return fan;
   if(header==="Bearer moderator")return mod;
   if(header==="Bearer stranger")return stranger;
   throw Object.assign(new Error("unauthorized"),{statusCode:401});
 },canReadTarget:async(_actor:Actor,target:{kind:string;id:string})=>target.id==="comment_j13"};
 const service=createCaseService({repository:repo,authority:auth,id:()=> "j13",
  now:()=>new Date("2026-10-10T00:00:00Z")});
 registerModerationRoutes(fastify,service);
 return fastify;
}
describe("J13 real Fastify routes (authority and HTTP error surface)",()=>{
 const apps:ReturnType<typeof Fastify>[]=[];
 afterEach(async()=>{for(const app of apps.splice(0))await app.close();});
 it("allows fan filing visible report and reading own cases",async()=>{
  const app=fixture();apps.push(app);
  const result=await app.inject({method:"POST",url:"/v1/cases",
   headers:{authorization:"Bearer fan"},
   payload:{targetKind:"comment",targetId:"comment_j13",
    category:"spam",details:"Spam",clientRequestId:"request_j13"}});
  expect(result.statusCode).toBe(200);
  expect(result.json()).toMatchObject({caseId:"case_j13",state:"open"});
  const cases=await app.inject({method:"GET",url:"/v1/cases",
   headers:{authorization:"Bearer fan"}});
  expect(cases.statusCode).toBe(200);
  expect(cases.json().cases).toHaveLength(1);
 });
 it("refuses cross-fan case reading and staff queue or action decisions",async()=>{
  const app=fixture();apps.push(app);
  const leak=await app.inject({method:"GET",url:"/v1/cases/case_j13",
   headers:{authorization:"Bearer stranger"}});
  expect(leak.statusCode).toBe(404);
  const queue=await app.inject({method:"GET",url:"/v1/admin/cases",
   headers:{authorization:"Bearer fan"}});
  expect(queue.statusCode).toBe(403);
  const decision=await app.inject({method:"POST",
   url:"/v1/admin/cases/case_j13/actions/action_1/review",
   headers:{authorization:"Bearer fan"},
   payload:{approve:true,expectedVersion:1}});
  expect(decision.statusCode).toBe(403);
 });
 it("does not create a report when referenced source cannot be read",async()=>{
  const app=fixture();apps.push(app);
  const denial=await app.inject({method:"POST",url:"/v1/cases",
   headers:{authorization:"Bearer fan"},
   payload:{targetKind:"comment",targetId:"comment_other",
    category:"spam",details:"Spam",clientRequestId:"request_other"}});
  expect(denial.statusCode).toBe(404);
 });
});

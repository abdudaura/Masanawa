import { describe, it, expect } from "vitest";
import { createOperationsService } from "./service.js";
describe("A01 aggregate metrics authority",()=>{
 const metrics={read:async(tenantId:string)=>({pendingJobs:1,activeJobLeases:0,deadLetters:2,
  oldestPendingSeconds:100,openFinancialReconciliation:3,
  roomAnswerAgeSeconds:null,externalSyncLagSeconds:null,entitlementErrors:null,budgetWarnings:null})};
 const repo={listFlags:async()=>[],setFlag:async()=>({name:"posting" as const,enabled:false,revision:0,updatedAt:null}),audit:async()=>[]};
 it("allows a verified staff viewer to inspect tenant aggregate health",async()=>{
  const service=createOperationsService({repo,metrics,authorizer:{resolve:async()=>({tenantId:"tenant_a",userId:"staff_a",roles:["viewer" as const],mfaVerified:true})}});
  const data=await service.overview("Bearer staff");
  expect(data.pendingJobs).toBe(1);
  expect(data.externalSyncLagSeconds).toBeNull();
 });
 it("denies a fan with no staff role",async()=>{
  const service=createOperationsService({repo,metrics,authorizer:{resolve:async()=>({tenantId:"tenant_a",userId:"fan",roles:[],mfaVerified:true})}});
  await expect(service.overview("Bearer fan")).rejects.toMatchObject({status:403});
 });
 it("returns 503 if tenant-scoped telemetry source is not connected",async()=>{
  const service=createOperationsService({repo,authorizer:{resolve:async()=>({tenantId:"tenant_a",userId:"staff",roles:["viewer" as const],mfaVerified:true})}});
  await expect(service.overview("Bearer staff")).rejects.toMatchObject({status:503});
 });
});

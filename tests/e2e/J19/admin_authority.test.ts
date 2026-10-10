import { describe, expect, it } from "vitest";
import { createOperationsService } from "../../../services/gateway/src/modules/admin_operations/service.js";
describe("J19 staff role denials and fail closed states (source contract)",()=>{
 const repo={listFlags:async()=>[{name:"calls" as const,enabled:false,revision:0,updatedAt:null}],setFlag:async()=>({name:"calls" as const,enabled:false,revision:1,updatedAt:"2026-10-10T00:00:00Z"}),audit:async()=>[]};
 it("rejects absent role even with MFA",async()=>{
  const svc=createOperationsService({repo,authorizer:{resolve:async()=>({tenantId:"t",userId:"u",roles:[],mfaVerified:true})}});
  await expect(svc.flags(undefined)).rejects.toMatchObject({status:403});
 });
 it("rejects enabling finance-impacting calls without gate",async()=>{
  const svc=createOperationsService({repo,authorizer:{resolve:async()=>({tenantId:"t",userId:"u",roles:["super_admin" as const],mfaVerified:true})}});
  await expect(svc.setFlag(undefined,{name:"calls",enabled:true,expectedRevision:0,idempotencyKey:"j19-request-01",reason:"Attempted release before signoff"})).rejects.toMatchObject({status:403});
 });
});

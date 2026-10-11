import { describe, it, expect, vi } from "vitest";
import { createOperationsService, OperationsError, type OperationsAuthorizer, type OperationsRepository } from "./service.js";
const flags=[{name:"posting" as const,enabled:false,revision:0,updatedAt:null}];
function setup(roles:readonly ("ops_admin"|"super_admin"|"viewer")[],mfa=true){
 const repo:OperationsRepository={listFlags:vi.fn(async()=>flags),setFlag:vi.fn(async()=>flags[0]!),audit:vi.fn(async()=>[])};
 const auth:OperationsAuthorizer={resolve:vi.fn(async()=>({tenantId:"tenant-a",userId:"actor-a",roles,mfaVerified:mfa}))};
 return {repo,service:createOperationsService({repo,authorizer:auth})};
}
const mutation={name:"posting" as const,enabled:false,expectedRevision:0,idempotencyKey:"request-123",reason:"Operator emergency stop"};
describe("J19 admin operations authority",()=>{
 it("denies all fan and non-operator reads",async()=>{
  const x=setup(["viewer"]);
  await expect(x.service.flags("Bearer token")).rejects.toMatchObject({status:403});
  await expect(x.service.setFlag("Bearer token",mutation)).rejects.toMatchObject({status:403});
  expect(x.repo.setFlag).not.toHaveBeenCalled();
 });
 it("denies mutation without session MFA",async()=>{
  const x=setup(["ops_admin"],false);
  await expect(x.service.setFlag("Bearer token",mutation)).rejects.toMatchObject({status:403});
 });
 it("permits audited off switch to verified operator",async()=>{
  const x=setup(["ops_admin"]);
  await x.service.setFlag("Bearer token",mutation);
  expect(x.repo.setFlag).toHaveBeenCalledWith({...mutation,tenantId:"tenant-a",actorId:"actor-a"});
 });
 it("never enables without separate AF00 release approval",async()=>{
  const x=setup(["ops_admin"]);
  await expect(x.service.setFlag("Bearer token",{...mutation,enabled:true})).rejects.toMatchObject({code:"forbidden"});
  expect(x.repo.setFlag).not.toHaveBeenCalled();
 });
 it("refuses malformed idempotency and reason",async()=>{
  const x=setup(["ops_admin"]);
  await expect(x.service.setFlag("Bearer token",{...mutation,idempotencyKey:"bad",reason:"short"})).rejects.toBeInstanceOf(OperationsError);
 });
 it("rejects non-string reason and idempotency key before database access",async()=>{
  const x=setup(["ops_admin"]);
  await expect(x.service.setFlag("Bearer token",{...mutation,reason:42 as unknown as string}))
    .rejects.toMatchObject({code:"invalid",status:400});
  await expect(x.service.setFlag("Bearer token",{...mutation,idempotencyKey:12345678 as unknown as string}))
    .rejects.toMatchObject({code:"invalid",status:400});
  expect(x.repo.setFlag).not.toHaveBeenCalled();
 });
 it("requires super_admin MFA for staff and audit",async()=>{
  const x=setup(["ops_admin"]);
  await expect(x.service.staff("Bearer token")).rejects.toMatchObject({status:403});
  await expect(x.service.audit("Bearer token")).rejects.toMatchObject({status:403});
 });
 it("reports missing canonical staff adapter, never invents staff grants",async()=>{
  const x=setup(["super_admin"]);
  await expect(x.service.staff("Bearer token")).rejects.toMatchObject({status:503});
 });
});

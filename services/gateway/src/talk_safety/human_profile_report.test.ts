import { describe, expect, it } from "vitest";
import { createTalkSafetyService } from "./service.js";
import type { TalkSafetyRepository } from "./repository.js";
import type { TalkSafetyReport } from "./policy.js";

function harness(tenant="tenant-a"){
  const reports = new Map<string,TalkSafetyReport>();
  const repository:TalkSafetyRepository = {
    async appendReport(report){
      const key = report.tenantId + ":" + report.reporterUserId + ":" + report.clientRequestId;
      const old = reports.get(key);
      if(old) return old;
      reports.set(key,report);
      return report;
    },
    async resolveProfileUser({tenantId,handle}){
      return tenantId===tenant && handle==="amina" ? "user-amina" : null;
    },
    async resolveProfileUserById({tenantId,userId}){
      return tenantId===tenant && (userId==="user-amina" || userId==="user-reporter")
        ? userId : null;
    },
    async readPreference(){return null;},
    async setPreference(value){return value;},
    async readEnforcement(){return null;},
    async writeEnforcement({next}){return next;},
  };
  const service=createTalkSafetyService({
    repository,
    customerAuthorizer:{
      async authorize({authorizationHeader}){
        if(authorizationHeader!=="Bearer valid")throw Object.assign(
          new Error("UNAUTHORIZED"),{statusCode:401});
        return {tenantId:tenant,userId:"user-reporter"} as never;
      },
    },
    platformAuthority:{async authorize(){throw new Error("FORBIDDEN");}},
    now:()=> "2026-10-08T12:00:00.000Z",
    createReportId:()=> "report-001",
  });
  return {service,reports};
}

const base = {
  authorizationHeader:"Bearer valid",
  targetKind:"profile" as const,
  targetId:"@Amina",
  reason:"impersonation" as const,
  detail:"This person is pretending to be another creator.",
  clientRequestId:"human-profile-abc123",
  expectedReporterUserId:"user-reporter",
};

describe("R15 public human profile report",()=>{
  it("binds a mutable handle to an immutable tenant-scoped user identity and deduplicates retries",async()=>{
    const {service,reports}=harness();
    expect(await service.report(base)).toEqual({reportId:"report-001",accepted:true});
    expect(await service.report(base)).toEqual({reportId:"report-001",accepted:true});
    expect(reports.size).toBe(1);
    expect([...reports.values()][0]).toMatchObject({
      tenantId:"tenant-a",
      reporterUserId:"user-reporter",
      target:{kind:"profile",id:"user-amina"},
      reason:"impersonation",
    });
  });
  it("accepts a verified user ID as an existing Talk participant reference",async()=>{
    const {service,reports}=harness();
    await service.report({...base,targetId:"user-amina"});
    expect([...reports.values()][0]!.target.id).toBe("user-amina");
  });
  it("fails closed on missing or cross-tenant profiles",async()=>{
    const {service,reports}=harness();
    await expect(service.report({...base,targetId:"missing"}))
      .rejects.toMatchObject({statusCode:404});
    expect(reports.size).toBe(0);
  });
  it("rejects self reporting and invalid session before saving",async()=>{
    const {service,reports}=harness();
    await expect(service.report({...base,targetId:"user-reporter"}))
      .rejects.toMatchObject({statusCode:400});
    await expect(service.report({...base,authorizationHeader:undefined}))
      .rejects.toMatchObject({statusCode:401});
    expect(reports.size).toBe(0);
  });
  it("rejects a stale report after token replay under a different account",async()=>{
    const {service,reports}=harness();
    await expect(service.report({...base,expectedReporterUserId:"user-other"}))
      .rejects.toMatchObject({statusCode:409});
    expect(reports.size).toBe(0);
  });
  it("cannot report a profile from another tenant",async()=>{
    const {service,reports}=harness("tenant-b");
    await expect(service.report({...base,targetId:"someone-else"}))
      .rejects.toMatchObject({statusCode:404});
    expect(reports.size).toBe(0);
  });
});

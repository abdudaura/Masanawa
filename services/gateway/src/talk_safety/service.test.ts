import { describe,expect,it } from "vitest";
import {
  createTalkSafetyService,
} from "./service.js";
import type { TalkSafetyRepository } from "./repository.js";
import type {
  TalkSafetyEnforcement,
  TalkSafetyReport,
  TalkSafetyUserPreference,
} from "./policy.js";

function fixture(){
  const reports=new Map<string,TalkSafetyReport>();
  const preferences=new Map<string,TalkSafetyUserPreference>();
  const enforcement=new Map<string,TalkSafetyEnforcement>();
  const repository:TalkSafetyRepository={
    async appendReport(report){
      const key=`${report.reporterUserId}:${report.clientRequestId}`;
      const existing=reports.get(key);
      if(existing) return existing;
      reports.set(key,report);
      return report;
    },
    async resolveProfileUser({handle}){
      return handle==="amina" ? "user-amina" : null;
    },
    async resolveProfileUserById({userId}){
      return userId==="user-amina" ? "user-amina" : null;
    },
    async readPreference({viewerUserId,subjectUserId}){
      return preferences.get(`${viewerUserId}:${subjectUserId}`) ?? null;
    },
    async setPreference(value){
      preferences.set(`${value.viewerUserId}:${value.subjectUserId}`,value);
      return value;
    },
    async readEnforcement({kind,targetId}){
      return enforcement.get(`${kind}:${targetId}`) ?? null;
    },
    async writeEnforcement({next}){
      enforcement.set(`${next.target.kind}:${next.target.id}`,next);
      return next;
    },
  };
  const service=createTalkSafetyService({
    repository,
    customerAuthorizer:{
      async authorize({authorizationHeader}){
        if(authorizationHeader!=="Bearer customer"){
          throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        }
        return {
          tenantId:"tenant-1" as never,
          userId:"user-viewer" as never,
          profile:{
            tenantId:"tenant-1" as never,userId:"user-viewer" as never,
            name:"Viewer",email:null,phone:null,locale:"en",
            createdAt:"2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    platformAuthority:{
      async authorize({authorizationHeader}){
        if(authorizationHeader!=="Bearer safety-admin"){
          throw Object.assign(new Error("FORBIDDEN"),{statusCode:403});
        }
        return {tenantId:"tenant-1",actorId:"admin-1"};
      },
    },
    now:()=> "2026-10-07T10:00:00.000Z",
    createReportId:()=> "report-1",
  });
  return {service,reports,preferences,enforcement};
}

describe("Talk safety service",()=>{
  it("derives reporter identity from customer auth and idempotently reuses client request",async()=>{
    const {service}=fixture();
    const first=await service.report({
      authorizationHeader:"Bearer customer",
      targetKind:"talk",
      targetId:"talk-1",
      reason:"harassment",
      detail:"Repeated abuse",
      clientRequestId:"client-1",
    });
    const second=await service.report({
      authorizationHeader:"Bearer customer",
      targetKind:"talk",
      targetId:"talk-1",
      reason:"harassment",
      detail:"Repeated abuse",
      clientRequestId:"client-1",
    });
    expect(first).toEqual({reportId:"report-1",accepted:true});
    expect(second).toEqual(first);
  });

  it("resolves block/mute subject from server-side public profile handle",async()=>{
    const {service}=fixture();
    await expect(service.setPreference({
      authorizationHeader:"Bearer customer",
      handle:"@Amina",
      blocked:true,
      muted:false,
    })).resolves.toEqual({blocked:true,muted:false});
    await expect(service.readPreference({
      authorizationHeader:"Bearer customer",
      handle:"amina",
    })).resolves.toEqual({blocked:true,muted:false});
  });

  it("resolves block/mute subject from verified public-profile user id",async()=>{
    const {service}=fixture();
    await expect(service.setUserPreference({
      authorizationHeader:"Bearer customer",
      userId:"user-amina",
      blocked:false,
      muted:true,
    })).resolves.toEqual({blocked:false,muted:true});
    await expect(service.readUserPreference({
      authorizationHeader:"Bearer customer",
      userId:"user-amina",
    })).resolves.toEqual({blocked:false,muted:true});
    await expect(service.readUserPreference({
      authorizationHeader:"Bearer customer",
      userId:"user-missing",
    })).rejects.toMatchObject({statusCode:404});
  });

  it("keeps platform enforcement behind distinct safety authority",async()=>{
    const {service}=fixture();
    await expect(service.setEnforcement({
      authorizationHeader:"Bearer customer",
      targetKind:"replay",
      targetId:"replay-1",
      expectedRevision:0,
      visibility:"blocked",
      reasonCode:"policy.abuse",
    })).rejects.toMatchObject({statusCode:403});

    const blocked=await service.setEnforcement({
      authorizationHeader:"Bearer safety-admin",
      targetKind:"replay",
      targetId:"replay-1",
      expectedRevision:0,
      visibility:"blocked",
      reasonCode:"policy.abuse",
    });
    expect(blocked).toMatchObject({
      revision:1,
      visibility:"blocked",
      reasonCode:"policy.abuse",
    });
  });

  it("revision-guards subsequent platform decisions",async()=>{
    const {service}=fixture();
    await service.setEnforcement({
      authorizationHeader:"Bearer safety-admin",
      targetKind:"talk",
      targetId:"talk-1",
      expectedRevision:0,
      visibility:"restricted",
      reasonCode:"review.pending",
    });
    await expect(service.setEnforcement({
      authorizationHeader:"Bearer safety-admin",
      targetKind:"talk",
      targetId:"talk-1",
      expectedRevision:0,
      visibility:"public",
      reasonCode:null,
    })).rejects.toThrow("revision conflict");
    await expect(service.setEnforcement({
      authorizationHeader:"Bearer safety-admin",
      targetKind:"talk",
      targetId:"talk-1",
      expectedRevision:1,
      visibility:"public",
      reasonCode:null,
    })).resolves.toMatchObject({revision:2,visibility:"public",reasonCode:null});
  });
});

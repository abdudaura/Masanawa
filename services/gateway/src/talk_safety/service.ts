import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import {
  normalizeTalkSafetyEnforcement,
  normalizeTalkSafetyReport,
  normalizeTalkSafetyUserPreference,
  transitionTalkSafetyEnforcement,
  type TalkSafetyEnforcement,
  type TalkSafetyReportReason,
  type TalkSafetyTargetKind,
  type TalkSafetyVisibility,
} from "./policy.js";
import type { TalkSafetyRepository } from "./repository.js";

export interface TalkSafetyCustomerAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export interface TalkSafetyPlatformAuthority {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<Readonly<{ tenantId: string; actorId: string }>>;
}

export interface TalkSafetyService {
  report(input: Readonly<{
    authorizationHeader: string | undefined;
    targetKind: TalkSafetyTargetKind;
    targetId: string;
    reason: TalkSafetyReportReason;
    detail?: string | null;
    clientRequestId: string;
    expectedReporterUserId?: string;
  }>): Promise<Readonly<{ reportId: string; accepted: true }>>;
  readPreference(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
  }>): Promise<Readonly<{ blocked: boolean; muted: boolean }>>;
  setPreference(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
    blocked: boolean;
    muted: boolean;
  }>): Promise<Readonly<{ blocked: boolean; muted: boolean }>>;
  readUserPreference(input: Readonly<{
    authorizationHeader: string | undefined;
    userId: string;
  }>): Promise<Readonly<{ blocked: boolean; muted: boolean }>>;
  setUserPreference(input: Readonly<{
    authorizationHeader: string | undefined;
    userId: string;
    blocked: boolean;
    muted: boolean;
  }>): Promise<Readonly<{ blocked: boolean; muted: boolean }>>;
  readEnforcement(input: Readonly<{
    authorizationHeader: string | undefined;
    targetKind: TalkSafetyTargetKind;
    targetId: string;
  }>): Promise<TalkSafetyEnforcement>;
  setEnforcement(input: Readonly<{
    authorizationHeader: string | undefined;
    targetKind: TalkSafetyTargetKind;
    targetId: string;
    expectedRevision: number;
    visibility: TalkSafetyVisibility;
    reasonCode: string | null;
  }>): Promise<TalkSafetyEnforcement>;
}

function text(value:string,name:string,max=256):string{
  if(typeof value!=="string") throw new TypeError(`${name} is invalid`);
  const normalized=value.trim();
  if(!normalized || normalized.length>max) throw new TypeError(`${name} is invalid`);
  return normalized;
}
function userId(value:string):string{
  const normalized=text(value,"userId",256);
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u.test(normalized)) {
    throw new TypeError("userId is invalid");
  }
  return normalized;
}
function handle(value:string):string{
  const normalized=value.trim().toLowerCase().replace(/^@/u,"");
  if(!/^[a-z0-9_][a-z0-9_.-]{1,39}$/u.test(normalized)) {
    throw new TypeError("handle is invalid");
  }
  return normalized;
}

export function createTalkSafetyService(input:Readonly<{
  repository:TalkSafetyRepository;
  customerAuthorizer:TalkSafetyCustomerAuthorizer;
  platformAuthority:TalkSafetyPlatformAuthority;
  now?:()=>string;
  createReportId?:()=>string;
}>):TalkSafetyService{
  const now=input.now ?? (()=>new Date().toISOString());
  const createReportId=input.createReportId ?? (()=>`safety-report_${randomUUID()}`);

  async function customer(header:string|undefined){
    return input.customerAuthorizer.authorize({authorizationHeader:header});
  }
  async function platform(header:string|undefined){
    return input.platformAuthority.authorize({authorizationHeader:header});
  }

  return Object.freeze<TalkSafetyService>({
    async report(request){
      const reporter=await customer(request.authorizationHeader);
      if(request.expectedReporterUserId !== undefined &&
         request.expectedReporterUserId !== reporter.userId){
        throw Object.assign(new Error("reporter.session_changed"),{statusCode:409});
      }
      // A public human profile is addressed by a mutable handle in mobile UI,
      // but the moderation queue must retain the immutable tenant-scoped user ID.
      // Existing callers may supply a user ID directly (e.g. Talk participant).
      let targetId=text(request.targetId,"targetId");
      if(request.targetKind==="profile"){
        const resolvedById=/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u.test(targetId)
          ? await input.repository.resolveProfileUserById({
              tenantId:reporter.tenantId,userId:targetId,
            })
          : null;
        const resolved=resolvedById ?? await input.repository.resolveProfileUser({
          tenantId:reporter.tenantId,handle:handle(targetId),
        });
        if(!resolved) throw Object.assign(new Error("profiles.not_found"),{statusCode:404});
        if(resolved===reporter.userId){
          throw Object.assign(new Error("Cannot report your own profile"),{statusCode:400});
        }
        targetId=resolved;
      }
      const report=normalizeTalkSafetyReport({
        schemaVersion:1,
        reportId:createReportId(),
        tenantId:reporter.tenantId,
        reporterUserId:reporter.userId,
        target:{kind:request.targetKind,id:targetId},
        reason:request.reason,
        detail:request.detail ?? null,
        clientRequestId:text(request.clientRequestId,"clientRequestId"),
        createdAt:now(),
      });
      const saved=await input.repository.appendReport(report);
      return Object.freeze({reportId:saved.reportId,accepted:true as const});
    },

    async readPreference(request){
      const viewer=await customer(request.authorizationHeader);
      const subjectUserId=await input.repository.resolveProfileUser({
        tenantId:viewer.tenantId,
        handle:handle(request.handle),
      });
      if(!subjectUserId) throw Object.assign(new Error("profiles.not_found"),{statusCode:404});
      const value=await input.repository.readPreference({
        tenantId:viewer.tenantId,
        viewerUserId:viewer.userId,
        subjectUserId,
      });
      return Object.freeze({
        blocked:value?.blocked ?? false,
        muted:value?.muted ?? false,
      });
    },

    async setPreference(request){
      const viewer=await customer(request.authorizationHeader);
      const subjectUserId=await input.repository.resolveProfileUser({
        tenantId:viewer.tenantId,
        handle:handle(request.handle),
      });
      if(!subjectUserId) throw Object.assign(new Error("profiles.not_found"),{statusCode:404});
      const saved=await input.repository.setPreference(
        normalizeTalkSafetyUserPreference({
          schemaVersion:1,
          tenantId:viewer.tenantId,
          viewerUserId:viewer.userId,
          subjectUserId,
          blocked:request.blocked,
          muted:request.muted,
          updatedAt:now(),
        }),
      );
      return Object.freeze({blocked:saved.blocked,muted:saved.muted});
    },

    async readUserPreference(request){
      const viewer=await customer(request.authorizationHeader);
      const subjectUserId=await input.repository.resolveProfileUserById({
        tenantId:viewer.tenantId,
        userId:userId(request.userId),
      });
      if(!subjectUserId) throw Object.assign(new Error("profiles.not_found"),{statusCode:404});
      const value=await input.repository.readPreference({
        tenantId:viewer.tenantId,
        viewerUserId:viewer.userId,
        subjectUserId,
      });
      return Object.freeze({
        blocked:value?.blocked ?? false,
        muted:value?.muted ?? false,
      });
    },

    async setUserPreference(request){
      const viewer=await customer(request.authorizationHeader);
      const subjectUserId=await input.repository.resolveProfileUserById({
        tenantId:viewer.tenantId,
        userId:userId(request.userId),
      });
      if(!subjectUserId) throw Object.assign(new Error("profiles.not_found"),{statusCode:404});
      const saved=await input.repository.setPreference(
        normalizeTalkSafetyUserPreference({
          schemaVersion:1,
          tenantId:viewer.tenantId,
          viewerUserId:viewer.userId,
          subjectUserId,
          blocked:request.blocked,
          muted:request.muted,
          updatedAt:now(),
        }),
      );
      return Object.freeze({blocked:saved.blocked,muted:saved.muted});
    },

    async readEnforcement(request){
      const authority=await platform(request.authorizationHeader);
      const targetId=text(request.targetId,"targetId");
      return (
        await input.repository.readEnforcement({
          tenantId:authority.tenantId,
          kind:request.targetKind,
          targetId,
        })
      ) ?? normalizeTalkSafetyEnforcement({
        schemaVersion:1,
        tenantId:authority.tenantId,
        target:{kind:request.targetKind,id:targetId},
        revision:1,
        visibility:"public",
        reasonCode:null,
        updatedAt:now(),
      });
    },

    async setEnforcement(request){
      const authority=await platform(request.authorizationHeader);
      const targetId=text(request.targetId,"targetId");
      const current=await input.repository.readEnforcement({
        tenantId:authority.tenantId,
        kind:request.targetKind,
        targetId,
      });
      if(current===null){
        if(request.expectedRevision!==0){
          throw new Error("Safety enforcement revision conflict");
        }
        const next=normalizeTalkSafetyEnforcement({
          schemaVersion:1,
          tenantId:authority.tenantId,
          target:{kind:request.targetKind,id:targetId},
          revision:1,
          visibility:request.visibility,
          reasonCode:request.reasonCode,
          updatedAt:now(),
        });
        return input.repository.writeEnforcement({current:null,next});
      }
      const next=transitionTalkSafetyEnforcement(current,{
        expectedRevision:request.expectedRevision,
        visibility:request.visibility,
        reasonCode:request.reasonCode,
        updatedAt:now(),
      });
      return input.repository.writeEnforcement({current,next});
    },
  });
}


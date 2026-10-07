import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { TalkMediaAdmin } from "./livekit_admin.js";
import type { TalkAiSeatHostBridge } from "../talk_ai_seats/service.js";
import type {
  HostControlsView,
  TalkModerationRepository,
  TalkParticipationView,
  TalkQuestionView,
  TalkReaction,
} from "./model.js";

export interface TalkModerationAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkModerationError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkModerationError";
  }
}

export interface TalkModerationService {
  participation(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkParticipationView>;
  reaction(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    reaction: TalkReaction;
  }>): Promise<TalkParticipationView>;
  raiseHand(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    raised: boolean;
  }>): Promise<TalkParticipationView>;
  leaveSeat(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkParticipationView>;
  question(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    body: string;
  }>): Promise<TalkQuestionView>;
  hostQuestions(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<readonly TalkQuestionView[]>;
  hostQuestion(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    questionId: string;
    action: "answered" | "dismissed";
  }>): Promise<readonly TalkQuestionView[]>;
  hostControls(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<HostControlsView>;
  inviteHuman(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    handle: string;
  }>): Promise<import("./model.js").HumanInvitationView>;
  respondHumanInvitation(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    action: "accept" | "decline";
  }>): Promise<import("./model.js").HumanInvitationView>;
  hostRequest(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    requestId: string;
    action: "accept" | "decline";
  }>): Promise<HostControlsView>;
  hostParticipant(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    participantId: string;
    action: "mute" | "unmute" | "remove";
  }>): Promise<HostControlsView>;
  end(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<{ readonly ended: true }>;
}

function bounded(value: string, label: string): string {
  const normalized=value.trim();
  if(!normalized || normalized.length>160) throw new TalkModerationError(`talks.${label}_invalid`,400);
  return normalized;
}

function boundedQuestion(value: string): string {
  const normalized=value.trim().replace(/\s+/gu," ");
  if(!normalized || normalized.length>500) throw new TalkModerationError("talks.question_invalid",400);
  return normalized;
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof TalkModerationError) throw error;
  const code=error instanceof Error ? error.message : "talks.moderation_failed";
  const status =
    code === "talks.host_forbidden" || code === "talks.blocked_by_host" ? 403 :
    code === "talks.not_found" ? 404 :
    code === "talks.request_not_found" || code === "talks.participant_not_found" ||
    code === "talks.question_not_found" || code === "talks.invitation_not_found" ||
    code === "profiles.not_found" ? 404 :
    code === "talks.host_immutable" || code === "talks.not_live" ||
    code === "talks.not_speaker" ||
    code === "talks.ai_commerce_required" || code === "talks.cannot_invite_self" ||
    code === "talks.invitee_unavailable" || code === "talks.already_participant" ||
    code === "talks.invitation_resolved" || code === "talks.invitation_invalid" ||
    code === "Talk live revision conflict" ? 409 :
    code === "talks.reaction_rate_limited" || code === "talks.question_rate_limited" ? 429 :
    code.includes("capacity") ? 409 :
    400;
  throw new TalkModerationError(code,status);
}

export function createTalkModerationService(input: Readonly<{
  repository: TalkModerationRepository;
  authorizer: TalkModerationAuthorizer;
  invitationActivity?: Readonly<{
    append(input: Readonly<{
      tenantId: string;
      activityId: string;
      userId: string;
      title: string;
      detail: string;
      createdAt: string;
      talkId: string;
      requiresAction: boolean;
      actionLabel?: string;
      unread: boolean;
    }>): Promise<void>;
  }>;
  now?: () => string;
  mediaAdmin?: TalkMediaAdmin;
  aiSeats?: TalkAiSeatHostBridge;
  onTalkEnded?: (input: Readonly<{
    tenantId: string;
    talkId: string;
    reason: "host_ended";
    now: string;
  }>) => Promise<void>;
}>): TalkModerationService {
  const now=input.now ?? (()=>new Date().toISOString());

  async function identity(header:string|undefined){
    return input.authorizer.authorize({authorizationHeader:header});
  }
  async function guarded<T>(operation:()=>Promise<T>):Promise<T>{
    try{return await operation();}catch(error){return mapRepositoryError(error);}
  }
  async function applyMedia(talkId:string, actions: readonly import("./model.js").TalkMediaAction[]):Promise<void>{
    if(!input.mediaAdmin) return;
    try{
      for(const action of actions){
        if(action.type==="publish"){
          await input.mediaAdmin.setCanPublish({room:talkId,identity:action.identity,canPublish:action.canPublish});
        }else{
          await input.mediaAdmin.removeParticipant({room:talkId,identity:action.identity});
        }
      }
    }catch{
      throw new TalkModerationError("talks.media_admin_failed",502);
    }
  }

  return Object.freeze({
    async participation(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.participation({
        tenantId:viewer.tenantId,userId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async reaction(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.setReaction({
        tenantId:viewer.tenantId,userId:viewer.userId,displayName:viewer.profile.name,
        talkId:bounded(request.talkId,"talk_id"),reaction:request.reaction,now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async raiseHand(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.setRaised({
        tenantId:viewer.tenantId,userId:viewer.userId,displayName:viewer.profile.name,
        talkId:bounded(request.talkId,"talk_id"),raised:request.raised,now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async leaveSeat(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.leaveHumanSeat({
        tenantId:viewer.tenantId,
        userId:viewer.userId,
        talkId:bounded(request.talkId,"talk_id"),
        now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      await applyMedia(request.talkId,result.mediaActions);
      return result.participation;
    },
    async question(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.submitQuestion({
        tenantId:viewer.tenantId,userId:viewer.userId,displayName:viewer.profile.name,
        talkId:bounded(request.talkId,"talk_id"),questionId:`question_${randomUUID()}`,
        body:boundedQuestion(request.body),now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async hostQuestions(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.listQuestions({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async hostQuestion(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.resolveQuestion({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
        questionId:bounded(request.questionId,"question_id"),action:request.action,now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async hostControls(request){
      const viewer=await identity(request.authorizationHeader);
      if(input.aiSeats){
        await input.aiSeats.sweep({
          authorizationHeader:request.authorizationHeader,
          talkId:request.talkId,
        });
      }
      const result=await guarded(()=>input.repository.hostControls({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      return result;
    },
    async inviteHuman(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.inviteHuman({
        tenantId:viewer.tenantId,
        hostUserId:viewer.userId,
        talkId:bounded(request.talkId,"talk_id"),
        handle:bounded(request.handle,"profile_handle").toLowerCase(),
        now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      if(input.invitationActivity){
        await input.invitationActivity.append({
          tenantId:viewer.tenantId,
          activityId:`talk-invite:${result.talkId}:${result.inviteeUserId}`,
          userId:result.inviteeUserId,
          title:`${result.hostName} invited you to speak`,
          detail:`Join “${result.talkTitle}” as a free human Speaker.`,
          createdAt:result.updatedAt,
          talkId:result.talkId,
          requiresAction:true,
          actionLabel:"Respond",
          unread:true,
        });
      }
      return result;
    },
    async respondHumanInvitation(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.respondHumanInvitation({
        tenantId:viewer.tenantId,
        inviteeUserId:viewer.userId,
        talkId:bounded(request.talkId,"talk_id"),
        action:request.action,
        now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      await applyMedia(request.talkId,result.mediaActions);
      if(input.invitationActivity){
        const accepted=result.invitation.status==="accepted";
        await input.invitationActivity.append({
          tenantId:viewer.tenantId,
          activityId:`talk-invite:${result.invitation.talkId}:${result.invitation.inviteeUserId}`,
          userId:result.invitation.inviteeUserId,
          title:accepted ? "Talk invitation accepted" : "Talk invitation declined",
          detail:accepted
            ? `You joined “${result.invitation.talkTitle}” as a Speaker.`
            : `You declined ${result.invitation.hostName}’s invitation to “${result.invitation.talkTitle}”.`,
          createdAt:result.invitation.updatedAt,
          talkId:result.invitation.talkId,
          requiresAction:false,
          unread:false,
        });
      }
      return result.invitation;
    },
    async hostRequest(request){
      const viewer=await identity(request.authorizationHeader);
      if(input.aiSeats){
        const ai=await input.aiSeats.decide({
          authorizationHeader:request.authorizationHeader,
          talkId:request.talkId,
          requestId:request.requestId,
          action:request.action,
        });
        if(ai.handled){
          const controls=await guarded(()=>input.repository.hostControls({
            tenantId:viewer.tenantId,
            hostUserId:viewer.userId,
            talkId:bounded(request.talkId,"talk_id"),
          }));
          if(!controls) throw new TalkModerationError("talks.not_found",404);
          return controls;
        }
      }
      const result=await guarded(()=>input.repository.actOnRequest({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
        requestId:bounded(request.requestId,"request_id"),action:request.action,now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      await applyMedia(request.talkId,result.mediaActions);
      return result.controls;
    },
    async hostParticipant(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.moderateParticipant({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
        participantId:bounded(request.participantId,"participant_id"),action:request.action,now:now(),
      }));
      if(!result) throw new TalkModerationError("talks.not_found",404);
      await applyMedia(request.talkId,result.mediaActions);
      return result.controls;
    },
    async end(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.endTalk({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),now:now(),
      }));
      if(result===null) throw new TalkModerationError("talks.not_found",404);
      await applyMedia(request.talkId,result.mediaActions);
      if(input.onTalkEnded){
        await input.onTalkEnded({
          tenantId:viewer.tenantId,
          talkId:request.talkId,
          reason:"host_ended",
          now:now(),
        });
      }
      return Object.freeze({ended:true as const});
    },
  });
}

import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { TalkReplayCoordinator } from "./egress/coordinator.js";
import type {
  MyTalksView,
  TalkReplayHostView,
  TalkReplayPlaybackView,
  TalkReplayRepository,
} from "./model.js";

export interface TalkReplayAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkReplayError extends Error {
  constructor(readonly code:string, readonly statusCode:number){
    super(code);
    this.name="TalkReplayError";
  }
}

export interface TalkReplayService {
  start(input: Readonly<{
    authorizationHeader:string|undefined;
    talkId:string;
    consent:boolean;
    publicationPreference:"publish"|"private";
  }>):Promise<TalkReplayHostView>;
  view(input: Readonly<{
    authorizationHeader:string|undefined;
    talkId:string;
  }>):Promise<TalkReplayHostView>;
  publication(input: Readonly<{
    authorizationHeader:string|undefined;
    talkId:string;
    action:"publish"|"unpublish"|"discard";
  }>):Promise<TalkReplayHostView>;
  myTalks(input: Readonly<{
    authorizationHeader:string|undefined;
    limit:number;
  }>):Promise<MyTalksView>;
  playback(input: Readonly<{
    authorizationHeader:string|undefined;
    talkId:string;
  }>):Promise<TalkReplayPlaybackView>;
  appendSegment(input: Parameters<TalkReplayRepository["appendSegment"]>[0]):ReturnType<TalkReplayRepository["appendSegment"]>;
  finalizeFromLive(input: Parameters<TalkReplayRepository["finalizeFromLive"]>[0]):ReturnType<TalkReplayRepository["finalizeFromLive"]>;
  platformBlock(input: Parameters<TalkReplayRepository["platformBlock"]>[0]):ReturnType<TalkReplayRepository["platformBlock"]>;
}

function bounded(value:string,label:string):string{
  const normalized=value.trim();
  if(!normalized || normalized.length>240) throw new TalkReplayError(`talks.replay.${label}_invalid`,400);
  return normalized;
}
function mapError(error:unknown):never{
  if(error instanceof TalkReplayError) throw error;
  const code=error instanceof Error?error.message:"talks.replay.failed";
  const status=
    /Only the human Talk Host/u.test(code) || code==="talks.host_forbidden" ? 403 :
    code==="talks.not_found" || code==="talks.replay.not_found" ? 404 :
    /already|not finalized|not currently published|publication is blocked|must be unpublished|cannot be discarded|revision conflict|no recorded media/u.test(code) ? 409 :
    /disabled by policy|consent|required|invalid|outside|duration|ordered|segment/u.test(code) ? 400 :
    400;
  throw new TalkReplayError(code,status);
}

export function createTalkReplayService(input:Readonly<{
  repository:TalkReplayRepository;
  authorizer:TalkReplayAuthorizer;
  now?:()=>string;
  createRecordingId?:()=>string;
  coordinator?:TalkReplayCoordinator;
}>):TalkReplayService{
  const now=input.now??(()=>new Date().toISOString());
  const createRecordingId=input.createRecordingId??(()=>`recording_${randomUUID()}`);
  async function identity(header:string|undefined){
    return input.authorizer.authorize({authorizationHeader:header});
  }
  async function guarded<T>(fn:()=>Promise<T>):Promise<T>{
    try{return await fn();}catch(error){return mapError(error);}
  }
  return Object.freeze({
    async start(request){
      const viewer=await identity(request.authorizationHeader);
      if(!input.coordinator) throw new TalkReplayError("talks.replay.recording_unavailable",503);
      const startedAt=now();
      const result=await guarded(()=>input.repository.start({
        tenantId:viewer.tenantId,
        hostUserId:viewer.userId,
        talkId:bounded(request.talkId,"talk_id"),
        recordingId:createRecordingId(),
        hostRecordingConsent:request.consent,
        publicationPreference:request.publicationPreference,
        now:startedAt,
      }));
      if(!result) throw new TalkReplayError("talks.not_found",404);
      if(result.recordingState!=="recording") return result;
      try{
        await input.coordinator.start({
          tenantId:viewer.tenantId,talkId:result.talkId,
          recordingId:result.recordingId,startedAt:result.startedAt,
        });
      }catch{
        try{
          await input.repository.hostAction({
            tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:result.talkId,
            action:"discard",now:now(),
          });
        }catch{}
        throw new TalkReplayError("talks.replay.recording_unavailable",503);
      }
      return result;
    },
    async view(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.hostView({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
      }));
      if(!result) throw new TalkReplayError("talks.replay.not_found",404);
      return result;
    },
    async publication(request){
      const viewer=await identity(request.authorizationHeader);
      const result=await guarded(()=>input.repository.hostAction({
        tenantId:viewer.tenantId,hostUserId:viewer.userId,talkId:bounded(request.talkId,"talk_id"),
        action:request.action,now:now(),
      }));
      if(!result) throw new TalkReplayError("talks.replay.not_found",404);
      if(request.action==="discard"&&input.coordinator){
        await guarded(()=>input.coordinator!.abort({
          tenantId:viewer.tenantId,talkId:result.talkId,recordingId:result.recordingId,
        }));
      }
      return result;
    },
    async myTalks(request){
      const viewer=await identity(request.authorizationHeader);
      return input.repository.myTalks({tenantId:viewer.tenantId,hostUserId:viewer.userId,limit:request.limit});
    },
    async playback(request){
      const viewer=await identity(request.authorizationHeader);
      if(!input.coordinator) throw new TalkReplayError("talks.replay.playback_unavailable",503);
      const result=await guarded(()=>input.coordinator!.playback({
        tenantId:viewer.tenantId,talkId:bounded(request.talkId,"talk_id"),viewerUserId:viewer.userId,
      }));
      if(!result) throw new TalkReplayError("talks.replay.not_found",404);
      return result;
    },
    appendSegment(request){return guarded(()=>input.repository.appendSegment(request));},
    finalizeFromLive(request){return guarded(()=>input.repository.finalizeFromLive(request));},
    platformBlock(request){return guarded(()=>input.repository.platformBlock(request));},
  });
}

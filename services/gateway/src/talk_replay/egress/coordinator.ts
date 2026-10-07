import type { TalkReplayRepository, TalkReplayPlaybackView } from "../model.js";
import type { LiveKitReplayEgress } from "./livekit_egress.js";
import type { ReplayObjectStore } from "../playback/s3_object_store.js";
import type { ReplayMediaRepository } from "./postgres_media_repository.js";

export interface TalkReplayCoordinator {
  start(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;startedAt:string;
  }>):Promise<void>;
  finalize(input:Readonly<{
    tenantId:string;talkId:string;reason:"host_ended"|"host_grace_expired"|"platform_ended";now:string;
  }>):Promise<void>;
  playback(input:Readonly<{
    tenantId:string;talkId:string;viewerUserId:string;
  }>):Promise<TalkReplayPlaybackView|null>;
}

function safePart(value:string):string{
  const normalized=value.replace(/[^A-Za-z0-9_-]+/gu,"_").replace(/^_+|_+$/gu,"");
  if(!normalized) throw new TypeError("Replay storage identifier is invalid");
  return normalized.slice(0,160);
}

export function createTalkReplayCoordinator(input:Readonly<{
  replay:TalkReplayRepository;
  media:ReplayMediaRepository;
  egress:LiveKitReplayEgress;
  objects:ReplayObjectStore;
  playbackTtlSeconds:number;
}>):TalkReplayCoordinator{
  return Object.freeze({
    async start(request){
      const existing=await input.media.current({
        tenantId:request.tenantId,talkId:request.talkId,recordingId:request.recordingId,
      });
      if(existing) return;
      const objectKey=[
        "talk-replays",
        safePart(request.tenantId),
        safePart(request.talkId),
        `${safePart(request.recordingId)}.ogg`,
      ].join("/");
      const started=await input.egress.start({roomName:request.talkId,objectKey});
      try{
        await input.media.createStarted({
          tenantId:request.tenantId,talkId:request.talkId,recordingId:request.recordingId,
          egressId:started.egressId,objectKey,startedAt:request.startedAt,
        });
      }catch(error){
        try{await input.egress.stop(started.egressId);}catch{}
        throw error;
      }
    },

    async finalize(request){
      const media=await input.media.currentForTalk({
        tenantId:request.tenantId,talkId:request.talkId,
      });
      if(!media){
        await input.replay.finalizeFromLive(request);
        return;
      }
      if(media.status==="ready"){
        await input.replay.finalizeFromLive(request);
        return;
      }

      try{await input.egress.stop(media.egressId);}catch{}
      const checksum=await input.objects.checksumSha256(media.objectKey);
      const segmentId=`egress_${safePart(media.egressId)}`;
      const appended=await input.replay.appendSegment({
        tenantId:request.tenantId,
        talkId:request.talkId,
        segmentId,
        startedAt:media.startedAt,
        endedAt:request.now,
        mediaRef:`s3:${media.objectKey}`,
        checksumSha256:checksum,
        now:request.now,
      });
      if(!appended) throw new Error("talks.replay.not_found");
      const finalized=await input.replay.finalizeFromLive(request);
      if(!finalized) throw new Error("talks.replay.not_found");
      await input.media.markReady({
        tenantId:request.tenantId,talkId:request.talkId,recordingId:media.recordingId,
        checksumSha256:checksum,completedAt:request.now,
      });
    },

    async playback(request){
      const object=await input.media.playbackObject(request);
      if(!object) return null;
      const signed=await input.objects.presignGet(object.objectKey,input.playbackTtlSeconds);
      return Object.freeze({
        url:signed.url,
        expiresAt:signed.expiresAt,
        contentType:"audio/ogg",
      });
    },
  });
}

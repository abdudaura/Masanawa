import { randomUUID } from "node:crypto";
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
  abort(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;now?:string;
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
  return Object.freeze<TalkReplayCoordinator>({
    async start(request){
      const existing=await input.media.current({
        tenantId:request.tenantId,talkId:request.talkId,recordingId:request.recordingId,
      });
      if(existing) return;
      // External StartEgress precedes the PostgreSQL identity claim. Two
      // Gateways can both see no row and start concurrently. Give each
      // attempt a distinct object so a losing claim never deletes or
      // overwrites the winning recording during compensating cleanup.
      // The winning attempt's exact key is persisted by createStarted.
      const objectKey=[
        "talk-replays",
        safePart(request.tenantId),
        safePart(request.talkId),
        `${safePart(request.recordingId)}_${randomUUID()}.ogg`,
      ].join("/");
      const started=await input.egress.start({roomName:request.talkId,objectKey});
      try{
        await input.media.createStarted({
          tenantId:request.tenantId,talkId:request.talkId,recordingId:request.recordingId,
          egressId:started.egressId,objectKey,startedAt:request.startedAt,
        });
      }catch(error){
        // Egress may still be actively writing this unique object. Deleting
        // while StopEgress failed could race a live writer and leave an
        // untracked upload after deletion. Treat this as an operator-visible
        // compensation failure; never issue S3 DELETE without a confirmed
        // stop. Keep the original SQL error as part of the cause chain.
        try{
          await input.egress.stop(started.egressId);
        }catch(stopError){
          throw new AggregateError(
            [error,stopError],"talks.replay.egress_compensation_stop_uncertain",
          );
        }
        try{
          await input.objects.deleteObject(objectKey);
        }catch(deleteError){
          throw new AggregateError(
            [error,deleteError],"talks.replay.egress_compensation_delete_failed",
          );
        }
        throw error;
      }
    },

    async abort(request){
      const media=await input.media.current(request);
      if(!media) return;
      if(media.status==="recording"){
        await input.egress.stop(media.egressId);
      }
      // Revoke authoritative playback access before attempting external
      // object deletion. A failed delete must never leave a ready/recording
      // database row capable of serving a signed replay URL. Retrying abort
      // reattempts deletion for an already-aborted job without re-stopping it.
      await input.media.markAborted({
        tenantId:request.tenantId,talkId:request.talkId,recordingId:request.recordingId,
        completedAt:request.now??new Date().toISOString(),
      });
      await input.objects.deleteObject(media.objectKey);
    },

    async finalize(request){
      const media=await input.media.currentForTalk({
        tenantId:request.tenantId,talkId:request.talkId,
      });
      if(!media){
        await input.replay.finalizeFromLive(request);
        return;
      }
      if(media.status==="aborted"){
        // An aborted object must never publish a surviving replay segment,
        // including after a concurrent Host discard.
        return;
      }
      if(media.status==="ready"){
        // A crash after media.markReady but before replay publication resumes
        // only the canonical live-finalization transaction.
        await input.replay.finalizeFromLive(request);
        return;
      }

      let stoppedMedia=media;
      if(media.status==="recording"){
        await input.egress.stop(stoppedMedia.egressId);
        await input.media.markStopped({
          tenantId:request.tenantId,talkId:request.talkId,recordingId:stoppedMedia.recordingId,
          completedAt:request.now,
        });
        stoppedMedia=Object.freeze({...media,status:"stopped" as const,completedAt:request.now});
      }
      // Stop time is part of the durable media custody record. A retry may
      // occur minutes or hours later and must not inflate the audio duration.
      const stoppedAt=stoppedMedia.completedAt;
      const startMs=Date.parse(stoppedMedia.startedAt);
      const stopMs=stoppedAt===null?NaN:Date.parse(stoppedAt);
      if(!Number.isFinite(startMs)||!Number.isFinite(stopMs)||stopMs<=startMs){
        throw new Error("talks.replay.media_stop_timestamp_invalid");
      }
      const checksum=await input.objects.checksumSha256(stoppedMedia.objectKey);
      const segmentId=`egress_${safePart(stoppedMedia.egressId)}`;
      const appended=await input.replay.appendSegment({
        tenantId:request.tenantId,
        talkId:request.talkId,
        segmentId,
        startedAt:stoppedMedia.startedAt,
        endedAt:stoppedAt!,
        mediaRef:`s3:${stoppedMedia.objectKey}`,
        checksumSha256:checksum,
        now:request.now,
      });
      if(!appended) throw new Error("talks.replay.not_found");
      // Authoritative media readiness precedes replay publication. After a
      // crash in between, status=ready resumes finalizeFromLive on retry.
      // A concurrent abort cannot be resurrected by markReady.
      await input.media.markReady({
        tenantId:request.tenantId,talkId:request.talkId,recordingId:stoppedMedia.recordingId,
        checksumSha256:checksum,completedAt:stoppedAt!,
      });
      const finalized=await input.replay.finalizeFromLive(request);
      if(!finalized) throw new Error("talks.replay.not_found");
    },

    async playback(request){
      const object=await input.media.playbackObject(request);
      if(!object) return null;
      const signed=await input.objects.presignGet(object.objectKey,input.playbackTtlSeconds);
      // Signing is asynchronous: unpublish, discard, moderator restriction or
      // account revocation may have happened since playbackObject was read.
      // Never disclose a newly signed private URL without fresh DB authority.
      // Require the same media object to avoid returning a stale recording if
      // the Talk was superseded while the provider request was in flight.
      const current=await input.media.playbackObject(request);
      if(!current || current.objectKey!==object.objectKey) return null;
      return Object.freeze({
        url:signed.url,
        expiresAt:signed.expiresAt,
        contentType:"audio/ogg",
      });
    },
  });
}

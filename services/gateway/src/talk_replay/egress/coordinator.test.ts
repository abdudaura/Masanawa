import { describe,expect,it } from "vitest";
import type { TalkReplayRepository } from "../model.js";
import { createTalkReplayCoordinator } from "./coordinator.js";
import type { ReplayMediaRepository } from "./postgres_media_repository.js";

function replayRepository(log:string[]):TalkReplayRepository{
  return {
    async start(){throw new Error("unused");},
    async hostView(){return null;},
    async hostAction(){return null;},
    async appendSegment(input){
      log.push(`segment:${input.segmentId}:${input.checksumSha256}`);
      return {
        talkId:input.talkId,recordingId:"recording_1",recordingState:"recording",
        publicationState:"not_ready",publicationPreference:"publish",
        segmentCount:1,durationSeconds:10,revision:2,isPublic:false,startedAt:input.startedAt,
      };
    },
    async finalizeFromLive(input){
      log.push(`finalize:${input.reason}`);
      return {
        talkId:input.talkId,recordingId:"recording_1",recordingState:"finalized",
        publicationState:"published",publicationPreference:"publish",
        segmentCount:1,durationSeconds:10,revision:3,isPublic:true,
        startedAt:"2026-10-07T10:00:00.000Z",finalizedAt:input.now,publishedAt:input.now,
      };
    },
    async platformBlock(){return null;},
    async myTalks(){return {live:[],replays:[]};},
  };
}

describe("Talk replay Egress coordinator",()=>{
  it("stops LiveKit if media-job persistence fails after egress starts",async()=>{
    const stopped:string[]=[];
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){return null;},
      async createStarted(){throw new Error("db down");},
      async markStopped(){},
      async markReady(){},
      async markAborted(){},
      async playbackObject(){return null;},
    };
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository([]),
      media,
      egress:{
        async start(){return {egressId:"EG_1"};},
        async stop(id){stopped.push(id);},
      },
      objects:{
        async checksumSha256(){return "a".repeat(64);},
        async deleteObject(){},
        async presignGet(){return {url:"https://signed",expiresAt:"2026-10-07T10:05:00.000Z"};},
      },
      playbackTtlSeconds:300,
    });
    await expect(coordinator.start({
      tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",startedAt:"2026-10-07T10:00:00.000Z",
    })).rejects.toThrow("db down");
    expect(stopped).toEqual(["EG_1"]);
  });

  it("finalizes from an already-stopped egress when the private object exists",async()=>{
    const log:string[]=[];
    let ready=false;
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){
        return {
          tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
          egressId:"EG_1",objectKey:"talk-replays/talk_1/recording_1.ogg",
          status:"stopped",startedAt:"2026-10-07T10:00:00.000Z",completedAt:"2026-10-07T10:00:10.000Z",checksumSha256:null,
        };
      },
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("should not restop");},
      async markReady(){ready=true;},
      async markAborted(){},
      async playbackObject(){return null;},
    };
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository(log),
      media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("should not stop again");},
      },
      objects:{
        async checksumSha256(){return "b".repeat(64);},
        async deleteObject(){},
        async presignGet(){return {url:"https://signed",expiresAt:"2026-10-07T10:05:00.000Z"};},
      },
      playbackTtlSeconds:300,
    });
    await coordinator.finalize({
      tenantId:"tenant_1",talkId:"talk_1",reason:"host_ended",now:"2026-10-07T10:00:10.000Z",
    });
    expect(log).toEqual([
      `segment:egress_EG_1:${"b".repeat(64)}`,
      "finalize:host_ended",
    ]);
    expect(ready).toBe(true);
  });
  it("uses persisted stop time on retry and marks media ready before publishing replay",async()=>{
    const log:string[]=[];
    const stopTime="2026-10-07T10:00:10.000Z";
    const base=replayRepository(log);
    let segmentEnd:string|null=null;
    const replay:TalkReplayRepository={
      ...base,
      async appendSegment(request){
        segmentEnd=request.endedAt;
        return base.appendSegment(request);
      },
    };
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/test.ogg",
        status:"stopped" as const,startedAt:"2026-10-07T10:00:00.000Z",
        completedAt:stopTime,checksumSha256:null,
      };},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("egress already stopped");},
      async markReady(request){
        expect(request.completedAt).toBe(stopTime);
        log.push("ready");
      },
      async markAborted(){throw new Error("unused");},
      async playbackObject(){return null;},
    };
    const coordinator=createTalkReplayCoordinator({
      replay,media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("must not restop");},
      },
      objects:{
        async checksumSha256(){return "f".repeat(64);},
        async deleteObject(){throw new Error("unused");},
        async presignGet(){return {url:"https://signed",expiresAt:stopTime};},
      },
      playbackTtlSeconds:300,
    });
    await coordinator.finalize({
      tenantId:"tenant_1",talkId:"talk_1",
      reason:"host_ended",now:"2026-10-07T11:30:00.000Z",
    });
    expect(segmentEnd).toBe(stopTime);
    expect(log).toEqual([
      `segment:egress_EG_1:${"f".repeat(64)}`, "ready", "finalize:host_ended",
    ]);
  });

  it("recovers ready media after publication transaction fails without hashing twice",async()=>{
    let status:"stopped"|"ready"="stopped";
    let checksums=0, appends=0, finals=0;
    const base=replayRepository([]);
    const replay:TalkReplayRepository={
      ...base,
      async appendSegment(request){appends++; return base.appendSegment(request);},
      async finalizeFromLive(request){
        finals++;
        if(finals===1) throw new Error("database temporarily unavailable");
        return base.finalizeFromLive(request);
      },
    };
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/test.ogg",
        status,startedAt:"2026-10-07T10:00:00.000Z",
        completedAt:"2026-10-07T10:00:10.000Z",checksumSha256:status==="ready"?"f".repeat(64):null,
      };},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("must not stop twice");},
      async markReady(){status="ready";},
      async markAborted(){throw new Error("unused");},
      async playbackObject(){return null;},
    };
    const coordinator=createTalkReplayCoordinator({
      replay,media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("must not stop twice");},
      },
      objects:{
        async checksumSha256(){checksums++; return "f".repeat(64);},
        async deleteObject(){throw new Error("unused");},
        async presignGet(){return {url:"https://signed",expiresAt:"2026-10-07T10:05:00Z"};},
      },
      playbackTtlSeconds:300,
    });
    const input={
      tenantId:"tenant_1",talkId:"talk_1",reason:"host_ended" as const,
      now:"2026-10-07T10:00:11.000Z",
    };
    await expect(coordinator.finalize(input)).rejects.toThrow("database temporarily unavailable");
    expect(status).toBe("ready");
    await coordinator.finalize({...input,now:"2026-10-07T10:03:11.000Z"});
    expect({checksums,appends,finals}).toEqual({checksums:1,appends:1,finals:2});
  });

  it("does not publish discarded/aborted media even if replay state still exists",async()=>{
    const log:string[]=[];
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/deleted.ogg",
        status:"aborted" as const,startedAt:"2026-10-07T10:00:00.000Z",
        completedAt:"2026-10-07T10:00:10.000Z",checksumSha256:null,
      };},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("unused");},
      async markReady(){throw new Error("unused");},
      async markAborted(){throw new Error("unused");},
      async playbackObject(){return null;},
    };
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository(log),media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("unused");},
      },
      objects:{
        async checksumSha256(){throw new Error("must not use discarded object");},
        async deleteObject(){throw new Error("unused");},
        async presignGet(){throw new Error("unused");},
      },
      playbackTtlSeconds:300,
    });
    await coordinator.finalize({
      tenantId:"tenant_1",talkId:"talk_1",reason:"host_ended",
      now:"2026-10-07T10:00:11.000Z",
    });
    expect(log).toEqual([]);
  });

  it("fails closed rather than inventing a stop time for incomplete media custody",async()=>{
    const media:ReplayMediaRepository={
      async current(){return null;},
      async currentForTalk(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/incomplete.ogg",
        status:"stopped" as const,startedAt:"2026-10-07T10:00:00.000Z",
        completedAt:null,checksumSha256:null,
      };},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("unused");},
      async markReady(){throw new Error("unused");},
      async markAborted(){throw new Error("unused");},
      async playbackObject(){return null;},
    };
    const log:string[]=[];
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository(log),media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("unused");},
      },
      objects:{
        async checksumSha256(){throw new Error("should not checksum");},
        async deleteObject(){throw new Error("unused");},
        async presignGet(){throw new Error("unused");},
      },
      playbackTtlSeconds:300,
    });
    await expect(coordinator.finalize({
      tenantId:"tenant_1",talkId:"talk_1",reason:"host_ended",
      now:"2026-10-07T10:30:00.000Z",
    })).rejects.toThrow("talks.replay.media_stop_timestamp_invalid");
    expect(log).toHaveLength(0);
  });

  it("revokes playback before a failed deletion and retries orphan cleanup without re-stopping Egress",async()=>{
    const log:string[]=[];
    let status:"recording"|"aborted"="recording";
    let firstAbort:string|null=null;
    let deleteAttempts=0;
    const media:ReplayMediaRepository={
      async current(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/revoke.ogg",
        status,startedAt:"2026-10-07T10:00:00Z",
        completedAt:firstAbort,checksumSha256:null,
      };},
      async currentForTalk(){return null;},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("unused");},
      async markReady(){throw new Error("unused");},
      async markAborted(request){
        log.push("abort");
        if(status!=="aborted") firstAbort=request.completedAt;
        status="aborted";
      },
      async playbackObject(){
        log.push("playback");
        return status==="aborted"?null:{objectKey:"private/revoke.ogg"};
      },
    };
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository(log),media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){log.push("stop");},
      },
      objects:{
        async checksumSha256(){throw new Error("unused");},
        async deleteObject(){
          log.push("delete");
          if(++deleteAttempts===1) throw new Error("object store outage");
        },
        async presignGet(){throw new Error("must not sign aborted replay");},
      },
      playbackTtlSeconds:300,
    });
    const id={tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1"};
    await expect(coordinator.abort({...id,now:"2026-10-07T10:00:10Z"}))
      .rejects.toThrow("object store outage");
    expect(log).toEqual(["stop","abort","delete"]);
    expect(firstAbort).toBe("2026-10-07T10:00:10Z");
    expect(await coordinator.playback({...id,viewerUserId:"user_1"})).toBeNull();
    await coordinator.abort({...id,now:"2026-10-07T11:00:00Z"});
    expect(log).toEqual(["stop","abort","delete","playback","abort","delete"]);
    expect(firstAbort).toBe("2026-10-07T10:00:10Z");
    expect(deleteAttempts).toBe(2);
  });

  it("does not delete the media object if authoritative abort persistence fails",async()=>{
    const log:string[]=[];
    const media:ReplayMediaRepository={
      async current(){return {
        tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
        egressId:"EG_1",objectKey:"private/not-revoked.ogg",
        status:"ready" as const,startedAt:"2026-10-07T10:00:00Z",
        completedAt:"2026-10-07T10:00:10Z",checksumSha256:"a".repeat(64),
      };},
      async currentForTalk(){return null;},
      async createStarted(){throw new Error("unused");},
      async markStopped(){throw new Error("unused");},
      async markReady(){throw new Error("unused");},
      async markAborted(){log.push("abort");throw new Error("db unavailable");},
      async playbackObject(){return {objectKey:"private/not-revoked.ogg"};},
    };
    const coordinator=createTalkReplayCoordinator({
      replay:replayRepository(log),media,
      egress:{
        async start(){throw new Error("unused");},
        async stop(){throw new Error("unused");},
      },
      objects:{
        async checksumSha256(){throw new Error("unused");},
        async deleteObject(){log.push("delete");},
        async presignGet(){throw new Error("unused");},
      },
      playbackTtlSeconds:300,
    });
    await expect(coordinator.abort({
      tenantId:"tenant_1",talkId:"talk_1",recordingId:"recording_1",
    })).rejects.toThrow("db unavailable");
    expect(log).toEqual(["abort"]);
  });


  it.each(["revoked","replaced","lookup_failed","stable"] as const)(
    "rechecks private replay access after delayed signing (%s)",async(mode)=>{
      const viewer={tenantId:"tenant_1",talkId:"talk_1",viewerUserId:"user_1"};
      let reads=0;
      const media:ReplayMediaRepository={
        async current(){return null;},
        async currentForTalk(){return null;},
        async createStarted(){throw new Error("unused");},
        async markStopped(){throw new Error("unused");},
        async markReady(){throw new Error("unused");},
        async markAborted(){throw new Error("unused");},
        async playbackObject(request){
          expect(request).toEqual(viewer);
          reads++;
          if(reads===1) return {objectKey:"private/recording.ogg"};
          if(mode==="lookup_failed") throw new Error("database authorization unavailable");
          if(mode==="revoked") return null;
          return {objectKey:mode==="replaced"?"private/changed.ogg":"private/recording.ogg"};
        },
      };
      let notifySigning=()=>{};
      const signingStarted=new Promise<void>(resolve=>{notifySigning=()=>resolve();});
      let completeSigning:(value:{url:string;expiresAt:string})=>void=()=>{};
      const coordinator=createTalkReplayCoordinator({
        replay:replayRepository([]),media,
        egress:{
          async start(){throw new Error("unused");},
          async stop(){throw new Error("unused");},
        },
        objects:{
          async checksumSha256(){throw new Error("unused");},
          async deleteObject(){throw new Error("unused");},
          async presignGet(objectKey,ttl){
            expect(objectKey).toBe("private/recording.ogg");
            expect(ttl).toBe(300);
            return new Promise<{url:string;expiresAt:string}>(resolve=>{
              completeSigning=resolve;
              notifySigning();
            });
          },
        },
        playbackTtlSeconds:300,
      });
      const pending=coordinator.playback(viewer);
      await signingStarted; // S3 request is in flight; access may now be revoked.
      completeSigning({url:"https://private.example/signed",expiresAt:"2026-10-09T03:00:00Z"});
      if(mode==="lookup_failed"){
        await expect(pending).rejects.toThrow("database authorization unavailable");
      }else if(mode==="stable"){
        await expect(pending).resolves.toEqual({
          url:"https://private.example/signed",
          expiresAt:"2026-10-09T03:00:00Z",
          contentType:"audio/ogg",
        });
      }else{
        await expect(pending).resolves.toBeNull();
      }
      expect(reads).toBe(2);
    },
  );

});

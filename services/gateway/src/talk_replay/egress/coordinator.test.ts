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
});

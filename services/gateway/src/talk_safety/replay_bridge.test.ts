import { describe,expect,it } from "vitest";
import {
  createTalkReplaySession,
  type TalkReplaySession,
} from "@masanawa/agents";
import { toInstant } from "@masanawa/contracts";
import {
  createPostgresTalkSafetyReplayBridge,
  withReplayBlockSynchronization,
  type TalkSafetyReplaySqlPool,
} from "./replay_bridge.js";
import type { TalkSafetyService } from "./service.js";

function replay():TalkReplaySession{
  return createTalkReplaySession({
    tenantId:"tenant_1" as never,
    talkId:"talk_1" as never,
    recordingId:"recording_1" as never,
    hostUserId:"host_1" as never,
    hostRecordingConsent:true,
    publicationPreference:"publish",
    startedAt:toInstant("2026-10-07T10:00:00.000Z"),
    it("synchronizes only successful blocked replay enforcement",async()=>{
    const calls:string[]=[];
    const enforcement={
      schemaVersion:1 as const,
      tenantId:"tenant_1",
      target:{kind:"replay" as const,id:"recording_1"},
      revision:2,
      visibility:"blocked" as const,
      reasonCode:"policy",
      updatedAt:"2026-10-07T11:00:00.000Z",
    };
    const service={
      async setEnforcement(){
        calls.push("enforcement");
        return enforcement;
      },
    } as unknown as TalkSafetyService;
    const wrapped=withReplayBlockSynchronization(service,{
      async blockByRecording(input){
        calls.push(`replay:${input.recordingId}`);
        return true;
      },
    });

    await expect(wrapped.setEnforcement({
      authorizationHeader:"Bearer admin",
      targetKind:"replay",
      targetId:"recording_1",
      expectedRevision:1,
      visibility:"blocked",
      reasonCode:"policy",
    })).resolves.toEqual(enforcement);
    expect(calls).toEqual(["enforcement","replay:recording_1"]);
  });

  it("does not mutate replay state for restricted enforcement",async()=>{
    let replayCalls=0;
    const service={
      async setEnforcement(){
        return {
          schemaVersion:1 as const,
          tenantId:"tenant_1",
          target:{kind:"replay" as const,id:"recording_1"},
          revision:2,
          visibility:"restricted" as const,
          reasonCode:"review",
          updatedAt:"2026-10-07T11:00:00.000Z",
        };
      },
    } as unknown as TalkSafetyService;
    const wrapped=withReplayBlockSynchronization(service,{
      async blockByRecording(){
        replayCalls+=1;
        return true;
      },
    });
    await wrapped.setEnforcement({
      authorizationHeader:"Bearer admin",
      targetKind:"replay",
      targetId:"recording_1",
      expectedRevision:1,
      visibility:"restricted",
      reasonCode:"review",
    });
    expect(replayCalls).toBe(0);
  });
});
}

describe("Talk safety replay bridge",()=>{
  it("maps recording id enforcement into canonical replay platform_block",async()=>{
    let current=replay();
    const pool:TalkSafetyReplaySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        if(text.includes("SELECT talk_id,session_json")){
          return {
            rowCount:1,
            rows:[{talk_id:"talk_1",session_json:current}] as unknown as Row[],
          };
        }
        if(text.includes("UPDATE talks.replay_sessions")){
          expect(values?.[2]).toBe(1);
          const next=JSON.parse(String(values?.[7])) as TalkReplaySession;
          expect(next.publicationState).toBe("blocked");
          current=next;
          return {rowCount:1,rows:[] as unknown as Row[]};
        }
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };

    await expect(createPostgresTalkSafetyReplayBridge(pool).blockByRecording({
      tenantId:"tenant_1",
      recordingId:"recording_1",
      now:"2026-10-07T11:00:00.000Z",
    })).resolves.toBe(true);
    expect(current.publicationState).toBe("blocked");
    expect(current.revision).toBe(2);
  });

  it("is idempotent when canonical replay is already blocked",async()=>{
    const first=replay();
    let blocked=first;
    const transitionPool:TalkSafetyReplaySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        if(text.includes("SELECT talk_id,session_json")){
          return {rowCount:1,rows:[{talk_id:"talk_1",session_json:blocked}] as unknown as Row[]};
        }
        const next=JSON.parse(String(values?.[7])) as TalkReplaySession;
        blocked=next;
        return {rowCount:1,rows:[] as unknown as Row[]};
      },
    };
    const bridge=createPostgresTalkSafetyReplayBridge(transitionPool);
    await bridge.blockByRecording({tenantId:"tenant_1",recordingId:"recording_1",now:"2026-10-07T11:00:00.000Z"});
    await expect(bridge.blockByRecording({
      tenantId:"tenant_1",recordingId:"recording_1",now:"2026-10-07T11:01:00.000Z",
    })).resolves.toBe(true);
  });

  it("returns false for an enforcement target with no replay row",async()=>{
    const pool:TalkSafetyReplaySqlPool={
      async query<Row>(){return {rowCount:0,rows:[] as unknown as Row[]};},
    };
    await expect(createPostgresTalkSafetyReplayBridge(pool).blockByRecording({
      tenantId:"tenant_1",recordingId:"missing",now:"2026-10-07T11:00:00.000Z",
    })).resolves.toBe(false);
  });
});

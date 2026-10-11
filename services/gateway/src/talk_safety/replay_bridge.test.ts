import { describe,expect,it } from "vitest";
import {
  createTalkReplaySession,
  transitionTalkReplaySession,
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
  const recording = createTalkReplaySession({
    tenantId:"tenant_1" as never,
    talkId:"talk_1" as never,
    recordingId:"recording_1" as never,
    hostUserId:"host_1" as never,
    hostRecordingConsent:true,
    publicationPreference:"publish",
    startedAt:toInstant("2026-10-07T10:00:00.000Z"),
  });
  return transitionTalkReplaySession(recording, {
    type: "live_finalized", expectedRevision: recording.revision, reason: "host_ended",
  }, toInstant("2026-10-07T10:30:00.000Z")).session;
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
          expect(values?.[2]).toBe(2);
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
    expect(current.revision).toBe(3);
  });

  it("is idempotent when canonical replay is already blocked",async()=>{
    let current=replay();
    let updates=0;
    const pool:TalkSafetyReplaySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        if(text.includes("SELECT talk_id,session_json")){
          return {
            rowCount:1,
            rows:[{talk_id:"talk_1",session_json:current}] as unknown as Row[],
          };
        }
        if(text.includes("UPDATE talks.replay_sessions")){
          updates+=1;
          current=JSON.parse(String(values?.[7])) as TalkReplaySession;
          return {rowCount:1,rows:[] as unknown as Row[]};
        }
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    const bridge=createPostgresTalkSafetyReplayBridge(pool);
    await bridge.blockByRecording({
      tenantId:"tenant_1",recordingId:"recording_1",now:"2026-10-07T11:00:00.000Z",
    });
    await expect(bridge.blockByRecording({
      tenantId:"tenant_1",recordingId:"recording_1",now:"2026-10-07T11:01:00.000Z",
    })).resolves.toBe(true);
    expect(updates).toBe(1);
  });

  it("returns false for an enforcement target with no replay row",async()=>{
    const pool:TalkSafetyReplaySqlPool={
      async query<Row>(){return {rowCount:0,rows:[] as unknown as Row[]};},
    };
    await expect(createPostgresTalkSafetyReplayBridge(pool).blockByRecording({
      tenantId:"tenant_1",recordingId:"missing",now:"2026-10-07T11:00:00.000Z",
    })).resolves.toBe(false);
  });

  it("retries a replay CAS conflict against the latest canonical state",async()=>{
    let current=replay();
    let updateAttempts=0;
    const pool:TalkSafetyReplaySqlPool={
      async query<Row>(text:string,values?:unknown[]){
        if(text.includes("SELECT talk_id,session_json")){
          return {
            rowCount:1,
            rows:[{talk_id:"talk_1",session_json:current}] as unknown as Row[],
          };
        }
        if(text.includes("UPDATE talks.replay_sessions")){
          updateAttempts+=1;
          if(updateAttempts===1){
            current={...current,revision:current.revision + 1} as TalkReplaySession;
            return {rowCount:0,rows:[] as unknown as Row[]};
          }
          current=JSON.parse(String(values?.[7])) as TalkReplaySession;
          return {rowCount:1,rows:[] as unknown as Row[]};
        }
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };
    await expect(createPostgresTalkSafetyReplayBridge(pool).blockByRecording({
      tenantId:"tenant_1",recordingId:"recording_1",now:"2026-10-07T11:00:00.000Z",
    })).resolves.toBe(true);
    expect(updateAttempts).toBe(2);
    expect(current.publicationState).toBe("blocked");
  });
});

describe("Talk safety replay enforcement composition",()=>{
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

import { describe,expect,it } from "vitest";
import {
  createTalkReplaySession,
  type TalkReplaySession,
} from "@masanawa/agents";
import { toInstant } from "@masanawa/contracts";
import {
  createPostgresTalkReplayRepository,
  type TalkReplaySqlPool,
} from "./postgres_repository.js";

function activeReplay():TalkReplaySession{
  return createTalkReplaySession({
    tenantId:"tenant_1" as never,
    talkId:"talk_1" as never,
    recordingId:"recording_1" as never,
    hostUserId:"user_host" as never,
    hostRecordingConsent:true,
    publicationPreference:"publish",
    startedAt:toInstant("2026-10-07T10:00:00.000Z"),
  });
}

describe("Postgres Talk replay repository",()=>{
  it("stores segment metadata and replay revision in one CTE",async()=>{
    const replay=activeReplay();
    const calls:Array<{text:string;values?:unknown[] | undefined}>=[];

    const pool:TalkReplaySqlPool={
      async query<Row>(text:string,values?:unknown[] | undefined){
        calls.push({text,...(values===undefined?{}:{values})});
        if(text.includes("SELECT session_json FROM talks.replay_sessions")){
          return {rowCount:1,rows:[{session_json:replay}] as unknown as Row[]};
        }
        if(text.includes("WITH replay AS") && text.includes("talks.replay_segments")){
          return {rowCount:1,rows:[{applied:true}] as unknown as Row[]};
        }
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };

    const result=await createPostgresTalkReplayRepository(pool).appendSegment({
      tenantId:"tenant_1",
      talkId:"talk_1",
      segmentId:"segment_1",
      startedAt:"2026-10-07T10:00:00.000Z",
      endedAt:"2026-10-07T10:00:05.000Z",
      mediaRef:"opaque:segment/1",
      checksumSha256:"a".repeat(64),
      now:"2026-10-07T10:00:05.000Z",
    });

    expect(result).toMatchObject({segmentCount:1,revision:2,durationSeconds:5});
    const mutation=calls.find(call=>call.text.includes("WITH replay AS"));
    expect(mutation?.text).toContain("UPDATE talks.replay_sessions");
    expect(mutation?.text).toContain("INSERT INTO talks.replay_segments");
    expect(mutation?.values?.[2]).toBe(1);
    expect(mutation?.values?.[3]).toBe(2);
  });

  it("lists finalized private replay for its Host library without making it public",async()=>{
    const pool:TalkReplaySqlPool={
      async query<Row>(text:string,values?:unknown[] | undefined){
        if(text.includes("FROM talks.talks t") && text.includes("host_user_id=$2")){
          expect(values?.[0]).toBe("tenant_1");
          expect(values?.[1]).toBe("user_host");
          return {
            rowCount:1,
            rows:[{
              tenant_id:"tenant_1",talk_id:"talk_1",host_user_id:"user_host",host_name:"Host",
              title:"Private replay",topic:"Topic",summary:"",state:"ended",
              listener_count:2,duration_seconds:5,
              created_at:"2026-10-07T10:00:00.000Z",updated_at:"2026-10-07T10:00:05.000Z",
              comment_count:0,
            }] as unknown as Row[],
          };
        }
        return {rowCount:0,rows:[] as unknown as Row[]};
      },
    };

    const result=await createPostgresTalkReplayRepository(pool).myTalks({
      tenantId:"tenant_1",hostUserId:"user_host",limit:60,
    });
    expect(result.live).toHaveLength(0);
    expect(result.replays).toHaveLength(1);
    expect(result.replays[0]?.id).toBe("talk_1");
  });
});


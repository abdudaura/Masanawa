import { describe,expect,it } from "vitest";
import { runMissionPublicationOnce } from "./publisher.js";
import type { LeasedMissionPost, MissionPublishQueue, MissionSqlPool } from "./publisher.js";
const post:LeasedMissionPost={tenantId:"t",missionId:"m",slotId:"s",characterId:"c",
  publicationKey:"stable-key",leaseToken:"lease-one",kind:"text",topic:"astronomy",
  draftBody:"A real reviewed draft.",estimatedCostMinor:"12",attempt:1};
describe("J12 crash-replay publisher port",()=>{
  it("uses identical persisted publication key on retry, with one completion",async()=>{
    const keys:string[]=[];let completions=0;let attempts=0;
    const queue:MissionPublishQueue={lease:async()=>attempts++<2?post:null,eligible:async()=>true,
      complete:async()=>{completions++;return true;},failure:async()=>{}};
    const pub={publish:async({idempotencyKey}:{idempotencyKey:string})=>{
      keys.push(idempotencyKey);if(keys.length===1)throw new Error("uncertain");return {postId:"post_one"};}};
    const gate={enabled:async()=>true};
    expect(await runMissionPublicationOnce({queue,publisher:pub,gate})).toBe("retry");
    expect(await runMissionPublicationOnce({queue,publisher:pub,gate})).toBe("published");
    expect(keys).toEqual(["stable-key","stable-key"]);
    expect(completions).toBe(1);
  });
  it("rejects unapproved/paused and media without media source",async()=>{
    let emitted=0;const reasons:string[]=[];
    const queue:MissionPublishQueue={lease:async()=>({...post,kind:"image"}),eligible:async()=>true,
      complete:async()=>true,failure:async(_p,reason)=>{reasons.push(reason);}};
    const publisher={publish:async()=>{emitted++;return {postId:"p"};}};
    expect(await runMissionPublicationOnce({queue,publisher,gate:{enabled:async()=>true}})).toBe("denied");
    expect(await runMissionPublicationOnce({queue:{...queue,lease:async()=>post},
      publisher,gate:{enabled:async()=>false}})).toBe("denied");
    expect(emitted).toBe(0);expect(reasons).toEqual(["unsupported_media","not_eligible"]);
  });
});

describe("PostgreSQL exhausted lease recovery",()=>{
  it("reaps terminal expired leases and preserves the stable publication key",async()=>{
    const sql:string[]=[];
    const params:unknown[][]=[];
    const client={
      query:async(statement:string,args:unknown[] = [])=>{
        sql.push(statement);params.push(args);
        if(statement.includes("UPDATE masana.posting_slots s"))
          return {rows:[{tenant_id:"tenant_a",slot_id:"slot_1",attempt_count:6}],rowCount:1};
        if(statement.includes("SELECT s.*,m.autonomy_level"))
          return {rows:[],rowCount:0};
        return {rows:[],rowCount:0};
      },
      release:()=>{}
    };
    const pool={connect:async()=>client} as unknown as MissionSqlPool;
    const {PostgresMissionPublishQueue}=await import("./publisher.js");
    expect(await new PostgresMissionPublishQueue(pool).lease()).toBeNull();
    expect(sql.some(statement=>statement.includes("lease_expired_exhausted"))).toBe(true);
    const runIndex=sql.findIndex(statement=>statement.includes("UPDATE masana.mission_runs"));
    expect(runIndex).toBeGreaterThan(-1);
    expect(params[runIndex]).toEqual(["tenant_a","slot_1",6]);
    expect(sql.some(statement=>statement.includes("publication_key="))).toBe(false);
    expect(sql[sql.length-1]).toBe("COMMIT");
  });
});

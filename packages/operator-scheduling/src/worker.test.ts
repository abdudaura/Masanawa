import {describe,it,expect} from "vitest";
import {createScheduleWorker} from "./worker.js";
import type {Occurrence, ScheduleRepository} from "./repository.js";
import type {ScheduleRecord} from "./domain.js";

const occurrence:Occurrence={
  occurrenceId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  scheduleId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  tenantId:"tenant_a",userId:"user_a",
  sequence:1,scheduleRevision:1,
  scheduledFor:"2026-10-08T11:59:00.000Z",
  leaseToken:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};
const record:ScheduleRecord={
  id:occurrence.scheduleId,kind:"talk_reminder",referenceId:"talk_12345",
  frequency:"daily",timezone:"Africa/Lagos",localTime:"13:00",
  quietStart:"22:00",quietEnd:"07:00",optedIn:true,
  state:"active",revision:1,nextDueAt:"2026-10-09T12:00:00Z",
};
const now=new Date("2026-10-08T12:00:00.000Z");
function fixture(overrides:Partial<ScheduleRecord>={}) {
  let claimed=false,started=false,skipped=0;
  const finals:string[]=[];
  const r={
    expireUnknown:async()=>0,
    reclaimExpired:async()=>[],
    claimDue:async()=>{
      if(claimed) return [];
      claimed=true;
      return [occurrence];
    },
    readForDispatch:async()=>({...record,...overrides}),
    markStarted:async()=>{
      if(started)return false;
      started=true;
      return true;
    },
    markSkipped:async()=>{skipped++;},
    finish:async(_o:Occurrence,state:string)=>{finals.push(state);},
  } as unknown as ScheduleRepository;
  return {repository:r,finals,get skipped(){return skipped;}};
}
describe("U25 claim/send fence",()=>{
  it("fails closed with no configured real notification provider",async()=>{
    const f=fixture();
    await expect(createScheduleWorker({repository:f.repository}).tick({now}))
      .rejects.toThrow("schedule.push_unconfigured");
  });
  it("sends an occurrence once even with two worker ticks",async()=>{
    const f=fixture();
    let sends=0;
    const sender={async send(){
      sends++;return {attempted:1,delivered:1};
    }};
    const w=createScheduleWorker({repository:f.repository,sender});
    expect((await w.tick({now})).delivered).toBe(1);
    await w.tick({now});
    expect(sends).toBe(1);
    expect(f.finals).toEqual(["sent"]);
  });
  it("classifies exception and partial push as uncertain, no blind retry",async()=>{
    const f=fixture();
    let count=0;
    const w=createScheduleWorker({repository:f.repository,sender:{
      async send(){count++;throw new Error("provider timed out");}
    }});
    expect((await w.tick({now})).uncertain).toBe(1);
    await w.tick({now});
    expect(count).toBe(1);
    expect(f.finals).toEqual(["uncertain"]);
  });
  it("skips quiet-hour attempts without contacting provider",async()=>{
    const f=fixture({quietStart:"12:00",quietEnd:"20:00"});
    let sent=0;
    const w=createScheduleWorker({repository:f.repository,sender:{
      async send(){sent++;return {attempted:1,delivered:1};}
    }});
    expect((await w.tick({now})).skipped).toBe(1);
    expect(sent).toBe(0);
  });
  it("never advances a new due schedule when all slots were reclaimed",async()=>{
    let dueClaims=0;
    const fixture={
      expireUnknown:async()=>0,
      reclaimExpired:async()=>[occurrence],
      claimDue:async()=>{dueClaims++;return [occurrence];},
      readForDispatch:async()=>record,
      markStarted:async()=>true,
      finish:async()=>undefined,
      markSkipped:async()=>undefined,
    } as unknown as ScheduleRepository;
    const worker=createScheduleWorker({repository:fixture,sender:{
      async send(){return {attempted:0,delivered:0};}
    }});
    // The repository fixture throws if a new due record is claimed.
    const result=await worker.tick({now,limit:1});
    expect(result.claimed).toBe(1);
    expect(dueClaims).toBe(0);
  });
  it("rejects invalid limits before claiming a batch",async()=>{
    const f=fixture();
    await expect(createScheduleWorker({repository:f.repository,sender:{
      async send(){return {attempted:0,delivered:0};},
    }}).tick({now,limit:100})).rejects.toThrow(RangeError);
  });
});


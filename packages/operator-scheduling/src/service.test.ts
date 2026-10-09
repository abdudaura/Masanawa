import { describe, expect, it } from "vitest";
import { createScheduleService } from "./service.js";
import { ScheduleError, type ScheduleRecord } from "./domain.js";
import type { Actor, ScheduleRepository } from "./repository.js";

const actor: Actor={tenantId:"tenant_a",userId:"user_a"};
const spec={kind:"talk_reminder",referenceId:"talk_123456",frequency:"daily",
  timezone:"Africa/Lagos",localTime:"16:00",quietStart:"22:00",
  quietEnd:"07:00",optedIn:true};
const requestId="12345678-1234-4123-8123-123456789abc";
function fixture() {
  let stored: ScheduleRecord|undefined;
  let fp: string|undefined;
  let referenceChecks=0;
  const repo={
    create: async (c: any) => {
      if (stored) {
        if (c.fingerprint !== fp) throw new ScheduleError("schedule.idempotency_conflict",409);
        return stored;
      }
      fp=c.fingerprint;
      stored={...c.spec,id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        state:"active",revision:1,nextDueAt:c.dueAt};
      return stored!;
    },
    list:async (a:Actor) => a.userId===actor.userId&&stored?[stored]:[],
    read:async (a:Actor) => a.userId===actor.userId?stored??null:null,
    change:async (a:Actor,_id:string,revision:number,state:any,due:string|null) => {
      if (!stored || revision!==stored.revision || a.userId!==actor.userId)
        throw new ScheduleError("schedule.revision_conflict_or_missing",409);
      stored={...stored,state,revision:revision+1,nextDueAt:due};
      return stored;
    },
  } as unknown as ScheduleRepository;
  const service=createScheduleService({
    repository:repo,
    customers:{async authorize({authorizationHeader}) {
      if (authorizationHeader!=="Bearer signed-in")
        throw Object.assign(new Error("unauthorized"),{statusCode:401});
      return actor;
    }},
    references:{async canSchedule(a,s) {
      referenceChecks++;
      return a.userId===actor.userId && s.referenceId.startsWith("talk_");
    }},
    clock:()=>new Date("2026-10-08T12:00:00Z"),
  });
  return {service,get referenceChecks(){return referenceChecks;}};
}
describe("U25 authenticated owner-only scheduling",()=>{
  it("rejects anonymous before disclosing validation or target details",async()=>{
    const {service}=fixture();
    await expect(service.create({authorizationHeader:undefined,
      requestId:"broken",spec:{}})).rejects.toMatchObject({statusCode:401});
  });
  it("does not create for a nonexistent or unauthorized target",async()=>{
    const {service}=fixture();
    await expect(service.create({authorizationHeader:"Bearer signed-in",
      requestId,spec:{...spec,referenceId:"lesson_hidden"}}))
      .rejects.toMatchObject({statusCode:404,code:"schedule.reference_not_available"});
  });
  it("idempotent replay; conflicting payload cannot silently alter a schedule",async()=>{
    const {service}=fixture();
    const input={authorizationHeader:"Bearer signed-in",requestId,spec};
    const first=await service.create(input);
    expect(await service.create(input)).toEqual(first);
    await expect(service.create({...input,spec:{...spec,localTime:"17:00"}}))
      .rejects.toMatchObject({statusCode:409});
    expect(await service.list("Bearer signed-in")).toHaveLength(1);
  });
  it("pause/resume uses revision CAS; cancel is irrevocable",async()=>{
    const {service}=fixture();
    const entry=await service.create({authorizationHeader:"Bearer signed-in",requestId,spec});
    const paused=await service.change({authorizationHeader:"Bearer signed-in",
      scheduleId:entry.id,revision:1,action:"pause"});
    expect(paused.nextDueAt).toBeNull();
    await expect(service.change({authorizationHeader:"Bearer signed-in",
      scheduleId:entry.id,revision:1,action:"resume"}))
      .rejects.toMatchObject({statusCode:409});
    const resumed=await service.change({authorizationHeader:"Bearer signed-in",
      scheduleId:entry.id,revision:2,action:"resume"});
    expect(resumed.nextDueAt).toBeTruthy();
    await service.change({authorizationHeader:"Bearer signed-in",
      scheduleId:entry.id,revision:3,action:"cancel"});
    await expect(service.change({authorizationHeader:"Bearer signed-in",
      scheduleId:entry.id,revision:4,action:"resume"}))
      .rejects.toMatchObject({statusCode:404});
  });
});


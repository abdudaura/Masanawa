import { describe,expect,it } from "vitest";
import { mayScheduleExternalVideoImport, scheduleAuthorizedVideoImports, type SourceEligibility } from "./eligibility.js";
const youtube: SourceEligibility = {provider:"youtube",mode:"auto",enabled:true,authorizationStatus:"verified",providerCapability:"youtube_websub"};
describe("provider capability gate",()=>{
  it("rejects manual, expired, revoked and mismatched auto connectors",()=>{
    for (const source of [
      {...youtube,mode:"manual" as const}, {...youtube,enabled:false},
      {...youtube,authorizationStatus:"expired" as const},
      {...youtube,provider:"facebook" as const},
      {...youtube,providerCapability:null},
    ])expect(mayScheduleExternalVideoImport(source)).toBe(false);
  });
  it("schedules only authorized automatic sources", async()=>{
    const queued:SourceEligibility[]=[];
    const scheduler={eligibleSources:async()=>[youtube,{...youtube,mode:"manual" as const}],scheduleAuthorized:async(x:SourceEligibility)=>{queued.push(x);}};
    expect(await scheduleAuthorizedVideoImports(scheduler,true)).toBe(0);
    expect(await scheduleAuthorizedVideoImports(scheduler,false)).toBe(1);
    expect(queued).toEqual([youtube]);
  });
});

import {describe,it,expect} from "vitest";
import {validateSpec,nextOccurrence,isQuiet,ScheduleError,timezoneParts,publicNotification} from "./domain.js";
const now=Date.parse("2026-10-08T12:00:00.000Z");
const daily={
  kind:"lesson_followup",referenceId:"lesson_12345",frequency:"daily",
  timezone:"Africa/Lagos",localTime:"15:45",
  quietStart:"22:00",quietEnd:"07:00",optedIn:true,
};
describe("U25 civil scheduling and privacy",()=>{
  it("rejects unilateral automation, extra fields, unsafe actions and times",()=>{
    for(const p of [
      {...daily,optedIn:false},{...daily,kind:"crypto_transfer"},
      {...daily,secret:"stored"},{...daily,localTime:"24:61"},
      {...daily,localTime:"23:00"},{...daily,timezone:"Invalid/Location"},
      {...daily,referenceId:"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"},
    ]) expect(()=>validateSpec(p,now)).toThrow(ScheduleError);
  });
  it("calculates Lagos daily occurrence in UTC",()=>{
    expect(nextOccurrence(validateSpec(daily,now),now))
      .toBe("2026-10-08T14:45:00.000Z");
  });
  it("handles overnight quiet window and local weekdays",()=>{
    expect(isQuiet("02:00","22:00","07:00")).toBe(true);
    expect(isQuiet("12:00","22:00","07:00")).toBe(false);
    expect(timezoneParts(now,"Africa/Lagos").dayOfWeek).toBe(4);
  });
  it("skips spring-forward nonexistent local 02:30",()=>{
    const spec=validateSpec({...daily,timezone:"Europe/Berlin",localTime:"02:30",quietStart:"14:00",quietEnd:"15:00"},now);
    const next=nextOccurrence(spec,Date.parse("2027-03-28T00:31:00Z"));
    expect(next).toBe("2027-03-29T00:30:00.000Z");
  });
  it("chooses only one minute in the fallback ambiguous hour",()=>{
    const spec=validateSpec({...daily,timezone:"Europe/Berlin",localTime:"02:30",quietStart:"14:00",quietEnd:"15:00"},now);
    const first=nextOccurrence(spec,Date.parse("2027-10-31T00:00:00Z"));
    expect(first).toBe("2027-10-31T00:30:00.000Z");
    const following = nextOccurrence(spec,Date.parse(first!),"2027-10-31");
    expect(following).toBe("2027-11-01T01:30:00.000Z");
  });
  it("rejects one-off schedule with wrong syntax or historical time",()=>{
    const once={...daily,frequency:"once",runAt:"2026-10-08T14:30:00Z"};
    const {localTime:_,...valid}=once;
    expect(validateSpec(valid,now).frequency).toBe("once");
    expect(()=>validateSpec({...valid,runAt:"2026-10-07T14:30:00Z"},now)).toThrow();
  });
  it("generates only generic notification copy, not reference data",()=>{
    expect(publicNotification("artifact_ready").body).not.toContain("artifact_abc");
  });
});


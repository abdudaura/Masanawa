import { describe, expect, it } from "vitest";
import { checkedRevision, mayAutoPublish, minorUnits, requireEditor, requireOps, validateMission, validateSlot } from "./index.js";
const plan = { characterId:"masana_professional_1", weekStart:"2026-10-12",
  objective:"Teach astronomy every morning", topicFocus:"Astronomy",
  autonomyLevel:1, budgetMinor:"2000" };
const slot = { kind:"text", scheduledAt:"2026-10-12T12:30:00Z",
  timeZone:"Africa/Lagos", topic:"Planetary orbits", draftBody:"Planets follow orbits.", estimatedCostMinor:"20" };
describe("L-MISSIONS J12 contract", () => {
  it("accepts dated Monday and exact integer budgets", () => {
    expect(validateMission(plan).weekStart).toBe("2026-10-12");
    expect(minorUnits("900719925474099")).toBe("900719925474099");
    expect(validateSlot(slot).timeZone).toBe("Africa/Lagos");
  });
  it("rejects unsafe budget, calendar, timezone, UTC, post kind and revision", () => {
    expect(() => minorUnits("1.5")).toThrow();
    expect(() => minorUnits("-1")).toThrow();
    expect(() => validateMission({...plan,weekStart:"2026-10-11"})).toThrow();
    expect(() => validateMission({...plan,autonomyLevel:4})).toThrow();
    expect(() => validateSlot({...slot,scheduledAt:"tomorrow"})).toThrow();
    expect(() => validateSlot({...slot,timeZone:"Mars/Phobos"})).toThrow();
    expect(() => validateSlot({...slot,kind:"video"})).toThrow();
    expect(() => checkedRevision(0)).toThrow();
  });
  it("restricts staff mutations to server-verified role", () => {
    expect(() => requireEditor({tenantId:"t",userId:"u",roles:["fan"]})).toThrow();
    expect(() => requireOps({tenantId:"t",userId:"u",roles:["content_editor"]})).toThrow();
  });
  it("never auto-publishes image, low score, early streak, over cap or disabled platform", () => {
    const input = { level:2 as const, kind:"text" as const, qualityScore:0.85,
      consecutiveApproved:20,publishedToday:1,paused:false,globalEnabled:true };
    expect(mayAutoPublish(input)).toBe(true);
    for (const variant of [
      {...input,kind:"image" as const}, {...input,qualityScore:0.84},
      {...input,consecutiveApproved:19}, {...input,publishedToday:2},
      {...input,paused:true}, {...input,globalEnabled:false},
    ]) expect(mayAutoPublish(variant)).toBe(false);
  });
});

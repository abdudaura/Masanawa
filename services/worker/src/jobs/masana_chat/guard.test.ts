import { describe, it, expect, vi } from "vitest";
import { admitMasanaChatExecution } from "./guard.js";
describe("J03 worker-side Masana chat guard", () => {
  it("refuses disabled, human or failed lookups", async () => {
    const approved = vi.fn(async () => true);
    expect(await admitMasanaChatExecution({
      tenantId:"t", characterId:"c", actorKind:"fan", featureEnabled:false, approved,
    })).toBe(false);
    expect(approved).not.toHaveBeenCalled();
    expect(await admitMasanaChatExecution({
      tenantId:"t", characterId:"c", actorKind:"staff", featureEnabled:true, approved,
    })).toBe(false);
    expect(await admitMasanaChatExecution({
      tenantId:"t", characterId:"c", actorKind:"fan", featureEnabled:true,
      approved: async () => { throw new Error("db_down"); },
    })).toBe(false);
  });
  it("accepts only approved fan-to-Masana work with a valid backing lookup", async () => {
    const args: string[] = [];
    expect(await admitMasanaChatExecution({
      tenantId:"tenant-a", characterId:"character-a", actorKind:"fan",
      featureEnabled:true, approved:async ({tenantId,characterId}) => {
        args.push(tenantId,characterId);return true;
      },
    })).toBe(true);
    expect(args).toEqual(["tenant-a","character-a"]);
  });
});

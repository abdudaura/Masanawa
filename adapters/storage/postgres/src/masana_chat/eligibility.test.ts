import { describe, it, expect, vi } from "vitest";
import { createPostgresMasanaChatEligibility } from "./eligibility.js";
describe("J03 canonical Masana PostgreSQL eligibility", () => {
  it("checks exact tenant/character, approved revision and platform ownership", async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]) => ({
      rows: [{ eligible: true }],
    }));
    const store = createPostgresMasanaChatEligibility({ query } as never);
    expect(await store.isApprovedPlatformMasana({
      tenantId:"tenant-a",characterId:"character-a",
    })).toBe(true);
    const [sql,params] = query.mock.calls[0]!;
    expect(sql).toContain("o.kind = 'platform'");
    expect(sql).toContain("r.state = 'approved'");
    expect(sql).toContain("c.state = 'active'");
    expect(params).toEqual(["tenant-a","character-a"]);
  });
  it("denies missing, unapproved and DB-error results", async () => {
    const no = createPostgresMasanaChatEligibility({
      query: async () => ({ rows:[{eligible:false}] }),
    } as never);
    expect(await no.isApprovedPlatformMasana({
      tenantId:"tenant-a",characterId:"human",
    })).toBe(false);
    const broken = createPostgresMasanaChatEligibility({
      query: async () => { throw new Error("relation_missing"); },
    } as never);
    await expect(broken.isApprovedPlatformMasana({
      tenantId:"tenant-a",characterId:"c",
    })).rejects.toThrow("relation_missing");
  });
});

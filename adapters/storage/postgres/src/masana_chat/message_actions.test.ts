import { describe, expect, it, vi } from "vitest";
import { createMasanaMessageActionStore } from "./message_actions.js";
const character="character_0199f0d0-0000-7000-8000-000000000003";
const turn="request_0199f0d0-0000-7000-8000-000000000002";
describe("C13 owned message hides", () => {
  it("binds a completed journal turn to verified fan+tenant and keeps journal immutable", async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]) => ({rows:[{owned:true}]}));
    const store = createMasanaMessageActionStore({query} as never);
    expect(await store.hideOwnedSentTurn({tenantId:"tenant-a",fanUserId:"fan-a"},character,turn))
      .toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("t.tenant_id=$1 AND t.user_id=$2 AND t.character_id=$3");
    expect(sql).toContain("t.request_id=$4 AND t.state='completed'");
    expect(sql).toContain("o.kind='platform'");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).not.toMatch(/DELETE FROM agents|UPDATE agents/i);
    expect(params).toEqual(["tenant-a","fan-a",character,turn]);
  });
  it("keeps a foreign/noncompleted turn indistinguishable from a missing turn", async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]) => ({rows:[{owned:false}]}));
    expect(await createMasanaMessageActionStore({query} as never)
      .hideOwnedSentTurn({tenantId:"tenant-a",fanUserId:"fan-a"},character,turn))
      .toBe(false);
  });
  it("rejects invalid actor or source identifiers before any SQL", async () => {
    const query = vi.fn();
    const store = createMasanaMessageActionStore({query} as never);
    await expect(store.hideOwnedSentTurn({tenantId:"",fanUserId:"fan-a"},character,turn))
      .rejects.toThrow();
    await expect(store.hideOwnedSentTurn({tenantId:"tenant-a",fanUserId:"fan-a"},character,"request_bad"))
      .rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createMasanaInboxRepository } from "./inbox.js";

const scope = {tenantId:"tenant-a",fanUserId:"fan-a"};
const character = "character_0199f0d0-0000-7000-8000-000000000003";
function repository(
  rows: readonly Record<string, unknown>[] = [],
  options: { hiddenTurnsReady?: boolean } = {},
) {
  const query = vi.fn(async (..._args: unknown[]) => ({rows, rowCount:rows.length}));
  return { inbox: createMasanaInboxRepository({
    query,
  } as unknown as Pick<Pool,"query">, options), query};
}
describe("C10 tenant-private canonical chat inbox", () => {
  it("keeps the existing J03 inbox query usable before C13 schema 0006 is registered", async () => {
    const {inbox, query} = repository();
    await inbox.list(scope);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).not.toContain("masana.fan_hidden_turns");
    expect(sql).toContain("agents.mobile_turn_commands");
    expect(sql).toContain("u.tenant_id=$1 AND u.user_id=$2");
  });
  it("filters only this fan's hidden turn from preview and unread after verified schema readiness", async () => {
    const {inbox, query} = repository([], {hiddenTurnsReady:true});
    await inbox.list(scope);
    const sql = String(query.mock.calls[0]?.[0]);
    expect((sql.match(/NOT EXISTS \(SELECT 1 FROM masana\.fan_hidden_turns h/g) ?? []))
      .toHaveLength(2);
    for (const alias of ["u", "t"]) {
      expect(sql).toContain(`h.tenant_id=${alias}.tenant_id AND h.fan_user_id=${alias}.user_id`);
      expect(sql).toContain(`h.character_id=${alias}.character_id AND h.request_id=${alias}.request_id`);
    }
  });
  it("queries canonical session/turn tables only inside the authenticated scope", async () => {
    const {inbox,query} = repository([{
      character_id:character,display_name:"Gwana",profession:"Teacher",
      last_message:"Welcome",last_activity_at:"2026-10-11 01:00:00+00",
      unread_count:"3",revision:"0",pinned:false,
    }]);
    const items = await inbox.list(scope,"teacher");
    expect(items).toHaveLength(1);
    expect(items[0]?.unreadCount).toBe(3);
    expect(items[0]?.revision).toBe(0);
    const [sql,values]=query.mock.calls[0] as unknown as [string,unknown[]];
    expect(sql).toContain("agents.character_sessions");
    expect(sql).toContain("agents.mobile_turn_commands");
    expect(sql).toContain("s.tenant_id=$1 AND s.user_id=$2");
    expect(sql).toContain("r.state='approved'");
    expect(sql).toContain("o.kind='platform'");
    expect(sql).toContain("u.state='active'");
    expect(values).toEqual(["tenant-a","fan-a","teacher"]);
  });
  it("keeps Gwani in its dedicated tab, not C10 list or pin/read", async () => {
    const {inbox,query}=repository([{revision:"1"}]);
    await inbox.list(scope);
    const listing=String(query.mock.calls[0]?.[0]);
    expect(listing).toContain("lower(r.profile->>'handle') <> 'gwani'");
    expect(listing).toContain("AND ($3='' OR position(");
    query.mockClear();
    await inbox.setPinned(scope,character,true,0);
    expect(String(query.mock.calls[0]?.[0]))
      .toContain("lower(r.profile->>'handle') <> 'gwani'");
    query.mockClear();
    await inbox.markRead(scope,character);
    expect(String(query.mock.calls[0]?.[0]))
      .toContain("lower(r.profile->>'handle') <> 'gwani'");
  });
  it("fails closed on invalid query or missing caller tenant", async () => {
    const {inbox,query}=repository();
    await expect(inbox.list({tenantId:"",fanUserId:"a"})).rejects.toThrow();
    await expect(inbox.list(scope,"a".repeat(81))).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("pins only an existing fan-owned approved session with CAS",async()=>{
    const {inbox,query}=repository([{revision:"1"}]);
    expect(await inbox.setPinned(scope,character,true,0)).toBe(1);
    const [insertSql,values]=query.mock.calls[0] as unknown as [string,unknown[]];
    expect(insertSql).toContain("FROM agents.character_sessions");
    expect(insertSql).toContain("ON CONFLICT");
    expect(values).toEqual(["tenant-a","fan-a",character,true,0]);
    query.mockClear();
    expect(await inbox.setPinned(scope,character,false,1)).toBe(1);
    expect(String(query.mock.calls[0]?.[0])).toContain("p.revision=$5");
  });
  it("never invents success after CAS loss or forbidden character",async()=>{
    const {inbox,query}=repository([]);
    expect(await inbox.setPinned(scope,character,true,0)).toBeNull();
    await expect(inbox.setPinned(scope,"user_foo",true,0)).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("uses server time and a monotone watermark for marking read",async()=>{
    const {inbox,query}=repository([{revision:"2"}]);
    expect(await inbox.markRead(scope,character)).toBe(2);
    const sql=String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("GREATEST(");
    expect(sql).toContain("clock_timestamp()");
    expect(sql).toContain("EXISTS");
  });
  it("caps returned unread count and never rounds unsafe bigint revisions",async()=>{
    const {inbox}=repository([{
      character_id:character,display_name:"Teacher",profession:"Lecturer",
      last_activity_at:"2026-10-11",unread_count:"1234",revision:"0",pinned:true,
    }]);
    expect((await inbox.list(scope))[0]?.unreadCount).toBe(99);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createMasanaInboxRepository } from "./inbox.js";

const scope = {tenantId:"tenant-a",fanUserId:"fan-a"};
const character = "character_0199f0d0-0000-7000-8000-000000000003";
function repository(rows: readonly Record<string, unknown>[] = []) {
  const query = vi.fn(async (..._args: unknown[]) => ({rows, rowCount:rows.length}));
  return { inbox: createMasanaInboxRepository({
    query,
  } as unknown as Pick<Pool,"query">), query};
}
describe("C10 tenant-private canonical chat inbox", () => {
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

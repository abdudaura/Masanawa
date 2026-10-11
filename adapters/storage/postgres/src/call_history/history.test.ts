import {describe,it,expect,vi} from "vitest";
import {createPostgresCallHistoryReader} from "./history.js";
describe("C18 PostgreSQL tenant-private call history",()=>{
 it("binds tenant/fan and stable cursor without reading media tokens",async()=>{
  const query=vi.fn(async (_sql:string,_params:unknown[])=>({rows:[{
   callId:"call_0199f0d0-0000-7000-8000-000000000005",
   characterId:"character_0199f0d0-0000-7000-8000-000000000005",
   displayName:"Gwani",state:"ended",createdAt:new Date("2026-10-11T07:00:00Z"),
   startedAt:null,endedAt:null,durationSeconds:0,
  }]}));
  const r=createPostgresCallHistoryReader({query} as never);
  const page=await r.list({tenantId:"tenant-a",fanUserId:"fan-1"},{limit:20,cursor:null});
  expect(page.items[0]?.displayName).toBe("Gwani");
  expect(page.nextCursor).toBeNull();
  expect(query.mock.calls[0]?.[1]).toEqual(["tenant-a","fan-1",null,null,21]);
  const sql=query.mock.calls[0]?.[0] as string;
  expect(sql).toContain("c.tenant_id=$1 AND c.fan_user_id=$2");
  expect(sql).toContain("ORDER BY c.created_at DESC,c.call_id DESC");
  expect(sql).not.toMatch(/room_name|provider_token|livekit_token/i);
 });
 it("does not expose a cursor unless an extra row exists",async()=>{
  const row=(i:number)=>({callId:"call_0199f0d0-0000-7000-8000-00000000000"+i,
    characterId:"character_x",displayName:null,state:"expired",
    createdAt:new Date("2026-10-11T07:00:00Z"),startedAt:null,endedAt:null,durationSeconds:0});
  const query=vi.fn(async()=>({rows:[row(1),row(2)]}));
  const page=await createPostgresCallHistoryReader({query} as never).list(
   {tenantId:"a",fanUserId:"b"},{limit:1,cursor:null});
  expect(page.items).toHaveLength(1);
  expect(page.nextCursor).toContain("call_");
 });
});

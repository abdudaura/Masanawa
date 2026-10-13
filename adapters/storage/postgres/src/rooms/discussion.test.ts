import {describe,it,expect,vi} from "vitest";
import type {Pool} from "pg";
import {RoomError} from "@masanawa/rooms";
import {createPgRoomDiscussionRepository} from "./discussion.js";
const actor={tenantId:"tenant_ours",userId:"fan_ours",roles:[]};
function mockDb(opts:{member?:boolean;paid?:boolean;entitled?:boolean}={}){
 const seen:Array<{sql:string;args:unknown[]}>=[];let released=false;
 const query=vi.fn(async(sql:string,args:unknown[]=[]):Promise<{rows:any[]}>=>{
  seen.push({sql,args});
  if(sql.startsWith("SELECT * FROM rooms.rooms"))return {rows:[{
   room_id:"room_test",state:"published",plan_mode:opts.paid?"paid":"free"}]};
  if(sql.startsWith("SELECT state FROM rooms.memberships"))return {rows:opts.member===false?[]:[{state:"active"}]};
  if(sql.startsWith("SELECT 1 FROM rooms.entitlements"))return {rows:opts.entitled?[{}]:[]};
  if(sql.startsWith("SELECT 1 FROM rooms.questions"))return {rows:[{}]};
  if(sql.includes("FROM rooms.discussion_replies WHERE"))return {rows:[]};
  return {rows:[]};
 });
 const connection={query,release:()=>{released=true}};
 const pool={query,connect:async()=>connection} as unknown as Pool;
 return {db:createPgRoomDiscussionRepository(pool),seen,query,wasReleased:()=>released};
}
describe("C39 PG discussion protects Room membership and entitlements",()=>{
 it("rejects a nonmember before selecting any discussion rows",async()=>{
  const m=mockDb({member:false});
  await expect(m.db.list(actor,"room_test","question","room-question_aabbccdd",null))
   .rejects.toMatchObject({status:403,code:"room_membership_required"});
  expect(m.seen.some(q=>q.sql.includes("FROM rooms.discussion_replies"))).toBe(false);
  expect(m.wasReleased()).toBe(true);
 });
 it("rejects paid content when the fan has no verified entitlement",async()=>{
  const m=mockDb({paid:true,entitled:false});
  await expect(m.db.list(actor,"room_test","question","room-question_aabbccdd",null))
   .rejects.toMatchObject({status:403,code:"subscription_not_verified"});
  expect(m.seen.some(q=>q.sql.includes("FROM rooms.discussion_replies"))).toBe(false);
 });
 it("uses trusted tenant/fan and never leaks held replies from other authors",async()=>{
  const m=mockDb();
  const page=await m.db.list(actor,"room_test","question","room-question_aabbccdd",null);
  expect(page.items).toEqual([]);expect(page.nextCursor).toBeNull();
  const q=m.seen.find(x=>x.sql.includes("FROM rooms.discussion_replies"));
  expect(q?.sql).toContain("user_id=$4 AND moderation_state='held'");
  expect(q?.args).toEqual(["tenant_ours","room_test","room-question_aabbccdd","fan_ours",null,null]);
 });
 it("validates idempotency key before any write",async()=>{
  const m=mockDb();
  await expect(m.db.create(actor,"room_test","question","room-question_aabbccdd","Hello","bad",null))
   .rejects.toBeInstanceOf(RoomError);
  expect(m.query).not.toHaveBeenCalled();
 });
});

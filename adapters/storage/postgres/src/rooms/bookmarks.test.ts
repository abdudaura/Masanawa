import {describe,it,expect,vi} from "vitest";
import {RoomError} from "@masanawa/rooms";
import {createPgRoomBookmarkStore} from "./bookmarks.js";
const actor={tenantId:"tenant_a",userId:"fan_a",roles:[]};
const room="room_math",lesson="room-lesson_12345678";
function fixture(mode:"free"|"paid"|"member_denied"|"unentitled"="free"){
 const seen:Array<{sql:string;params:unknown[]|undefined}>=[];
 const query=vi.fn(async(sql:string,params?:unknown[])=>{
  seen.push({sql,params});
  if(sql.includes("FROM rooms.rooms"))return {rows:[{tenant_id:actor.tenantId,room_id:room,state:"published",
    plan_mode:mode==="paid"||mode==="unentitled"?"paid":"free"}]};
  if(sql.includes("FROM rooms.entitlements"))return {rows:mode==="paid"?[{exists:1}]:[]};
  if(sql.includes("FROM rooms.memberships"))return {rows:mode==="member_denied"?[]:[{state:"active"}]};
  if(sql.includes("SELECT 1 FROM rooms.lessons"))return {rows:[{exists:1}]};
  if(sql.includes("FROM rooms.lesson_bookmarks"))return {rows:[{lesson_id:lesson,body:"Algebra",kind:"lesson",bookmarked_at:"2026-10-11T00:00:00Z"}]};
  return {rows:[],rowCount:1};
 });
 const pool={connect:vi.fn(async()=>({query,release:vi.fn()})),query} as never;
 return {store:createPgRoomBookmarkStore(pool),seen,query};
}
describe("C38 private saved lessons PG guard",()=>{
 it("reads only after canonical membership and publication admission",async()=>{
  const x=fixture();
  const found=await x.store.list(actor,room);
  expect(found).toHaveLength(1);
  expect(found[0]?.body).toBe("Algebra");
  expect(x.seen.some(v=>v.sql.includes("FROM rooms.memberships"))).toBe(true);
  const savedQuery=x.seen.find(v=>v.sql.includes("FROM rooms.lesson_bookmarks"));
  expect(savedQuery?.params).toEqual(["tenant_a",room,"fan_a"]);
 });
 it("rejects nonmember before any bookmark content read",async()=>{
  const x=fixture("member_denied");
  await expect(x.store.list(actor,room)).rejects.toMatchObject({status:403});
  expect(x.seen.some(v=>v.sql.includes("FROM rooms.lesson_bookmarks"))).toBe(false);
 });
 it("rejects missing paid entitlement before content or bookmark writes",async()=>{
  const x=fixture("unentitled");
  await expect(x.store.list(actor,room)).rejects.toMatchObject({status:403});
  await expect(x.store.save(actor,room,lesson)).rejects.toMatchObject({status:403});
  expect(x.seen.some(v=>v.sql.includes("INSERT INTO rooms.lesson_bookmarks"))).toBe(false);
 });
 it("uses one natural key and ON CONFLICT for duplicate saves",async()=>{
  const x=fixture();
  await x.store.save(actor,room,lesson);
  await x.store.save(actor,room,lesson);
  const writes=x.seen.filter(v=>v.sql.includes("INSERT INTO rooms.lesson_bookmarks"));
  expect(writes).toHaveLength(2);
  expect(writes[0]?.params).toEqual(["tenant_a",room,"fan_a",lesson]);
  expect(writes[0]?.sql).toContain("ON CONFLICT");
 });
 it("validates lesson ID before touching SQL",async()=>{
  const x=fixture();
  await expect(x.store.save(actor,room,"../../other")).rejects.toBeInstanceOf(RoomError);
  expect(x.query).not.toHaveBeenCalled();
 });
 it("removes only current fan pointer, even if paid entitlement expired",async()=>{
  const x=fixture("unentitled");
  await x.store.remove(actor,room,lesson);
  expect(x.seen.at(-1)?.params).toEqual(["tenant_a",room,"fan_a",lesson]);
 });
});

import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import {registerRoomsRoutes} from "./routes.js";
import type {RoomsRepository,RoomActor} from "@masanawa/rooms";
import {RoomError} from "@masanawa/rooms";
function build(actor:RoomActor,enabled=true){
 const ask=vi.fn(),create=vi.fn();
 const repo={
  list:vi.fn(async()=>[]),get:vi.fn(async()=>null),
  staffRooms:vi.fn(async()=>[]),staffRoom:vi.fn(async()=>null),
  join:vi.fn(async()=>{}),leave:vi.fn(async()=>{}),ask,
  questions:vi.fn(async()=>[]),question:vi.fn(async()=>null),
  create,publish:vi.fn(async()=>{}),staffQueue:vi.fn(async()=>[]),
  review:vi.fn(async()=>{}),lessons:vi.fn(async()=>[]),createLesson:vi.fn(async()=>{})
 } as unknown as RoomsRepository;
 const app=Fastify();
 registerRoomsRoutes(app,{repository:repo,enabled:()=>enabled,
   authorize:async()=>actor,isApprovedMasana:async()=>false});
 return {app,repo,ask,create};
}
const fan:RoomActor={tenantId:"tenant_test",userId:"user_test",roles:["fan"]};
describe("Rooms v1 server authority",()=>{
 it("denies fan-created Rooms even with forged staff role payload",async()=>{
  const {app,create}=build(fan);
  const r=await app.inject({method:"POST",url:"/v1/admin/rooms",
   payload:{slug:"math",professionTitle:"Mathematics",teacherCharacterId:"character_1",roles:["platform_admin"]}});
  expect(r.statusCode).toBe(403);expect(create).not.toHaveBeenCalled();await app.close();
 });
 it("requires idempotency for every question write",async()=>{
  const {app,ask}=build(fan);
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_math/questions",
   payload:{body:"What is algebra?"}});
  expect(r.statusCode).toBe(422);expect(ask).not.toHaveBeenCalled();await app.close();
 });
 it("denies all routes while disabled without invoking storage",async()=>{
  const {app,repo}=build(fan,false);
  const r=await app.inject({method:"GET",url:"/v1/rooms"});
  expect(r.statusCode).toBe(410);expect(repo.list).not.toHaveBeenCalled();await app.close();
 });
 it("does not publish without approved teacher status",async()=>{
  const staff:RoomActor={tenantId:"tenant_test",userId:"staff_test",roles:["rooms_editor"]};
  const {app,repo}=build(staff);
  vi.mocked(repo.staffRoom).mockResolvedValue({
   roomId:"room_math",slug:"math",professionTitle:"Mathematics",
   teacherCharacterId:"character_test",language:"en",
   planMode:"free",state:"draft",memberCount:0,joined:false
  });
  const r=await app.inject({method:"POST",url:"/v1/admin/rooms/room_math/publish"});
  expect(r.statusCode).toBe(403);expect(repo.publish).not.toHaveBeenCalled();await app.close();
 });
 it("returns 503 on storage failure instead of leaking SQL internals",async()=>{
  const {app,repo}=build(fan);
  vi.mocked(repo.list).mockRejectedValue(new Error("private DB details"));
  const r=await app.inject({method:"GET",url:"/v1/rooms"});
  expect(r.statusCode).toBe(503);expect(r.body).not.toContain("private DB details");await app.close();
 });
});

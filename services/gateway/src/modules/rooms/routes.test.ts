import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import {registerRoomsRoutes} from "./routes.js";
import type {RoomsRepository,RoomActor} from "@masanawa/rooms";
import {RoomError} from "@masanawa/rooms";
import {roomRolesForSession} from "../../main.js";
function build(actor:RoomActor,enabled=true,approved=false){
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
   authorize:async()=>actor,isApprovedMasana:async()=>approved});
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
 it("keeps staff privileges OFF unless both gates and the server allowlist permit them",async()=>{
  const editors=new Set(["editor_real"]);
  expect(roomRolesForSession("rooms.staff","editor_real",editors,false)).toEqual([]);
  expect(roomRolesForSession("rooms.read","editor_real",editors,true)).toEqual([]);
  expect(roomRolesForSession("rooms.staff","other_fan",editors,true)).toEqual([]);
  const actor:RoomActor={tenantId:"tenant_one",userId:"editor_real",
    roles:roomRolesForSession("rooms.staff","editor_real",editors,false)};
  const f=build(actor);
  const result=await f.app.inject({method:"POST",url:"/v1/admin/rooms",
    headers:{"x-role":"rooms_editor","x-user-id":"editor_real"},
    payload:{professionTitle:"Teaching",slug:"teaching",
      teacherCharacterId:"character_1",roles:["rooms_editor"]}});
  expect(result.statusCode).toBe(403);
  expect(f.create).not.toHaveBeenCalled();
  await f.app.close();
 });
 it("qualified editor creates and publishes approved Masana Room through existing API",async()=>{
  const roles=roomRolesForSession("rooms.staff","editor_real",
    new Set(["editor_real"]),true);
  const staff:RoomActor={tenantId:"tenant_one",userId:"editor_real",roles};
  const f=build(staff,true,true);
  const draft={roomId:"room_math",slug:"math",professionTitle:"Mathematics",
    teacherCharacterId:"character_approved",language:"en",
    planMode:"free" as const,state:"draft" as const,memberCount:0,joined:false};
  vi.mocked(f.repo.create).mockResolvedValue(draft);
  vi.mocked(f.repo.staffRoom).mockResolvedValue(draft);
  const create=await f.app.inject({method:"POST",url:"/v1/admin/rooms",
    payload:{professionTitle:"Mathematics",slug:"math",
      teacherCharacterId:"character_approved",language:"en",
      tenantId:"tenant_forged",roles:["platform_admin"]}});
  expect(create.statusCode).toBe(201);
  expect(create.json()).toEqual(draft);
  expect(f.repo.create).toHaveBeenCalledWith(staff,{
    title:"Mathematics",slug:"math",
    teacherCharacterId:"character_approved",language:"en"});
  const publish=await f.app.inject({method:"POST",
    url:"/v1/admin/rooms/room_math/publish"});
  expect(publish.statusCode).toBe(200);
  expect(f.repo.publish).toHaveBeenCalledWith(staff,"room_math",true);
  const lesson=await f.app.inject({method:"POST",
    url:"/v1/admin/rooms/room_math/lessons",
    payload:{body:"Learn percentages",kind:"lesson"}});
  expect(lesson.statusCode).toBe(201);
  expect(f.repo.createLesson).toHaveBeenCalledWith(staff,"room_math",
    "Learn percentages","lesson");
  await f.app.close();
 });
 it("has no ordinary question staff-review gate or manual approval endpoint",async()=>{
  const {app}=build(fan);
  try{
   expect((await app.inject({method:"GET",url:"/v1/admin/rooms/questions"})).statusCode).toBe(404);
   expect((await app.inject({method:"POST",url:"/v1/admin/rooms/questions/room-question_1/review",
      payload:{decision:"approve",answer:"manually reviewed"}})).statusCode).toBe(404);
  }finally{await app.close();}
 });
 it("returns 503 on storage failure instead of leaking SQL internals",async()=>{
  const {app,repo}=build(fan);
  vi.mocked(repo.list).mockRejectedValue(new Error("private DB details"));
  const r=await app.inject({method:"GET",url:"/v1/rooms"});
  expect(r.statusCode).toBe(503);expect(r.body).not.toContain("private DB details");await app.close();
 });
});

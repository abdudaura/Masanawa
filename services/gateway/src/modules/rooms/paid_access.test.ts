import Fastify from "fastify";
import {describe,it,expect,vi} from "vitest";
import {RoomError} from "@masanawa/rooms";
import type {RoomActor,RoomsRepository} from "@masanawa/rooms/ports";
import {registerRoomsRoutes} from "./routes.js";

const fan:RoomActor={tenantId:"tenant_one",userId:"fan_one",roles:["fan"]};
const staff:RoomActor={tenantId:"tenant_one",userId:"moderator_one",roles:["rooms_editor"]};
function build(actor=fan,enabled=true){
 const repository={
  get:vi.fn(async()=>({roomId:"room_math_1",professionTitle:"Mathematics",planMode:"paid",joined:false})),
  list:vi.fn(async()=>[]),join:vi.fn(async()=>{}),leave:vi.fn(async()=>{}),
  ask:vi.fn(async()=>{throw new RoomError(403,"subscription_not_verified");}),
  lessons:vi.fn(async()=>{throw new RoomError(403,"subscription_not_verified");}),
  questions:vi.fn(async()=>{throw new RoomError(403,"subscription_not_verified");}),
  question:vi.fn(async()=>{throw new RoomError(403,"subscription_not_verified");}),
  staffRooms:vi.fn(async()=>[]),staffRoom:vi.fn(async()=>null),create:vi.fn(),
  publish:vi.fn(),staffQueue:vi.fn(async()=>[]),review:vi.fn(),
  createLesson:vi.fn()
 } as unknown as RoomsRepository;
 const authorize=vi.fn(async(_header:string|undefined,_capability:string)=>actor);
 const app=Fastify();
 registerRoomsRoutes(app,{repository,authorize,enabled:()=>enabled,
  isApprovedMasana:async()=>false});
 return {app,repository,authorize};
}
describe("J08 paid-room API does not promote a client purchase claim into membership",()=>{
 it("returns a safe 403 when the repository rejects an expired paid lesson",async()=>{
  const {app,repository}=build();
  const r=await app.inject({method:"GET",url:"/v1/rooms/room_math_1/lessons",
   headers:{authorization:"Bearer user-authenticated-token"}});
  expect(r.statusCode).toBe(403);
  expect(r.json()).toMatchObject({code:"subscription_not_verified"});
  expect(repository.lessons).toHaveBeenCalledWith(fan,"room_math_1");
  await app.close();
 });
 it("does not trust client-provided tenant, user or entitlement status on join",async()=>{
  const {app,authorize,repository}=build();
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_math_1/join",
   payload:{tenantId:"tenant_other",userId:"another_user",verified:true,roles:["super_admin"]}});
  expect(r.statusCode).toBe(200);
  expect(authorize).toHaveBeenCalledWith(undefined,"rooms.join");
  expect(repository.join).toHaveBeenCalledWith(fan,"room_math_1");
  await app.close();
 });
 it("denies anonymous paid Room join before hitting the database",async()=>{
  const {app,repository}=build({...fan,userId:null});
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_math_1/join",
   payload:{purchaseVerified:true}});
  expect(r.statusCode).toBe(401);
  expect(repository.join).not.toHaveBeenCalled();
  await app.close();
 });
 it("returns a safe 503 on entitlement backend outage, never opens access",async()=>{
  const {app,repository}=build();
  vi.mocked(repository.join).mockRejectedValue(new Error("private DB auth context"));
  const r=await app.inject({method:"POST",url:"/v1/rooms/room_math_1/join"});
  expect(r.statusCode).toBe(503);expect(r.body).not.toContain("private DB");
  await app.close();
 });
 it("fails closed when the entire Room feature is disabled",async()=>{
  const {app,repository}=build(staff,false);
  const r=await app.inject({method:"GET",url:"/v1/rooms/room_math_1/lessons"});
  expect(r.statusCode).toBe(410);
  expect(repository.lessons).not.toHaveBeenCalled();
  await app.close();
 });
});

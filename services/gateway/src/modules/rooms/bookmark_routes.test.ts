import {describe,it,expect,vi} from "vitest";
import Fastify from "fastify";
import {RoomError} from "@masanawa/rooms";
import {registerRoomBookmarkRoutes} from "./bookmark_routes.js";
const who={tenantId:"tenant_a",userId:"fan_a",roles:[] as string[]};
function fixture({enabled=true,authorized=true}={}){
 const app=Fastify();
 const list=vi.fn().mockResolvedValue([]);
 const save=vi.fn().mockResolvedValue(undefined);
 const remove=vi.fn().mockResolvedValue(undefined);
 const authorize=vi.fn().mockImplementation(async()=>authorized?who:Promise.reject(new RoomError(401,"sign_in_required")));
 registerRoomBookmarkRoutes(app,{store:{list,save,remove},authorize,enabled:()=>enabled});
 return {app,list,save,remove,authorize};
}
const room="room_math",lesson="room-lesson_12345678";
describe("C38 book-marked lessons require canonical fan and room authorization",()=>{
 it("default-off does no authentication or DB work",async()=>{
  const x=fixture({enabled:false});
  const r=await x.app.inject({method:"GET",url:"/v1/rooms/"+room+"/bookmarks"});
  expect(r.statusCode).toBe(503);expect(x.authorize).not.toHaveBeenCalled();expect(x.list).not.toHaveBeenCalled();
 });
 it("never accepts a guest or forged actor payload",async()=>{
  const x=fixture({authorized:false});
  expect((await x.app.inject({method:"GET",url:"/v1/rooms/"+room+"/bookmarks"})).statusCode).toBe(401);
  expect(x.list).not.toHaveBeenCalled();
  const y=fixture();
  expect((await y.app.inject({method:"PUT",url:"/v1/rooms/"+room+"/lessons/"+lesson+"/bookmark",
    payload:{userId:"fan_b",tenantId:"tenant_b"}})).statusCode).toBe(422);
  expect(y.save).not.toHaveBeenCalled();
 });
 it("passes trusted principal and stable natural-key idempotent write to one store",async()=>{
  const x=fixture();
  const path="/v1/rooms/"+room+"/lessons/"+lesson+"/bookmark";
  const a=await x.app.inject({method:"PUT",url:path});
  const b=await x.app.inject({method:"PUT",url:path});
  expect(a.json()).toEqual({saved:true});expect(b.statusCode).toBe(200);
  expect(x.save).toHaveBeenCalledWith(who,room,lesson);
  expect(x.save).toHaveBeenCalledTimes(2);
  expect((await x.app.inject({method:"DELETE",url:path})).json()).toEqual({saved:false});
 });
 it("maps paid/membership denials without returning private content",async()=>{
  const x=fixture();
  x.list.mockRejectedValue(new RoomError(403,"subscription_not_verified"));
  const r=await x.app.inject({method:"GET",url:"/v1/rooms/"+room+"/bookmarks"});
  expect(r.statusCode).toBe(403);
  expect(r.json()).toEqual({code:"subscription_not_verified"});
  expect(r.headers["cache-control"]).toBe("no-store");
 });
});

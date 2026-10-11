import {describe,expect,it,vi} from "vitest";
import Fastify from "fastify";
import {registerSavedLibraryRoutes} from "./saved_routes.js";
describe("C25 authenticated saved routes",()=>{
  it("rejects anonymous, foreign tenant, denied flag and malformed video saves",async()=>{
    const app=Fastify(),list=vi.fn(async()=>({items:[],nextCursor:null})),
      saveVideo=vi.fn(async()=>({saved:true}));
    let actor:{kind:"fan";tenantId:string;id:string}|null=null,enabled=true;
    registerSavedLibraryRoutes(app,{service:{list,saveVideo},
      principal:async()=>actor,tenant:()=>"tenant-one",enabled:()=>enabled});
    expect((await app.inject({method:"GET",url:"/v1/saved"})).statusCode).toBe(401);
    actor={kind:"fan",id:"fan-one",tenantId:"tenant-other"};
    expect((await app.inject({method:"GET",url:"/v1/saved"})).statusCode).toBe(403);
    actor={...actor,tenantId:"tenant-one"};enabled=false;
    expect((await app.inject({method:"GET",url:"/v1/saved"})).statusCode).toBe(503);
    enabled=true;
    expect((await app.inject({method:"GET",url:"/v1/saved?cursor[]=bad"})).statusCode).toBe(422);
    const response=await app.inject({method:"PUT",url:"/v1/videos/dddddddd-dddd-4ddd-8ddd-dddddddddddd/save",
      payload:{enabled:"yes"}});
    expect(response.statusCode).toBe(422);
    expect(saveVideo).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    await app.close();
  });
});

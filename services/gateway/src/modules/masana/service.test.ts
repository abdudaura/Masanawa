import { describe,it,expect } from "vitest";
import Fastify from "fastify";
import { registerMasanaRoutes, type MasanaAuth, type MasanaStore } from "./service.js";

describe("Masana public and staff authority",()=>{
  const events:string[]=[];
  const store:MasanaStore={
    async list(input){events.push("list:"+input.tenantId);return {items:[]};},
    async read(input){events.push("read:"+input.characterId);return null;},
    async follow(input){events.push("follow:"+input.userId+":"+input.characterId+":"+input.active);return input.active;},
    async listDrafts(){events.push("drafts");return {items:[]};},
    async draft(){events.push("draft");return {revision:1};},
    async approve(){events.push("approve");return {revision:1};}
  };
  const auth:MasanaAuth={
    async optional(){return {tenantId:"tenant_test",userId:null};},
    async fan(h){if(h!=="Bearer fan") throw new Error("unauthorized");return {tenantId:"tenant_test",userId:"fan_a"};},
    async staff(h){if(h!=="Bearer editor") throw new Error("forbidden");return {tenantId:"tenant_test",userId:"staff_a"};}
  };
  async function app(){const instance=Fastify();registerMasanaRoutes(instance,{auth,store});await instance.ready();return instance;}
  it("does not read draft records on guest profile",async()=>{
    events.length=0;const server=await app();const response=await server.inject({method:"GET",url:"/v1/masana/foo"});
    expect(response.statusCode).toBe(404);expect(events).toEqual(["read:foo"]);await server.close();
  });
  it("does not mutate follows for a guest or a forged body user",async()=>{
    events.length=0;const server=await app();
    const guest=await server.inject({method:"POST",url:"/v1/masana/foo/follow",payload:{userId:"victim"}});
    expect(guest.statusCode).toBe(500);expect(events).toEqual([]);
    const fan=await server.inject({method:"POST",url:"/v1/masana/foo/follow",headers:{authorization:"Bearer fan"},payload:{userId:"victim"}});
    expect(fan.statusCode).toBe(200);expect(events).toEqual(["follow:fan_a:foo:true"]);await server.close();
  });
  it("denies non-editors before any staff store write",async()=>{
    events.length=0;const server=await app();
    const res=await server.inject({method:"POST",url:"/v1/admin/masana/foo/revisions",headers:{authorization:"Bearer fan"},payload:{profile:{}}});
    expect(res.statusCode).toBe(500);expect(events).toEqual([]);await server.close();
  });
  it("rejects excessive limit before querying the store",async()=>{
    events.length=0;const server=await app();
    const res=await server.inject({method:"GET",url:"/v1/masana?limit=999"});
    expect(res.statusCode).toBe(500);expect(events).toEqual([]);await server.close();
  });
});

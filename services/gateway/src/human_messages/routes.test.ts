import Fastify from "fastify";
import { describe,expect,it } from "vitest";
import { registerHumanDmRoutes } from "./routes.js";
import { createHumanDmService } from "./service.js";
import type { HumanDmRepository } from "./model.js";

const conversationId="11111111-1111-4111-8111-111111111111";
const requestId="request_11111111-1111-4111-8111-111111111111";
function appHarness(){
  const queries:{input:unknown;action:string}[]=[];
  const repository:HumanDmRepository={
    async open(input){queries.push({action:"open",input});return conversationId;},
    async inbox(input){queries.push({action:"inbox",input});return[];},
    async history(input){queries.push({action:"history",input});return[];},
    async send(input){queries.push({action:"send",input});return{
      messageId:"22222222-2222-4222-8222-222222222222",conversationId,
      sequence:"1",senderUserId:input.userId,clientRequestId:input.clientRequestId,
      body:input.body,createdAt:"2026-10-08T00:00:00.000Z",editedAt:null,deletedAt:null,
    };},
    async edit(){return null;},async remove(){return null;},
    async read(){return"1";},
  };
  const service=createHumanDmService({repository,authorizer:{
    async authorize({authorizationHeader}){
      if(authorizationHeader!=="Bearer valid") throw Object.assign(new Error("unauthorized"),{statusCode:401});
      return {userId:"user_al",tenantId:"tenant_a"} as never;
    },
  }});
  const app=Fastify();
  app.setErrorHandler((error,_req,reply)=>{void reply.code(error.statusCode??500).send({error:error.message});});
  registerHumanDmRoutes(app,service);
  return{app,queries};
}
describe("C02 Fastify human routes",()=>{
  it("requires a real existing bearer-authenticated session",async()=>{
    const h=appHarness();
    const r=await h.app.inject({method:"GET",url:"/messages"});
    expect(r.statusCode).toBe(401);
    expect(h.queries).toHaveLength(0);
    await h.app.close();
  });
  it("opens one canonical member pair and never trusts caller-specified tenant",async()=>{
    const h=appHarness();
    const r=await h.app.inject({method:"POST",url:"/messages",headers:{authorization:"Bearer valid"},
      payload:{otherUserId:"user_bo"}});
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({conversationId});
    expect(h.queries[0]).toMatchObject({input:{tenantId:"tenant_a",userId:"user_al",otherUserId:"user_bo"}});
    await h.app.close();
  });
  it("persists canonical server send and refuses malformed request",async()=>{
    const h=appHarness();
    const url="/messages/"+conversationId;
    const bad=await h.app.inject({method:"POST",url,headers:{authorization:"Bearer valid"},
      payload:{senderUserId:"user_admin",clientRequestId:requestId,body:"Hello"}});
    expect(bad.statusCode).toBe(400);
    const ok=await h.app.inject({method:"POST",url,headers:{authorization:"Bearer valid"},
      payload:{clientRequestId:requestId,body:" Hello "}});
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({senderUserId:"user_al",body:"Hello",clientRequestId:requestId});
    expect(h.queries.find(x=>x.action==="send")).toMatchObject({input:{tenantId:"tenant_a",userId:"user_al",body:"Hello"}});
    await h.app.close();
  });
  it("returns bounded keyset history, rejects non-number cursor",async()=>{
    const h=appHarness();
    const ok=await h.app.inject({method:"GET",url:"/messages/"+conversationId+"?limit=30&before=105",
      headers:{authorization:"Bearer valid"}});
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({messages:[],nextBefore:null});
    const bad=await h.app.inject({method:"GET",url:"/messages/"+conversationId+"?before=../../etc",
      headers:{authorization:"Bearer valid"}});
    expect(bad.statusCode).toBe(400);
    await h.app.close();
  });
});

import {describe,it,expect} from "vitest";
import Fastify from "fastify";
import {registerHumanDmRoutes} from "./routes.js";
import {createHumanDmService} from "./service.js";
import type {HumanDmRepository} from "./model.js";
const c="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const m="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function server() {
  const repository:HumanDmRepository={
    async open({otherUserId}){return otherUserId==="user_bob"?c:null;},
    async list(){return [];},
    async history(){return [];},
    async send({text,clientMessageId}){return {conversationId:c,messageId:m,sequence:1,
      clientMessageId,senderUserId:"user_alice",text,createdAt:"2026-10-08T11:00:00.000Z",editedAt:null,deletedAt:null};},
    async read(){return 1;},
    async edit(){return null;},
    async remove(){return null;},
  };
  const service=createHumanDmService({repository,authorizer:{
    async authorize({authorizationHeader}) {
      if(authorizationHeader!=="Bearer alice")throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      return {tenantId:"tenant_one" as never,userId:"user_alice" as never,profile:{
        tenantId:"tenant_one" as never,userId:"user_alice" as never,
        name:"Alice",email:null,phone:null,locale:"en",createdAt:"2026-10-08T09:00:00.000Z",
      }};
    },
  }});
  const app=Fastify();registerHumanDmRoutes(app,service);return app;
}
describe("C02 real Fastify route validation",()=>{
  it("requires bearer on every conversation call",async()=>{
    const app=server();const resp=await app.inject({method:"GET",url:"/v1/messages/conversations"});
    expect(resp.statusCode).toBe(401);await app.close();
  });
  it("opens only allowed recipient and serializes message acknowledgement",async()=>{
    const app=server(),headers={authorization:"Bearer alice"};
    let resp=await app.inject({method:"POST",url:"/v1/messages/conversations",
      headers,payload:{otherUserId:"user_bob"}});
    expect(resp.statusCode).toBe(201);
    expect(resp.json()).toEqual({conversationId:c});
    resp=await app.inject({method:"POST",url:`/v1/messages/conversations/${c}/messages`,
      headers,payload:{clientMessageId:m,text:"Test note"}});
    expect(resp.statusCode).toBe(200);
    expect(resp.json()).toMatchObject({clientMessageId:m,text:"Test note",sequence:1});
    await app.close();
  });
  it("rejects extraneous fields and malformed ids",async()=>{
    const app=server(),headers={authorization:"Bearer alice"};
    const malformed=await app.inject({method:"POST",url:"/v1/messages/conversations",
      headers,payload:{otherUserId:"user_bob",tenantId:"tenant_hack"}});
    expect(malformed.statusCode).toBe(400);
    const notUuid=await app.inject({method:"GET",url:"/v1/messages/conversations/not-valid/messages",headers});
    expect(notUuid.statusCode).toBe(400);
    await app.close();
  });
});

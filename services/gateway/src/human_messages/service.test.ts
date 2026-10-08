import {describe,expect,it} from "vitest";
import Fastify from "fastify";
import {createHumanMessageService} from "./service.js";
import {registerHumanMessageRoutes} from "./routes.js";
import type {HumanMessageRepository,HumanMessage} from "./model.js";

const sample: HumanMessage = Object.freeze({
  conversationId:"conversation-1",messageId:"message-1",senderUserId:"person-a",
  text:"Hello",createdAt:"2026-10-08T10:00:00.000Z",editedAt:null,deletedAt:null,revision:1,
});
function fixture(opts: {notFound?:boolean; rate?:boolean; conflict?:boolean} = {}) {
  const calls: Array<{name:string;who:string;data:unknown}>=[];
  const repo: HumanMessageRepository = {
    async start(input) {
      calls.push({name:"start",who:input.userId,data:input});
      if(opts.notFound)return null;
      return {conversationId:"conversation-1",otherUserId:input.recipientUserId,
        createdAt:sample.createdAt,updatedAt:sample.createdAt,lastMessage:null};
    },
    async list({userId}) {
      calls.push({name:"list",who:userId,data:null});
      return [];
    },
    async read({userId,conversationId}) {
      calls.push({name:"read",who:userId,data:conversationId});
      return opts.notFound ? null : {conversationId,otherUserId:"person-b",
        createdAt:sample.createdAt,updatedAt:sample.createdAt,lastMessage:null};
    },
    async history({userId,conversationId,before}) {
      calls.push({name:"history",who:userId,data:{conversationId,before}});
      return opts.notFound?null:{messages:[sample],nextCursor:null};
    },
    async send(input) {
      calls.push({name:"send",who:input.userId,data:input});
      if(opts.notFound)return null;
      if(opts.rate)throw new Error("messages.rate_limited");
      if(opts.conflict)throw new Error("messages.request_id_conflict");
      return sample;
    },
    async edit(input) {
      calls.push({name:"edit",who:input.userId,data:input});
      return opts.notFound?null:{...sample,revision:input.expectedRevision+1,editedAt:sample.createdAt,text:input.text};
    },
    async remove(input) {
      calls.push({name:"remove",who:input.userId,data:input});
      return opts.notFound?null:{...sample,revision:input.expectedRevision+1,deletedAt:sample.createdAt,text:""};
    },
  };
  const service=createHumanMessageService({repository:repo,authorizer:{
    async authorize({authorizationHeader}) {
      if(authorizationHeader!=="Bearer alice")throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      return {tenantId:"tenant-1" as never,userId:"person-a" as never,
        profile:{tenantId:"tenant-1" as never,userId:"person-a" as never} as never};
    },
  }});
  const app=Fastify(); registerHumanMessageRoutes(app,service);
  return {calls,app,service};
}
const head={authorization:"Bearer alice"};
describe("C02 authenticated human DM contract",()=>{
  it("rejects all endpoints without a canonical session",async()=>{
    const {app}=fixture();
    for(const [method,url,payload] of [
      ["POST","/messages/conversations",{recipientUserId:"person-b"}],
      ["GET","/messages/conversations",undefined],
      ["GET","/messages/conversations/conversation-1/messages",undefined],
      ["POST","/messages/conversations/conversation-1/messages",{requestId:"request-123",text:"Hello"}],
    ] as const){
      const res=await app.inject({method,url,...(payload?{payload}:{})});
      expect(res.statusCode).toBe(401);
    }
  });
  it("binds recipient to an authenticated user and rejects self/unknown",async()=>{
    const {app,calls}=fixture();
    const self=await app.inject({method:"POST",url:"/messages/conversations",headers:head,
      payload:{recipientUserId:"person-a"}});
    expect(self.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    const created=await app.inject({method:"POST",url:"/messages/conversations",headers:head,
      payload:{recipientUserId:"person-b"}});
    expect(created.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({name:"start",who:"person-a",
      data:{tenantId:"tenant-1",recipientUserId:"person-b"}});
  });
  it("requires immutable stable requestId and never accepts client sender authority",async()=>{
    const {app,calls}=fixture();
    const injected=await app.inject({method:"POST",url:"/messages/conversations/conversation-1/messages",
      headers:head,payload:{requestId:"request-123",text:"Hello",senderUserId:"person-b"}});
    expect(injected.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    const sent=await app.inject({method:"POST",url:"/messages/conversations/conversation-1/messages",
      headers:head,payload:{requestId:"request-123",text:"Hello"}});
    expect(sent.statusCode).toBe(200);
    const sendCall=calls.find(c=>c.name==="send")!;
    expect(sendCall.who).toBe("person-a");
    expect(sendCall.data).toMatchObject({clientRequestId:"request-123",text:"Hello",tenantId:"tenant-1"});
    expect((sendCall.data as {digest:string}).digest).toMatch(/^[0-9a-f]{64}$/u);
  });
  it("fail-closes unavailable threads and maps rate/idempotency failures",async()=>{
    for(const [options,expected] of [
      [{notFound:true},404],[{rate:true},429],[{conflict:true},409],
    ] as const) {
      const {app}=fixture(options);
      const res=await app.inject({method:"POST",url:"/messages/conversations/conversation-1/messages",
        headers:head,payload:{requestId:"request-123",text:"Hello"}});
      expect(res.statusCode).toBe(expected);
    }
  });
  it("rejects malformed cursor before touching DB and handles empty valid pagination",async()=>{
    const {app,calls}=fixture();
    const bad=await app.inject({method:"GET",
      url:"/messages/conversations/conversation-1/messages?before=bad-value",headers:head});
    expect(bad.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    const valid=Buffer.from(JSON.stringify({t:sample.createdAt,id:sample.messageId})).toString("base64url");
    const ok=await app.inject({method:"GET",
      url:`/messages/conversations/conversation-1/messages?before=${valid}`,headers:head});
    expect(ok.statusCode).toBe(200);
    expect(calls[0]?.data).toMatchObject({before:{at:sample.createdAt,id:sample.messageId}});
  });
  it("edit/delete are sender-bound with revision CAS",async()=>{
    const {app,calls}=fixture();
    const edit=await app.inject({method:"PATCH",
      url:"/messages/conversations/conversation-1/messages/message-1",headers:head,
      payload:{text:"Updated",expectedRevision:1}});
    expect(edit.statusCode).toBe(200);
    expect(edit.json().revision).toBe(2);
    const remove=await app.inject({method:"DELETE",
      url:"/messages/conversations/conversation-1/messages/message-1?expectedRevision=2",headers:head});
    expect(remove.statusCode).toBe(200);
    expect(remove.json()).toMatchObject({text:"",revision:3});
    expect(calls.map(c=>c.name)).toEqual(["edit","remove"]);
  });
});

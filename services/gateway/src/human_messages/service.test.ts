import { describe,it,expect } from "vitest";
import { createHumanDmService } from "./service.js";
import type { HumanDmRepository, HumanDmMessage } from "./model.js";

const cid="11111111-1111-4111-8111-111111111111";
const mid="22222222-2222-4222-8222-222222222222";
const requestId="request_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function fixtures() {
  const sent=new Map<string,{body:string;message:HumanDmMessage}>();
  let blocked=false, allowed=true;
  let lastInput:Record<string,unknown>={};
  const repo:HumanDmRepository={
    async open(input){lastInput=input;return allowed&&!blocked?cid:null;},
    async inbox(input){lastInput=input;return[];},
    async history(input){lastInput=input;return blocked?null:[...sent.values()].map(x=>x.message);},
    async send(input){
      lastInput=input;
      if(!allowed||blocked)return"forbidden";
      const key=input.tenantId+"/"+input.userId+"/"+input.clientRequestId;
      const existing=sent.get(key);
      if(existing)return existing.body===input.body?existing.message:"conflict";
      const message:HumanDmMessage={conversationId:cid,messageId:mid,sequence:"1",
        senderUserId:input.userId,clientRequestId:input.clientRequestId,body:input.body,
        createdAt:"2026-10-08T10:00:00.000Z",editedAt:null,deletedAt:null};
      sent.set(key,{body:input.body,message});return message;
    },
    async edit(){return null;},async remove(){return null;},
    async read(input){lastInput=input;return allowed&&!blocked?"1":null;},
  };
  const service=(actor="user_al",tenant="tenant_1")=>createHumanDmService({
    repository:repo,
    authorizer:{async authorize({authorizationHeader}){
      if(authorizationHeader!=="Bearer valid") throw Object.assign(new Error("auth"),{statusCode:401});
      return{tenantId:tenant,userId:actor} as never;
    }},
  });
  return{service,block:()=>{blocked=true;},revoke:()=>{allowed=false;},last:()=>lastInput};
}
describe("C02 durable human message service",()=>{
  it("requires session token before discovery, history or sending",async()=>{
    const {service}=fixtures();
    await expect(service().open({otherUserId:"user_bo"})).rejects.toMatchObject({statusCode:401});
    await expect(service().history({conversationId:cid})).rejects.toMatchObject({statusCode:401});
    await expect(service().send({conversationId:cid,body:"hello",clientRequestId:requestId})).rejects.toMatchObject({statusCode:401});
  });
  it("derives tenant and sender solely from authorized token",async()=>{
    const {service,last}=fixtures();
    await service("user_al","tenant_2").open({authorizationHeader:"Bearer valid",otherUserId:"user_bo"});
    expect(last()).toEqual({tenantId:"tenant_2",userId:"user_al",otherUserId:"user_bo"});
  });
  it("acknowledges only persisted messages, normalizes text and binds stable retry id",async()=>{
    const {service}=fixtures();
    const client=service();
    const args={authorizationHeader:"Bearer valid",conversationId:cid,clientRequestId:requestId};
    const first=await client.send({...args,body:"  Hello B  "});
    expect(first.body).toBe("Hello B");
    expect((await client.send({...args,body:"Hello B"})).messageId).toBe(first.messageId);
    await expect(client.send({...args,body:"different"})).rejects.toMatchObject({statusCode:409});
  });
  it("rejects spoofing, invalid UTF-8 text semantics and self DM",async()=>{
    const {service}=fixtures();
    const client=service();
    await expect(client.send({authorizationHeader:"Bearer valid",conversationId:cid,clientRequestId:requestId,body:"   "})).rejects.toMatchObject({statusCode:400});
    await expect(client.send({authorizationHeader:"Bearer valid",conversationId:cid,clientRequestId:requestId,body:"\u0000"})).rejects.toMatchObject({statusCode:400});
    await expect(client.send({authorizationHeader:"Bearer valid",conversationId:cid,clientRequestId:"invalid",body:"hello"})).rejects.toMatchObject({statusCode:400});
    await expect(client.history({authorizationHeader:"Bearer valid",conversationId:"not-a-uuid"})).rejects.toMatchObject({statusCode:400});
  });
  it("refuses currently blocked or revoked recipient and hides unavailable history",async()=>{
    const h=fixtures(),client=h.service();
    h.block();
    await expect(client.open({authorizationHeader:"Bearer valid",otherUserId:"user_bo"})).rejects.toMatchObject({statusCode:404});
    await expect(client.history({authorizationHeader:"Bearer valid",conversationId:cid})).rejects.toMatchObject({statusCode:404});
    await expect(client.send({authorizationHeader:"Bearer valid",conversationId:cid,clientRequestId:requestId,body:"hello"})).rejects.toMatchObject({statusCode:404});
  });
  it("returns monotone read cursor, bounded pages and rejects invalid cursor",async()=>{
    const h=fixtures(),c=h.service();
    expect(await c.read({authorizationHeader:"Bearer valid",conversationId:cid,throughSequence:"1"})).toEqual({lastReadSequence:"1"});
    expect(await c.history({authorizationHeader:"Bearer valid",conversationId:cid,limit:40})).toEqual({messages:[],nextBefore:null});
    await expect(c.history({authorizationHeader:"Bearer valid",conversationId:cid,limit:999})).rejects.toMatchObject({statusCode:400});
    await expect(c.read({authorizationHeader:"Bearer valid",conversationId:cid,throughSequence:"-1"})).rejects.toMatchObject({statusCode:400});
  });
});

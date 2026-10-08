import {describe,expect,it} from "vitest";
import {createHumanDmService,HumanDmError} from "./service.js";
import type {HumanDmRepository,DmMessage} from "./model.js";

const a="user_alice", b="user_bob", c="user_eve";
const cid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reqid="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now="2026-10-08T10:00:00.000Z";
const first:DmMessage={conversationId:cid,messageId:mid,sequence:1,
  clientMessageId:reqid,senderUserId:a,text:"Hi Bob",createdAt:now,editedAt:null,deletedAt:null};
function harness() {
  const messages:DmMessage[]=[first];
  let blocked=false;
  const calls:string[]=[];
  const repository:HumanDmRepository={
    async open(x){calls.push("open:"+x.userId);return !blocked&&x.otherUserId===b?cid:null;},
    async list(x){calls.push("list:"+x.userId);return [];},
    async history(x){calls.push("history:"+x.userId);return x.userId===c?null:messages;},
    async send(x){calls.push("send:"+x.userId);if(blocked)return "unavailable";if(x.userId!==a)return "unavailable";
      const existing=messages.find(m=>m.clientMessageId===x.clientMessageId);
      if(existing)return existing.text===x.text?existing:"conflict";
      const next={...first,sequence:messages.length+1,clientMessageId:x.clientMessageId,text:x.text};
      messages.push(next);return next;},
    async read(x){calls.push("read:"+x.userId);return x.userId===c?null:Math.min(x.upToSequence,messages.length);},
    async edit(x){calls.push("edit:"+x.userId);return x.userId===a?{...first,text:x.text}:null;},
    async remove(x){calls.push("remove:"+x.userId);return x.userId===a?{...first,text:null,deletedAt:now}:null;},
  };
  const service=createHumanDmService({repository,authorizer:{
    async authorize({authorizationHeader}) {
      if(!authorizationHeader?.startsWith("Bearer "))throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      const userId=authorizationHeader.substring(7);
      if (![a,b,c].includes(userId)) throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      return {tenantId:"tenant_one" as never,userId:userId as never,profile:{
        tenantId:"tenant_one" as never,userId:userId as never,name:"Person",email:null,phone:null,
        locale:"en",createdAt:now,
      }};
    },
  }});
  return {service,calls,messages,block(){blocked=true}};
}
describe("C02 person-to-person authenticated service",()=>{
  it("rejects missing session before storage and cannot start a DM with oneself",async()=>{
    const h=harness();
    await expect(h.service.open({authorizationHeader:undefined,otherUserId:b})).rejects.toMatchObject({statusCode:401});
    await expect(h.service.open({authorizationHeader:"Bearer "+a,otherUserId:a})).rejects.toBeInstanceOf(HumanDmError);
    expect(h.calls).toEqual([]);
  });
  it("hides unauthorized threads, returns a stable history cursor and bounds paging",async()=>{
    const h=harness();
    await expect(h.service.history({authorizationHeader:"Bearer "+c,conversationId:cid})).rejects.toMatchObject({statusCode:404});
    expect(await h.service.history({authorizationHeader:"Bearer "+b,conversationId:cid,limit:1}))
      .toMatchObject({messages:[{sequence:1}],nextBeforeSequence:1});
    await expect(h.service.history({authorizationHeader:"Bearer "+a,conversationId:cid,limit:500})).rejects.toMatchObject({statusCode:400});
    await expect(h.service.history({authorizationHeader:"Bearer "+a,conversationId:"not-uuid"})).rejects.toMatchObject({statusCode:400});
  });
  it("preserves client idempotency across retries; mismatched reuse is rejected",async()=>{
    const h=harness();
    const args={authorizationHeader:"Bearer "+a,conversationId:cid,clientMessageId:reqid,text:"Hi Bob"};
    expect(await h.service.send(args)).toEqual(first);
    expect(await h.service.send(args)).toEqual(first);
    expect(h.messages).toHaveLength(1);
    await expect(h.service.send({...args,text:"Different"})).rejects.toMatchObject({code:"messages.idempotency_conflict",statusCode:409});
  });
  it("rechecks contact/block policy on every send and forbids other people",async()=>{
    const h=harness();
    h.block();
    await expect(h.service.send({authorizationHeader:"Bearer "+a,conversationId:cid,clientMessageId:reqid,text:"Hi"}))
      .rejects.toMatchObject({statusCode:403});
    await expect(h.service.open({authorizationHeader:"Bearer "+a,otherUserId:b})).rejects.toMatchObject({statusCode:404});
  });
  it("denies edits/deletes by other user and enforces text validation",async()=>{
    const h=harness();
    await expect(h.service.edit({authorizationHeader:"Bearer "+b,conversationId:cid,messageId:mid,text:"spoof"}))
      .rejects.toMatchObject({statusCode:403});
    await expect(h.service.remove({authorizationHeader:"Bearer "+b,conversationId:cid,messageId:mid}))
      .rejects.toMatchObject({statusCode:403});
    await expect(h.service.send({authorizationHeader:"Bearer "+a,conversationId:cid,clientMessageId:reqid,text:"  "}))
      .rejects.toMatchObject({statusCode:400});
    const response=await h.service.remove({authorizationHeader:"Bearer "+a,conversationId:cid,messageId:mid});
    expect(response.deletedAt).toBe(now);
  });
  it("does not allow receipts for arbitrary cursor or nonmembers",async()=>{
    const h=harness();
    await expect(h.service.read({authorizationHeader:"Bearer "+a,conversationId:cid,upToSequence:-1}))
      .rejects.toMatchObject({statusCode:400});
    await expect(h.service.read({authorizationHeader:"Bearer "+c,conversationId:cid,upToSequence:1}))
      .rejects.toMatchObject({statusCode:404});
  });
});

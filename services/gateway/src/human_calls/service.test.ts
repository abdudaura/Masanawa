import {describe,it,expect} from "vitest";
import {createHumanCallService,HumanCallError} from "./service.js";
import type {HumanCall,HumanCallRepository,HumanCallMediaIssuer} from "./service.js";

const call:HumanCall={
  callId:"11111111-1111-4111-8111-111111111111",
  conversationId:"22222222-2222-4222-8222-222222222222",
  callerUserId:"user_a",calleeUserId:"user_b",
  kind:"video",state:"ringing",
  createdAt:"2026-10-09T05:00:00.000Z",answeredAt:null,endedAt:null,
};
function harness() {
  let user="user_a",allowed=true,authorizations=0,issued=0,terminated=0;
  let current=call;
  let startCalls=0,transitionCalls=0,reads=0;
  const repository:HumanCallRepository={
    async start(args) {
      startCalls++;
      if(args.actorId!=="user_a")return "not_allowed";
      return current;
    },
    async transition({actorId,action}) {
      transitionCalls++;
      if(action==="accept"&&actorId!=="user_b")return null;
      if(action==="decline"&&actorId!=="user_b")return null;
      if(action==="end"&&actorId!=="user_a"&&actorId!=="user_b")return null;
      if(action==="accept"&&current.state!=="ringing")return null;
      const state=action==="accept"?"active":action==="decline"?"declined":"ended";
      current={...current,state,answeredAt:state==="active"?"2026-10-09T05:00:01.000Z":current.answeredAt,
        endedAt:state==="active"?null:"2026-10-09T05:00:02.000Z"};
      return current;
    },
    async get({actorId}) {
      reads++;
      return actorId==="user_a"||actorId==="user_b"?current:null;
    },
    async recent(){return [current];},
  };
  const media:HumanCallMediaIssuer={
    async mint({userId}) {
      issued++;
      if(!["user_a","user_b"].includes(userId))throw Error("wrong caller");
      return {server_url:"wss://live.example/",participant_token:"test",
        room_name:"human-call_"+call.callId,participant_identity:"opaque",expires_at:"2099-01-01T00:00:00Z"};
    },
    async terminate(){terminated++;},
  };
  const service=createHumanCallService({
    repository,media,
    authorizer:{async authorize({authorizationHeader}) {
      authorizations++;
      if(authorizationHeader!=="Bearer yes")
        throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
      return {tenantId:"tenant_t",userId:user} as never;
    }},
    admission:{async permitted(){return allowed;}},
  });
  return {service,setUser:(u:string)=>{user=u;},
    setAllowed:(v:boolean)=>{allowed=v;},
    get stats(){return {authorizations,issued,terminated,startCalls,transitionCalls,reads};},
    setCurrent:(c:HumanCall)=>{current=c;},
  };
}
const startReq={authorizationHeader:"Bearer yes",
  conversationId:call.conversationId,requestId:"request_abcdefghijklm",kind:"video"};
describe("C09 one-to-one private calls",()=>{
  it("requires bearer and live pair consent before a DB write",async()=>{
    const h=harness();
    await expect(h.service.start({...startReq,authorizationHeader:undefined}))
      .rejects.toMatchObject({statusCode:401});
    h.setAllowed(false);
    await expect(h.service.start(startReq)).rejects.toMatchObject({
      code:"calls.unavailable",statusCode:404,
    });
    expect(h.stats.startCalls).toBe(0);
  });
  it("never issues media credentials for unanswered rings",async()=>{
    const h=harness();
    expect((await h.service.start(startReq)).state).toBe("ringing");
    await expect(h.service.media({authorizationHeader:"Bearer yes",callId:call.callId}))
      .rejects.toMatchObject({code:"calls.not_active",statusCode:409});
    expect(h.stats.issued).toBe(0);
  });
  it("only the invited callee can accept, then authenticates both media tokens",async()=>{
    const h=harness();
    await expect(h.service.act({authorizationHeader:"Bearer yes",callId:call.callId,action:"accept"}))
      .rejects.toMatchObject({code:"calls.stale_or_forbidden",statusCode:409});
    h.setUser("user_b");
    expect((await h.service.act({authorizationHeader:"Bearer yes",callId:call.callId,action:"accept"})).state)
      .toBe("active");
    const token=await h.service.media({authorizationHeader:"Bearer yes",callId:call.callId});
    expect(token.room_name).toBe("human-call_"+call.callId);
    h.setUser("user_a");
    await h.service.media({authorizationHeader:"Bearer yes",callId:call.callId});
    expect(h.stats.issued).toBe(2);
  });
  it("allows blocked caller to HANG UP without allowing a fresh media token",async()=>{
    const h=harness();
    h.setCurrent({...call,state:"active",answeredAt:"2026-10-09T05:00:01.000Z"});
    h.setAllowed(false);
    await expect(h.service.media({authorizationHeader:"Bearer yes",callId:call.callId}))
      .rejects.toMatchObject({code:"calls.unavailable",statusCode:404});
    expect((await h.service.act({authorizationHeader:"Bearer yes",callId:call.callId,action:"end"})).state)
      .toBe("ended");
    expect(h.stats.terminated).toBe(1);
  });
  it("rejects stranger and invalid request IDs without token issuance",async()=>{
    const h=harness();
    h.setUser("user_c");
    await expect(h.service.get({authorizationHeader:"Bearer yes",callId:call.callId}))
      .rejects.toMatchObject({statusCode:404});
    await expect(h.service.start({...startReq,requestId:"short"}))
      .rejects.toMatchObject({statusCode:400});
    expect(h.stats.issued).toBe(0);
  });
  it("rechecks authorization after media minting",async()=>{
    const h=harness();
    h.setCurrent({...call,state:"active",answeredAt:"2026-10-09T05:00:01.000Z"});
    await h.service.media({authorizationHeader:"Bearer yes",callId:call.callId});
    expect(h.stats.reads).toBeGreaterThanOrEqual(2);
  });
});

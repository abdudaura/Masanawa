import { describe, expect, it } from "vitest";
import { createGatewayApp } from "../app.js";
import { createHumanCallService, type HumanCall } from "./service.js";

const id = "11111111-1111-4111-8111-111111111111";
const thread = "22222222-2222-4222-8222-222222222222";
const invite:HumanCall = {
  callId:id,conversationId:thread,callerUserId:"user_a",calleeUserId:"user_b",
  kind:"audio",state:"ringing",createdAt:"2026-10-09T09:00:00Z",
  answeredAt:null,endedAt:null,
};
function app() {
  let current=invite,issued=0,revocations=0;
  const service=createHumanCallService({
    authorizer:{async authorize({authorizationHeader}) {
      if (authorizationHeader==="Bearer a")
        return {tenantId:"tenant_t",userId:"user_a"} as never;
      if (authorizationHeader==="Bearer b")
        return {tenantId:"tenant_t",userId:"user_b"} as never;
      throw Object.assign(new Error("unauthorized"),{statusCode:401});
    }},
    admission:{async permitted(){return true;}},
    repository:{
      async start(){return current;},
      async get({actorId}){return ["user_a","user_b"].includes(actorId)?current:null;},
      async recent(){return [current];},
      async transition({actorId,action}){
        if(action==="accept" && actorId==="user_b" && current.state==="ringing"){
          current={...current,state:"active",answeredAt:"2026-10-09T09:00:02Z"};
          return current;
        }
        if(action==="end" && current.state==="active") {
          current={...current,state:"ended",endedAt:"2026-10-09T09:00:08Z"};
          return current;
        }
        return null;
      },
    },
    media:{
      async mint({call,userId}){
        issued++;
        return {server_url:"wss://livekit.test/",participant_token:"opaque-token",
          room_name:"human-call_"+call.callId,
          participant_identity:userId,expires_at:"2099-01-01T00:00:00Z"};
      },
      async terminate(){revocations++;},
    },
  });
  const gateway=createGatewayApp({humanCalls:service});
  return {gateway,metrics:()=>({issued,revocations})};
}
describe("C09 registered private-call Gateway routes",()=>{
  it("requires auth, only v1 exists, rejects unauthorized media while ringing",async()=>{
    const x=app();
    try {
      const unauthorized=await x.gateway.inject({
        method:"GET",url:"/v1/messages/calls",
      });
      expect(unauthorized.statusCode).toBe(401);
      const unversioned=await x.gateway.inject({
        method:"GET",url:"/messages/calls",
        headers:{authorization:"Bearer a"},
      });
      expect(unversioned.statusCode).toBe(404);
      const created=await x.gateway.inject({
        method:"POST",url:"/v1/messages/calls",
        headers:{authorization:"Bearer a"},
        payload:{conversationId:thread,requestId:"request_abcdefghijkl",kind:"audio"},
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({callId:id,state:"ringing"});
      const media=await x.gateway.inject({
        method:"POST",url:`/v1/messages/calls/${id}/media-token`,
        headers:{authorization:"Bearer a"},payload:{},
      });
      expect(media.statusCode).toBe(409);
      expect(x.metrics().issued).toBe(0);
    } finally{await x.gateway.close();}
  });

  it("callee accepts first; both media permissions revoked after authenticated hangup",async()=>{
    const x=app();
    try {
      const accept=await x.gateway.inject({
        method:"POST",url:`/v1/messages/calls/${id}/accept`,
        headers:{authorization:"Bearer b"},payload:{},
      });
      expect(accept.statusCode).toBe(200);
      const media=await x.gateway.inject({
        method:"POST",url:`/v1/messages/calls/${id}/media-token`,
        headers:{authorization:"Bearer a"},payload:{},
      });
      expect(media.statusCode).toBe(200);
      expect(media.json().room_name).toBe("human-call_"+id);
      const ended=await x.gateway.inject({
        method:"POST",url:`/v1/messages/calls/${id}/end`,
        headers:{authorization:"Bearer b"},payload:{},
      });
      expect(ended.json()).toMatchObject({state:"ended"});
      expect(x.metrics().revocations).toBe(1);
      const again=await x.gateway.inject({
        method:"POST",url:`/v1/messages/calls/${id}/media-token`,
        headers:{authorization:"Bearer a"},payload:{},
      });
      expect(again.statusCode).toBe(409);
    }finally{await x.gateway.close();}
  });
});

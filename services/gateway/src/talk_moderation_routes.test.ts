import { describe,expect,it } from "vitest";
import Fastify from "fastify";
import { registerTalkModerationRoutes } from "./talk_moderation_routes.js";
import { createTalkModerationService } from "./talk_moderation/service.js";
import type { TalkModerationRepository } from "./talk_moderation/model.js";

function repository():TalkModerationRepository{
  let hand:"idle"|"raised"|"accepted"|"declined"="idle";
  return {
    async participation(){return {handStatus:hand};},
    async setReaction(input){return {handStatus:hand,reaction:input.reaction};},
    async setRaised(input){hand=input.raised?"raised":"idle";return {handStatus:hand};},
    async submitQuestion(input){return {questionId:input.questionId,authorName:input.displayName,body:input.body,status:"pending",createdAt:input.now};},
    async listQuestions(){return [{questionId:"question_1",authorName:"Listener",body:"What changed?",status:"pending",createdAt:"2026-10-07T10:00:00.000Z"}];},
    async resolveQuestion(){return [];},
    async hostControls(){return {requests:[],participants:[{participantId:"host_user_host",displayName:"Host",kind:"human",isHost:true,isMuted:false}]};},
    async actOnRequest(){return {controls:{requests:[],participants:[]},mediaActions:[]};},
    async moderateParticipant(){return {controls:{requests:[],participants:[]},mediaActions:[]};},
    async endTalk(){return {mediaActions:[]};},
  };
}
function app(userId="user_listener"){
  const server=Fastify();
  const service=createTalkModerationService({
    repository:repository(),
    authorizer:{
      async authorize({authorizationHeader}){
        if(authorizationHeader!=="Bearer ok") throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        return {
          tenantId:"tenant_1" as never,userId:userId as never,
          profile:{tenantId:"tenant_1" as never,userId:userId as never,name:"Viewer",email:null,phone:null,locale:"en",createdAt:"2026-10-07T00:00:00.000Z"},
        };
      },
    },
  });
  registerTalkModerationRoutes(server,service);
  return server;
}
describe("Talk participation and moderation routes",()=>{
  it("raises and lowers a free human hand request",async()=>{
    const server=app();
    const raised=await server.inject({method:"POST",url:"/talks/talk_1/raise-hand",headers:{authorization:"Bearer ok"},payload:{raised:true}});
    expect(raised.statusCode).toBe(200);
    expect(raised.json()).toEqual({handStatus:"raised"});
    const lowered=await server.inject({method:"POST",url:"/talks/talk_1/raise-hand",headers:{authorization:"Bearer ok"},payload:{raised:false}});
    expect(lowered.json()).toEqual({handStatus:"idle"});
  });
  it("submits audience questions and exposes a Host-only queue contract",async()=>{
    const submitted=await app().inject({method:"POST",url:"/talks/talk_1/questions",headers:{authorization:"Bearer ok"},payload:{body:" What changed? "}});
    expect(submitted.statusCode).toBe(201);
    expect(submitted.json()).toMatchObject({body:"What changed?",status:"pending"});

    const queue=await app("user_host").inject({method:"GET",url:"/talks/talk_1/host-questions",headers:{authorization:"Bearer ok"}});
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toEqual([
      expect.objectContaining({questionId:"question_1",body:"What changed?",status:"pending"}),
    ]);

    const resolved=await app("user_host").inject({method:"POST",url:"/talks/talk_1/host-questions/question_1",headers:{authorization:"Bearer ok"},payload:{action:"answered"}});
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toEqual([]);
  });
  it("rejects oversized audience questions at the HTTP boundary",async()=>{
    const response=await app().inject({method:"POST",url:"/talks/talk_1/questions",headers:{authorization:"Bearer ok"},payload:{body:"x".repeat(501)}});
    expect(response.statusCode).toBe(400);
  });
  it("allowlists reactions at the HTTP boundary",async()=>{
    const good=await app().inject({method:"POST",url:"/talks/talk_1/reactions",headers:{authorization:"Bearer ok"},payload:{reaction:"👏"}});
    expect(good.statusCode).toBe(200);
    const bad=await app().inject({method:"POST",url:"/talks/talk_1/reactions",headers:{authorization:"Bearer ok"},payload:{reaction:"💣"}});
    expect(bad.statusCode).toBe(400);
  });
});

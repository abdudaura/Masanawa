import { describe,expect,it } from "vitest";
import { createTalkModerationService } from "../talk_moderation/service.js";
import type { TalkModerationRepository } from "../talk_moderation/model.js";

describe("Talk replay Host-end integration",()=>{
  it("finalizes replay only after durable Host End succeeds",async()=>{
    const ended:Array<{tenantId:string;talkId:string;reason:string;now:string}>=[];
    const repository:TalkModerationRepository={
      async participation(){return {handStatus:"idle"};},
      async setReaction(input){return {handStatus:"idle",reaction:input.reaction};},
      async setRaised(){return {handStatus:"idle"};},
      async leaveHumanSeat(){throw new Error("unexpected seat leave");},
      async submitQuestion(){throw new Error("unexpected question submission");},
      async listQuestions(){throw new Error("unexpected question listing");},
      async resolveQuestion(){throw new Error("unexpected question resolution");},
      async inviteHuman(){throw new Error("unexpected invitation");},
      async respondHumanInvitation(){throw new Error("unexpected invitation response");},
      async hostControls(){return {requests:[],participants:[]};},
      async actOnRequest(){return {controls:{requests:[],participants:[]},mediaActions:[]};},
      async moderateParticipant(){return {controls:{requests:[],participants:[]},mediaActions:[]};},
      async endTalk(){return {mediaActions:[]};},
    };
    const service=createTalkModerationService({
      repository,
      now:()=>"2026-10-07T10:10:00.000Z",
      authorizer:{
        async authorize(){
          return {
            tenantId:"tenant_1" as never,userId:"host_1" as never,
            profile:{tenantId:"tenant_1" as never,userId:"host_1" as never,name:"Host",email:null,phone:null,locale:"en",createdAt:"2026-10-07T00:00:00.000Z"},
          };
        },
      },
      onTalkEnded:async input=>{ended.push(input);},
    });

    await service.end({authorizationHeader:"Bearer host",talkId:"talk_1"});
    expect(ended).toEqual([{
      tenantId:"tenant_1",talkId:"talk_1",reason:"host_ended",now:"2026-10-07T10:10:00.000Z",
    }]);
  });
});

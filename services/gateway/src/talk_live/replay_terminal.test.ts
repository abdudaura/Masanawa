import { describe, expect, it } from "vitest";
import { createTalkLiveService } from "./service.js";
import type { TalkLiveRepository } from "./model.js";

describe("Talk live replay terminal hook", () => {
  it("finalizes replay when reconnect grace has expired", async () => {
    const finalized:Array<{tenantId:string;talkId:string;reason:string;now:string}>=[];
    const repository:TalkLiveRepository={
      async connect(){return null;},
      async heartbeat(){return null;},
      async disconnect(){return null;},
      async state(input){
        return {
          talkId:input.talkId,
          state:"ended",
          hostConnected:false,
          listenerCount:2,
          aiGenerationAllowed:false,
          reconnectGraceEndsAt:null,
          endReason:"host_grace_expired",
        };
      },
    };
    const service=createTalkLiveService({
      repository,
      now:()=>"2026-10-07T10:00:30.000Z",
      authorizer:{
        async authorize(){
          return {
            tenantId:"tenant_1" as never,
            userId:"viewer_1" as never,
            profile:{
              tenantId:"tenant_1" as never,
              userId:"viewer_1" as never,
              name:"Viewer",
              email:null,
              phone:null,
              locale:"en",
              createdAt:"2026-10-07T00:00:00.000Z",
            },
          };
        },
      },
      onTalkEnded:async input=>{finalized.push(input);},
    });

    const state=await service.state({
      authorizationHeader:"Bearer viewer",
      talkId:"talk_1",
    });

    expect(state).toMatchObject({
      state:"ended",
      endReason:"host_grace_expired",
    });
    expect(finalized).toEqual([{
      tenantId:"tenant_1",
      talkId:"talk_1",
      reason:"host_grace_expired",
      now:"2026-10-07T10:00:30.000Z",
    }]);
  });
});

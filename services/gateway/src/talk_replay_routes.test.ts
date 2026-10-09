import { describe,expect,it } from "vitest";
import Fastify from "fastify";
import { registerTalkReplayRoutes } from "./talk_replay_routes.js";
import { createTalkReplayService } from "./talk_replay/service.js";
import type { TalkReplayHostView, TalkReplayRepository } from "./talk_replay/model.js";

function repository():TalkReplayRepository{
  let state:TalkReplayHostView={
    talkId:"talk_1",recordingId:"recording_1",
    recordingState:"recording",publicationState:"not_ready",
    publicationPreference:"publish",segmentCount:0,durationSeconds:0,revision:1,
    isPublic:false,startedAt:"2026-10-07T10:00:00.000Z",
  };
  return {
    async start(){return state;},
    async hostView(){return state;},
    async hostAction(input){
      state={...state,publicationState:input.action==="publish"?"published":"private",isPublic:input.action==="publish",revision:state.revision+1};
      return state;
    },
    async appendSegment(){return state;},
    async finalizeFromLive(){return state;},
    async platformBlock(){return state;},
    async myTalks(){return {live:[],replays:[]};},
  };
}
function app(){
  const server=Fastify();
  const service=createTalkReplayService({
    repository:repository(),
    createRecordingId:()=>"recording_1",
    now:()=>"2026-10-07T10:00:00.000Z",
    coordinator:{
      async start(){},
      async finalize(){},
      async abort(){},
      async playback(){
        return {url:"https://signed.example/replay.ogg",expiresAt:"2026-10-07T10:05:00.000Z",contentType:"audio/ogg"};
      },
    },
    authorizer:{
      async authorize({authorizationHeader}){
        if(authorizationHeader!=="Bearer host") throw Object.assign(new Error("UNAUTHORIZED"),{statusCode:401});
        return {
          tenantId:"tenant_1" as never,userId:"user_host" as never,
          profile:{tenantId:"tenant_1" as never,userId:"user_host" as never,name:"Host",email:null,phone:null,locale:"en",createdAt:"2026-10-07T00:00:00.000Z"},
        };
      },
    },
  });
  registerTalkReplayRoutes(server,service);
  return server;
}
describe("Talk replay routes",()=>{
  it("starts recording only with explicit Host consent contract",async()=>{
    const response=await app().inject({
      method:"POST",url:"/talks/talk_1/replay/recording",
      headers:{authorization:"Bearer host"},
      payload:{consent:true,publicationPreference:"publish"},
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({recordingId:"recording_1",recordingState:"recording"});
  });
  it("returns short-lived playback delivery without storage credentials",async()=>{
    const response=await app().inject({
      method:"GET",url:"/talks/talk_1/replay/playback",headers:{authorization:"Bearer host"},
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
    expect(response.headers["pragma"]).toBe("no-cache");
    expect(response.headers["vary"]).toBe("Authorization");
    expect(response.json()).toEqual({
      url:"https://signed.example/replay.ogg",
      expiresAt:"2026-10-07T10:05:00.000Z",
      contentType:"audio/ogg",
    });
  });

  it("never serves a signed replay credential without a verified session",async()=>{
    const response=await app().inject({
      method:"GET",url:"/talks/talk_1/replay/playback",
    });
    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain("https://signed.example/");
    expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
  });

  it("serves the My Talks library contract",async()=>{
    const response=await app().inject({method:"GET",url:"/me/talks",headers:{authorization:"Bearer host"}});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({live:[],replays:[]});
  });
});


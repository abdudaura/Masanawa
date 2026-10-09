import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerReplayInsightRoutes } from "./routes.js";
import { ReplayInsightError, type ReplayInsightService } from "./service.js";

function setup() {
  const calls: Array<{ talkId:string; authorizationHeader:string|undefined }> = [];
  const service: ReplayInsightService = {
    async read(input) {
      calls.push(input);
      if(input.authorizationHeader!=="Bearer host") {
        throw new ReplayInsightError("unauthorized",401);
      }
      return null;
    },
    async request(input) {
      calls.push(input);
      if(input.authorizationHeader!=="Bearer host") {
        throw new ReplayInsightError("unauthorized",401);
      }
      return {
        talkId:input.talkId,recordingId:"recording_1",status:"processing",
        summary:null,highlights:[],nextTalkTitle:null,
        updatedAt:"2026-10-09T01:00:00.000Z",
      };
    },
  };
  const app=Fastify();
  registerReplayInsightRoutes(app,service);
  return {app,calls};
}
describe("U16 isolated Host-only routes",()=>{
  it("does not fabricate insights if no eligible recording exists",async()=>{
    const {app}=setup();
    const result=await app.inject({
      method:"GET",url:"/talks/talk_1/post-session/insights",
      headers:{authorization:"Bearer host"},
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toBeNull();
    await app.close();
  });
  it("requires explicitly true, schema-valid recording-processing consent",async()=>{
    const {app,calls}=setup();
    const response=await app.inject({
      method:"POST",url:"/talks/talk_1/post-session/insights",
      headers:{authorization:"Bearer host"},
      payload:{processingConsent:false},
    });
    expect(response.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    await app.close();
  });
  it("passes only verified bearer header and bounded talk path to service",async()=>{
    const {app,calls}=setup();
    const response=await app.inject({
      method:"POST",url:"/talks/talk_1/post-session/insights",
      headers:{authorization:"Bearer host"},
      payload:{processingConsent:true},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({status:"processing",recordingId:"recording_1"});
    expect(calls).toMatchObject([{
      authorizationHeader:"Bearer host",talkId:"talk_1",processingConsent:true,
    }]);
    const bad=await app.inject({
      method:"POST",url:"/talks/talk_1/post-session/insights",
      headers:{authorization:"Bearer outsider"},
      payload:{processingConsent:true},
    });
    expect(bad.statusCode).toBe(401);
    await app.close();
  });
});

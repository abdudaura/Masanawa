import {describe,expect,it,vi} from "vitest";
import type {TeacherJob} from "@masanawa/rooms";
import {createGeminiRoomAnswerModel} from "./gemini_room_model.js";
const job:TeacherJob={outboxId:"outbox-event_1",tenantId:"tenant_1",
 questionId:"room-question_1",roomId:"room_1",fence:1,
 question:"What is 2+2?",professionTitle:"Mathematics",language:"en"};
const success=(body="4")=>new Response(JSON.stringify({
 candidates:[{content:{parts:[{text:body}]}}],
}),{status:200,headers:{"content-type":"application/json"}});
describe("Gemini Room question answer delivery",()=>{
 it("requires a server-held provider key rather than quietly routing to review",()=>{
   expect(()=>createGeminiRoomAnswerModel({})).toThrow("rooms_ai.credentials_required");
 });
 it("submits the real queued question and directly returns a model answer",async()=>{
   const fetchImpl=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>success());
   const model=createGeminiRoomAnswerModel({credentialsJson:JSON.stringify({
     credentials:[{apiKey:"example-test-secret-key-111111"}],
   }),models:'["gemini-2.5-flash"]',fetchImpl});
   expect(await model.generate(job)).toBe("4");
   expect(fetchImpl).toHaveBeenCalledTimes(1);
   const [url,opts]=fetchImpl.mock.calls[0]!;
   expect(url).toContain("gemini-2.5-flash:generateContent");
   expect(new Headers(opts?.headers).get("x-goog-api-key")).toBe("example-test-secret-key-111111");
   const body=JSON.parse(opts?.body as string);
   expect(JSON.stringify(body.contents)).toContain("What is 2+2?");
   expect(JSON.stringify(body.system_instruction)).not.toContain("staff approval required");
 });
 it("rotates configured server credentials when Gemini returns temporary 429",async()=>{
   const fetchImpl=vi.fn().mockResolvedValueOnce(new Response("",{status:429}))
    .mockResolvedValueOnce(success("The answer is four."));
   const model=createGeminiRoomAnswerModel({
     credentialsJson:JSON.stringify([{apiKey:"first-secret-key-111111111"},{apiKey:"second-secret-key-222222222"}]),
     models:"gemini-2.5-flash",fetchImpl,
   });
   expect(await model.generate(job)).toContain("four");
   expect(fetchImpl).toHaveBeenCalledTimes(2);
 });
 it("never pretends a rejected, empty or offline response is an answer",async()=>{
   const missing=vi.fn(async()=>new Response("",{status:503}));
   const model=createGeminiRoomAnswerModel({apiKey:"example-test-secret-key-111111",fetchImpl:missing});
   await expect(model.generate(job)).rejects.toThrow("rooms_ai.provider_unavailable");
   const empty=createGeminiRoomAnswerModel({apiKey:"example-test-secret-key-111111",fetchImpl:async()=>success("   ")});
   await expect(empty.generate(job)).rejects.toThrow("rooms_ai.provider_unavailable");
 });
 it("does not send malformed or missing tenant-bound questions to Gemini",async()=>{
   const fetchImpl=vi.fn();
   const model=createGeminiRoomAnswerModel({apiKey:"example-test-secret-key-111111",fetchImpl});
   await expect(model.generate({...job,question:""})).rejects.toThrow("rooms_ai.question_invalid");
   expect(fetchImpl).not.toHaveBeenCalled();
 });
});

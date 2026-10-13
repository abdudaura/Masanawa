import {describe,it,expect,vi} from "vitest";
import {createRoomTeacherWorker} from "./teacher.js";
const job={outboxId:"outbox-event_1",tenantId:"tenant_1",
 questionId:"room-question_1",roomId:"room_1",fence:1,
 question:"What is algebra?",professionTitle:"Mathematics",language:"en"};
describe("durable Rooms direct AI teacher",()=>{
 it("does not claim while draining",async()=>{
   const claim=vi.fn();
   const w=createRoomTeacherWorker({claim,publish:vi.fn(),fail:vi.fn()},{generate:vi.fn()},"worker1",()=>false);
   expect(await w.tick()).toBe("disabled");
   expect(claim).not.toHaveBeenCalled();
 });
 it("delivers generated answers straight into the canonical journal",async()=>{
   const publish=vi.fn();
   const generate=vi.fn(async()=>"Algebra works with variables.");
   const w=createRoomTeacherWorker({claim:async()=>job,publish,fail:vi.fn()},
    {generate},"worker1",()=>true);
   expect(await w.tick()).toBe("processed");
   expect(generate).toHaveBeenCalledWith(job);
   expect(publish).toHaveBeenCalledWith(job,"Algebra works with variables.");
 });
 it("retries unavailable or empty models without losing user questions",async()=>{
   const fail=vi.fn(),publish=vi.fn();
   const w=createRoomTeacherWorker({claim:async()=>job,publish,fail},
    {generate:async()=>{throw Error("provider_offline");}},"worker1",()=>true);
   expect(await w.tick()).toBe("retry");
   expect(fail).toHaveBeenCalledWith(job,"temporary_failure");
   const empty=createRoomTeacherWorker({claim:async()=>job,publish,fail},
    {generate:async()=>""},"worker1",()=>true);
   expect(await empty.tick()).toBe("retry");
   expect(publish).not.toHaveBeenCalled();
 });
});

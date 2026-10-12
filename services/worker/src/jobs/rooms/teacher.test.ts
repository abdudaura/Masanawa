import {describe,it,expect,vi} from "vitest";
import {createRoomTeacherWorker} from "./teacher.js";
const job={outboxId:"outbox-event_1",tenantId:"tenant_1",questionId:"room-question_1",roomId:"room_1",fence:1};
describe("durable teacher queue",()=>{
 it("does not claim when paused",async()=>{
   const claim=vi.fn();const w=createRoomTeacherWorker({claim,draft:vi.fn(),fail:vi.fn()},{generate:vi.fn()},"worker1",()=>false);
   expect(await w.tick()).toBe("disabled");expect(claim).not.toHaveBeenCalled();
 });
 it("does not lose the lone member question when no AI response exists",async()=>{
   const draft=vi.fn();const w=createRoomTeacherWorker({claim:async()=>job,draft,fail:vi.fn()},{generate:async()=>null},"worker1",()=>true);
   expect(await w.tick()).toBe("processed");expect(draft).toHaveBeenCalledWith(job,null);
 });
 it("reschedules transient failures using the same outbox identity",async()=>{
   const fail=vi.fn();const w=createRoomTeacherWorker({claim:async()=>job,draft:vi.fn(),fail},{generate:async()=>{throw Error("offline");}},"worker1",()=>true);
   expect(await w.tick()).toBe("retry");expect(fail).toHaveBeenCalledWith(job,"temporary_failure");
 });
});

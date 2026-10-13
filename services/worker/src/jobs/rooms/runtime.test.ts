import {afterEach,describe,expect,it,vi} from "vitest";
import type {TeacherJob,TeacherQueue} from "@masanawa/rooms";
import {createRoomTeacherRuntime} from "./runtime.js";
const job:TeacherJob={outboxId:"outbox-event_1",tenantId:"tenant_1",
 roomId:"room_1",questionId:"room-question_1",fence:2,
 question:"Why is the sky blue?",professionTitle:"Science",language:"en"};
const loops:Array<ReturnType<typeof createRoomTeacherRuntime>>=[];
afterEach(async()=>{await Promise.all(loops.splice(0).map(r=>r.stop()));vi.useRealTimers();});
function loop(queue:TeacherQueue,enabled=()=>true,intervalMs=1000){
 const r=createRoomTeacherRuntime({queue,workerId:"teacher-1",
 model:{generate:async()=>"Rayleigh scattering."},enabled,intervalMs});
 loops.push(r);return r;
}
describe("automatically scheduled AI Rooms question worker",()=>{
 it("does not claim while the service is draining",async()=>{
   const queue={claim:vi.fn(),publish:vi.fn(),fail:vi.fn()};
   const r=loop(queue,()=>false);
   expect(await r.tick()).toBe("disabled");
   r.start();expect(queue.claim).not.toHaveBeenCalled();
 });
 it("directly publishes generated answers without staff queues",async()=>{
   const queue={claim:vi.fn(async()=>job),publish:vi.fn(async()=>undefined),fail:vi.fn()};
   expect(await loop(queue).tick()).toBe("processed");
   expect(queue.publish).toHaveBeenCalledWith(job,"Rayleigh scattering.");
   expect(queue.fail).not.toHaveBeenCalled();
 });
 it("does not race concurrent claims while a question is being answered",async()=>{
   let release:(()=>void)|undefined;
   const blocked=new Promise<void>(resolve=>{release=resolve;});
   const queue={claim:vi.fn(async()=>{await blocked;return job;}),
     publish:vi.fn(async()=>undefined),fail:vi.fn()};
   const r=loop(queue),first=r.tick();
   expect(await r.tick()).toBe("busy");
   expect(queue.claim).toHaveBeenCalledTimes(1);
   release?.();expect(await first).toBe("processed");
 });
 it("retries a failed PostgreSQL publication on the same outbox",async()=>{
   const fail=vi.fn();
   const queue={claim:vi.fn(async()=>job),publish:vi.fn(async()=>{throw Error("outage");}),fail};
   expect(await loop(queue).tick()).toBe("retry");
   expect(fail).toHaveBeenCalledWith(job,"temporary_failure");
 });
 it("waits for in-flight work on shutdown",async()=>{
   let release:(()=>void)|undefined;
   const blocked=new Promise<void>(resolve=>{release=resolve;});
   const queue={claim:vi.fn(async()=>{await blocked;return job;}),
     publish:vi.fn(async()=>undefined),fail:vi.fn()};
   const r=loop(queue),first=r.tick(),stop=r.stop();
   expect(await r.tick()).toBe("disabled");
   release?.();await stop;expect(await first).toBe("processed");
 });
 it("polls while running but never after drain",async()=>{
   vi.useFakeTimers();let enabled=true;
   const queue={claim:vi.fn(async()=>null),publish:vi.fn(),fail:vi.fn()};
   const r=loop(queue,()=>enabled);r.start();
   await vi.advanceTimersByTimeAsync(1000);expect(queue.claim).toHaveBeenCalledTimes(1);
   enabled=false;await vi.advanceTimersByTimeAsync(1000);
   expect(queue.claim).toHaveBeenCalledTimes(1);
   await r.stop();enabled=true;await vi.advanceTimersByTimeAsync(3000);
   expect(queue.claim).toHaveBeenCalledTimes(1);
 });
 it("does not permit a hot-loop interval",()=>{
   expect(()=>createRoomTeacherRuntime({queue:{claim:vi.fn(),publish:vi.fn(),fail:vi.fn()},
     model:{generate:async()=>""},workerId:"worker",enabled:()=>true,intervalMs:0}))
    .toThrow("rooms_worker_interval_invalid");
 });
});

import {describe,it,expect} from "vitest";
import {RoomError,validateQuestion,validateIdempotencyKey,requireRoomStaff} from "./index.js";
describe("L-ROOMS free authority",()=>{
 it("rejects invalid bodies and control bytes",()=>{
   for(const x of ["", "   ", "x".repeat(2001), "valid\u0000text", null])
     expect(()=>validateQuestion(x)).toThrow(RoomError);
   expect(validateQuestion("  What is the next lesson?  ")).toBe("What is the next lesson?");
   expect(validateQuestion(" x ")).toBe("x");
 });
 it("enforces idempotency and prevents short replay keys",()=>{
   expect(()=>validateIdempotencyKey("short")).toThrow(RoomError);
   expect(validateIdempotencyKey("sourcegeneratedkey_001")).toBe("sourcegeneratedkey_001");
 });
 it("denies a fan and allows a staff editor",()=>{
   expect(()=>requireRoomStaff(["fan"])).toThrow(RoomError);
   expect(()=>requireRoomStaff([])).toThrow(RoomError);
   expect(()=>requireRoomStaff(["rooms_editor"])).not.toThrow();
 });
});

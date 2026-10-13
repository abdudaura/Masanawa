import {describe,it,expect} from "vitest";
import {RoomError} from "./index.js";
import {validateDiscussionBody,validateDiscussionTarget,validateDiscussionCursor,requireDiscussionModerator} from "./discussion.js";
describe("C39 moderated discussion canonical contracts",()=>{
 it("requires a real lesson or question target, never a fan profile",()=>{
  expect(validateDiscussionTarget("lesson","room-lesson_aabbccdd")).toEqual({kind:"lesson",id:"room-lesson_aabbccdd"});
  expect(()=>validateDiscussionTarget("fan","user_12345678")).toThrow(RoomError);
  expect(()=>validateDiscussionTarget("question","room-lesson_aabbccdd")).toThrow(RoomError);
 });
 it("bounds the body and rejects control characters",()=>{
  expect(validateDiscussionBody("  Hello, room  ")).toBe("Hello, room");
  expect(()=>validateDiscussionBody(" ")).toThrow(RoomError);
  expect(()=>validateDiscussionBody("a".repeat(2001))).toThrow(RoomError);
  expect(()=>validateDiscussionBody("hello\u0000there")).toThrow(RoomError);
 });
 it("rejects forged pagination and accepts tied ordered cursors",()=>{
  expect(validateDiscussionCursor("2026-10-11T04:00:00.000Z|room-reply_aabbccdd")).toEqual({
   before:"2026-10-11T04:00:00.000Z",beforeId:"room-reply_aabbccdd"});
  expect(()=>validateDiscussionCursor("../../not-a-cursor")).toThrow(RoomError);
 });
 it("prevents fan moderation even when their membership is active",()=>{
  expect(()=>requireDiscussionModerator(["fan"])).toThrow(RoomError);
  expect(()=>requireDiscussionModerator(["content_editor"])).toThrow(RoomError);
  expect(()=>requireDiscussionModerator(["moderator"])).not.toThrow();
 });
});

import {describe,it,expect,vi} from "vitest";
import {deliverRoomAnswerNotice} from "./notifications.js";
const event={tenantId:"tenant_t",eventId:"event_a",userId:"user_a",
 roomId:"room_a",questionId:"room-question_a"};
describe("room answer notification",()=>{
 it("denies unapproved event shapes and never exposes unrelated fan data",async()=>{
   const send=vi.fn();
   await expect(deliverRoomAnswerNotice({...event,eventId:"invalid"}, {send},true)).rejects.toThrow();
   expect(send).not.toHaveBeenCalled();
 });
 it("does not send while disabled",async()=>{
   const send=vi.fn();
   expect(await deliverRoomAnswerNotice(event,{send},false)).toBe("disabled");
   expect(send).not.toHaveBeenCalled();
 });
 it("reuses stable outbox event as idempotency key",async()=>{
   const send=vi.fn();
   expect(await deliverRoomAnswerNotice(event,{send},true)).toBe("sent");
   expect(send).toHaveBeenCalledWith({...event,dedupeKey:"event_a"});
 });
});

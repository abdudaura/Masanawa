import {describe,it,expect,vi} from "vitest";
import {deliverRoomDiscussionNotice} from "./discussion.js";
const e={tenantId:"tenant_a",eventId:"event_1",replyId:"room-reply_a",roomId:"room_a",recipientUserId:"fan_1",senderUserId:"fan_2"};
describe("moderated discussion notice",()=>{
 it("cannot deliver behind default-off feature gate",async()=>{
  const send=vi.fn(async()=>{});
  expect(await deliverRoomDiscussionNotice(e,{send},()=>false)).toBe("disabled");
  expect(send).not.toHaveBeenCalled();
 });
 it("does not notify a commenter about their own reply",async()=>{
  const send=vi.fn(async()=>{});
  expect(await deliverRoomDiscussionNotice({...e,recipientUserId:"fan_2"},{send},()=>true)).toBe("ignored");
  expect(send).not.toHaveBeenCalled();
 });
 it("uses canonical event id for dedupe",async()=>{
  const send=vi.fn(async()=>{});
  expect(await deliverRoomDiscussionNotice(e,{send},()=>true)).toBe("sent");
  expect(send).toHaveBeenCalledWith({...e,dedupeKey:"event_1"});
 });
});

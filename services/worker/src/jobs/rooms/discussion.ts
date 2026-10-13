/** Uses the existing events.outbox dispatcher for ACK, lease, retry and dedupe.
 * Never sends an unapproved/held discussion reply or addresses other fans directly. */
export interface DiscussionApprovedEvent {
  tenantId:string;eventId:string;replyId:string;roomId:string;
  recipientUserId:string;senderUserId:string;
}
export interface DiscussionNotificationPort {
  send(event:DiscussionApprovedEvent & {dedupeKey:string}):Promise<void>;
}
export async function deliverRoomDiscussionNotice(
  event:DiscussionApprovedEvent,send:DiscussionNotificationPort,enabled:()=>boolean
):Promise<"disabled"|"ignored"|"sent"> {
  if(!enabled())return "disabled";
  if(!event.tenantId || !event.eventId.startsWith("event_") ||
    !event.replyId.startsWith("room-reply_") || !event.roomId.startsWith("room_") ||
    !event.recipientUserId || !event.senderUserId)throw new Error("invalid_discussion_notice");
  if(event.recipientUserId===event.senderUserId)return "ignored";
  await send.send({...event,dedupeKey:event.eventId});
  return "sent";
}

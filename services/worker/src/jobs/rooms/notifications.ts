/** Handler to compose into canonical events.outbox dispatcher; delivery receipt is its responsibility. */
export interface ApprovedRoomAnswerEvent {
  readonly tenantId:string;readonly eventId:string;readonly userId:string;
  readonly roomId:string;readonly questionId:string;
}
export interface RoomNotificationSender {
  send(input:ApprovedRoomAnswerEvent & {readonly dedupeKey:string}):Promise<void>;
}
export async function deliverRoomAnswerNotice(
  event:ApprovedRoomAnswerEvent,sender:RoomNotificationSender,enabled:boolean
):Promise<"disabled"|"sent">{
  if(!enabled)return "disabled";
  if(!event.tenantId.startsWith("tenant_")||!event.userId||
     !event.questionId.startsWith("room-question_")||!event.eventId.startsWith("event_"))
    throw new Error("invalid_rooms_notification_event");
  await sender.send({...event,dedupeKey:event.eventId});
  return "sent";
}

/** Canonical v1 L-ROOMS/free domain contract. Paid rooms fail closed until Play verification. */
export type RoomState = "draft"|"published"|"paused"|"retired";
export type QuestionState = "queued"|"answering"|"needs_staff"|"answered"|"rejected";
export type QuestionReview = "draft"|"approved"|"rejected";
export interface RoomPreview {
  roomId:string; slug:string; professionTitle:string; teacherCharacterId:string;
  language:string; planMode:"free"|"paid"; state:RoomState;
  memberCount:number; joined:boolean;
}
export interface RoomQuestion {
  questionId:string; roomId:string; body:string; state:QuestionState;
  queuedAt:string; answer:string|null;
}
export class RoomError extends Error {
  constructor(public readonly status:number,public readonly code:string,message=code){super(message);}
}
export function validateQuestion(raw:unknown):string {
  if(typeof raw!=="string") throw new RoomError(422,"invalid_question");
  const body=raw.trim();
  if(body.length<4||body.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(body))
    throw new RoomError(422,"invalid_question");
  return body;
}
export function validateIdempotencyKey(raw:unknown):string {
  if(typeof raw!=="string"||!/^[A-Za-z0-9_-]{16,120}$/u.test(raw))
    throw new RoomError(422,"idempotency_required");
  return raw;
}
export function requireRoomStaff(roles:readonly string[]|undefined):void {
  if(!roles?.some(r=>r==="platform_admin"||r==="rooms_editor"||r==="rooms_moderator"))
    throw new RoomError(403,"staff_role_required");
}
export function requireFan(userId:string|null):string {
  if(!userId) throw new RoomError(401,"authentication_required");
  return userId;
}
export * from "./subscriptions.js";
export * from "./discussion.js";

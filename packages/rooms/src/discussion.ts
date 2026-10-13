import { RoomError, validateIdempotencyKey } from "./index.js";
export type DiscussionTarget = "lesson" | "question";
export type DiscussionDecision = "approve" | "hide" | "remove";
export type DiscussionState = "held" | "visible" | "hidden" | "removed";
export interface DiscussionReply {
  replyId: string; roomId: string; parentKind: DiscussionTarget; parentId: string;
  parentReplyId: string | null; body: string; state: DiscussionState;
  authoredByMe: boolean; createdAt: string;
}
export interface DiscussionPage { items: DiscussionReply[]; nextCursor: string | null; }
export interface DiscussionCursor { before: string; beforeId: string; }
export function validateDiscussionBody(raw: unknown): string {
  if (typeof raw !== "string") throw new RoomError(422, "invalid_reply");
  const body = raw.trim();
  if (!body || body.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(body))
    throw new RoomError(422, "invalid_reply");
  return body;
}
export function validateDiscussionTarget(kind: unknown, id: unknown): {kind:DiscussionTarget;id:string} {
  if ((kind !== "lesson" && kind !== "question") ||
      typeof id !== "string" ||
      !new RegExp(kind === "lesson" ? "^room-lesson_[A-Za-z0-9_-]{8,120}$" : "^room-question_[A-Za-z0-9_-]{8,120}$").test(id))
    throw new RoomError(422, "invalid_discussion_target");
  return {kind,id};
}
export function validateDiscussionCursor(raw: unknown): DiscussionCursor | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 200) throw new RoomError(422, "invalid_cursor");
  const sep=raw.indexOf("|");
  const before=raw.slice(0,sep), beforeId=raw.slice(sep+1);
  if (sep<0 || !Number.isFinite(Date.parse(before)) || !/^room-reply_[A-Za-z0-9_-]{8,120}$/.test(beforeId))
    throw new RoomError(422, "invalid_cursor");
  return {before,beforeId};
}
export function requireDiscussionModerator(roles:readonly string[]):void {
  if (!roles.some(r=>["platform_admin","rooms_moderator","moderator","room_manager","super_admin"].includes(r)))
    throw new RoomError(403,"room_moderator_required");
}
export { validateIdempotencyKey };

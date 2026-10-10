/** J13: the single new Masana-only moderation case contract (no legacy Talk authority). */
export const caseTargets = ["post", "comment", "room_reply", "video", "transaction", "account"] as const;
export const caseCategories = ["spam", "harassment", "unsafe", "copyright", "fraud", "other"] as const;
export const caseStates = ["open", "investigating", "action_proposed", "awaiting_review", "actioned", "dismissed", "appealed", "closed"] as const;
export const actionKinds = ["hide_comment", "rate_limit", "room_mute", "user_ban", "user_unban"] as const;
export type CaseTarget = typeof caseTargets[number];
export type CaseCategory = typeof caseCategories[number];
export type CaseState = typeof caseStates[number];
export type ActionKind = typeof actionKinds[number];
export type Actor = Readonly<{tenantId:string;userId:string;roles:readonly string[];kind:"fan"|"staff"|"gwani"}>;
export type CaseRecord = Readonly<{
  tenantId:string;caseId:string;reporterUserId:string;targetKind:CaseTarget;targetId:string;
  category:CaseCategory;details:string;state:CaseState;version:number;
  slaDueAt:string;createdAt:string;updatedAt:string;
}>;
export type AppealRecord = Readonly<{
 tenantId:string;appealId:string;caseId:string;appellantUserId:string;reason:string;
 state:"pending"|"under_review"|"upheld"|"rejected";reviewedBy:string|null;
 secondReviewedBy:string|null;version:number;createdAt:string;
}>;
export type CaseEvent = Readonly<{eventId:string;caseId:string;type:string;actorId:string;createdAt:string;details:string}>;
export type ActionRecord = Readonly<{
  tenantId:string;actionId:string;caseId:string;targetKind:CaseTarget;targetId:string;
  kind:ActionKind;state:"proposed"|"approved"|"rejected"|"applied"|"failed"|"reversed";
  reason:string;proposedBy:string;approvedBy:string|null;secondApprovedBy:string|null;
  expiresAt:string|null;version:number;
}>;
export class CaseError extends Error {
  constructor(readonly code:string,readonly statusCode:number){super(code);this.name="CaseError";}
}
export function required(value:unknown,name:string,max=512):string{
  if(typeof value!=="string")throw new CaseError(name+".invalid",400);
  const s=value.trim();if(!s||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(s))
    throw new CaseError(name+".invalid",400);
  return s;
}
export function choice<T extends string>(value:unknown,values:readonly T[],name:string):T {
  if(typeof value!=="string"||!values.includes(value as T))throw new CaseError(name+".invalid",400);
  return value as T;
}
export function requireModerator(actor:Actor):void{
  if(actor.kind!=="staff"||!actor.roles.some(r=>r==="moderator"||r==="super_admin"))
    throw new CaseError("moderation.forbidden",403);
}
export function requireCaseViewer(actor:Actor,record:CaseRecord):void {
  if(actor.tenantId!==record.tenantId)throw new CaseError("moderation.not_found",404);
  if(actor.userId!==record.reporterUserId && actor.kind!=="gwani" && !(actor.kind==="staff" && actor.roles.some(r=>r==="moderator"||r==="super_admin")))
    throw new CaseError("moderation.not_found",404);
}
export function assertActionTarget(kind:ActionKind,target:CaseTarget):void{
  const compatible=(kind==="hide_comment"&&target==="comment")||
    (kind==="room_mute"&&target==="room_reply")||
    (kind==="rate_limit"&&["post","comment","room_reply","account"].includes(target))||
    (["user_ban","user_unban"].includes(kind)&&target==="account");
  if(!compatible)throw new CaseError("moderation.action_target.invalid",400);
}
/** Gwani may propose, but never authorizes bans or money operations. */
export function decisionRequiredApprovals(kind:ActionKind):number{
  return kind==="user_ban"||kind==="user_unban"?2:1;
}

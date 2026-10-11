import type {ActionRecord} from "@masanawa/moderation";
import {decisionRequiredApprovals,CaseError} from "@masanawa/moderation";
/** Called ONLY by AF00's existing events.outbox lease+retry+dead-letter dispatcher.
 *  This module creates no competing scheduler or journal.
 */
export interface ModerationActionDelivery {
 /** Persistent events.outbox operation ID/fence; callback must be idempotent. */
 readonly operationId:string;
 readonly fence:number;
 readonly action:ActionRecord;
}
export interface ModerationEnforcementAdapter {
 apply(input:{tenantId:string;actionId:string;kind:string;targetId:string;expiresAt:string|null;operationId:string;fence:number}):Promise<{evidenceId:string}>;
}
export interface ModerationDeliveryRepository {
 /** CAS checks the same outbox lease fence and writes applied/evidence atomically. */
 acknowledge(input:{tenantId:string;actionId:string;operationId:string;fence:number;evidenceId:string}):Promise<boolean>;
}
/** Never grant enforcement based on Gwani proposal alone or a process-local flag. */
export async function deliverApprovedAction(input:ModerationActionDelivery,options:{
 adapter:ModerationEnforcementAdapter;repository:ModerationDeliveryRepository;
 enabled:boolean;now?:()=>number;
}):Promise<"disabled"|"applied">{
 if(!options.enabled)return "disabled";
 const a=input.action;
 if(a.state!=="approved"||!a.approvedBy||a.proposedBy===a.approvedBy ||
    (decisionRequiredApprovals(a.kind)===2 && (!a.secondApprovedBy||a.approvedBy===a.secondApprovedBy)))
    throw new CaseError("moderation.enforcement_not_approved",403);
 if(a.expiresAt!==null && Date.parse(a.expiresAt)<=(options.now??Date.now)())
    throw new CaseError("moderation.enforcement_expired",409);
 if(!Number.isSafeInteger(input.fence)||input.fence<1)
    throw new CaseError("moderation.lease_invalid",403);
 const result=await options.adapter.apply({tenantId:a.tenantId,actionId:a.actionId,kind:a.kind,targetId:a.targetId,expiresAt:a.expiresAt,operationId:input.operationId,fence:input.fence});
 const applied=await options.repository.acknowledge({tenantId:a.tenantId,actionId:a.actionId,operationId:input.operationId,fence:input.fence,evidenceId:result.evidenceId});
 if(!applied)throw new CaseError("moderation.lease_stale",409);
 return "applied";
}

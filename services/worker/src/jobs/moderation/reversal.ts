import type {ActionRecord} from "@masanawa/moderation";
import {CaseError} from "@masanawa/moderation";
export async function deliverReversal(
 job:{tenantId:string;actionId:string;operationId:string;fence:number;action:ActionRecord},
 options:{
  enabled:boolean;
  adapter:{revert(input:{tenantId:string;actionId:string;kind:string;targetId:string;operationId:string;fence:number}):Promise<{evidenceId:string}>};
  repository:{acknowledgeReversal(input:{tenantId:string;actionId:string;operationId:string;fence:number;evidenceId:string}):Promise<boolean>};
 }
):Promise<"disabled"|"reversed">{
 if(!options.enabled)return "disabled";
 const a=job.action;
 if(a.tenantId!==job.tenantId||a.actionId!==job.actionId||
   a.state!=="applied"||!Number.isSafeInteger(job.fence)||job.fence<1)
   throw new CaseError("moderation.reversal_denied",403);
 // Never allow reversal for financial operations; those have a separate ledger.
 if(!["hide_comment","rate_limit","room_mute","user_ban","user_unban"].includes(a.kind))
   throw new CaseError("moderation.reversal_invalid",403);
 const result=await options.adapter.revert({tenantId:a.tenantId,actionId:a.actionId,kind:a.kind,
    targetId:a.targetId,operationId:job.operationId,fence:job.fence});
 if(!await options.repository.acknowledgeReversal({tenantId:a.tenantId,actionId:a.actionId,
    operationId:job.operationId,fence:job.fence,evidenceId:result.evidenceId}))
   throw new CaseError("moderation.reversal_stale",409);
 return "reversed";
}

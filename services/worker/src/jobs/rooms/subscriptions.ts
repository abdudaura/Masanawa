import type {RoomSubscriptionsRepository} from "@masanawa/rooms";
import type {PlaySubscriptionVerifier,VerifiedPlaySubscription} from "@masanawa/rooms";
import {authorizedState,RoomError,purchaseTokenHash} from "@masanawa/rooms";

export interface RoomEntitlementReview {
 readonly tenantId:string;readonly roomId:string;readonly userId:string;
 readonly purchaseToken:string;readonly notificationId:string;readonly eventType:string;
}
export interface RoomSubscriptionJob {
 readonly enabled:()=>boolean;
 readonly play:PlaySubscriptionVerifier;
 readonly repository:RoomSubscriptionsRepository;
 readonly playPackageName:string;
 readonly onChanged?:(event:{tenantId:string;roomId:string;userId:string})=>Promise<void>;
}
/** Work is enqueued through the existing events.outbox; no parallel journal. */
export function createRoomSubscriptionJob(input:RoomSubscriptionJob){
 return async function reconcile(v:RoomEntitlementReview):Promise<"disabled"|"linked"|"unlinked"|"duplicate">{
  if(!input.enabled())return "disabled";
  if(!v.tenantId||!v.roomId||!v.userId||!v.notificationId)throw new RoomError(422,"subscription_job_invalid");
  const purchaseHash=purchaseTokenHash(v.purchaseToken);
  const tokenOwner=await input.repository.ownerForToken(purchaseHash);
  if(tokenOwner!==v.tenantId)return "unlinked";
  const verified:VerifiedPlaySubscription=await input.play.verify(v.purchaseToken);
  if(verified.packageName!==input.playPackageName)throw new RoomError(403,"play_package_mismatch");
  const state=authorizedState(verified);
  const result=await input.repository.applyNotification({
   tenantId:v.tenantId,id:v.notificationId,tokenHash:purchaseHash,eventType:v.eventType,
   state,periodEnd:verified.periodEnd,orderId:verified.orderId,
  });
  if(result==="linked")await input.onChanged?.({tenantId:v.tenantId,roomId:v.roomId,userId:v.userId});
  return result;
 };
}

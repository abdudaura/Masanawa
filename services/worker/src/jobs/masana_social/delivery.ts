import {canDeliver,type DeliveryPermission} from "@masanawa/masana-social";
/**
 * Capability revalidation is mandatory at execution time (not only at webhook
 * admission). This adapter never opens WhatsApp personal sessions.
 * Actual enabled provider transport must be supplied by a separately authorized
 * AF00 composition with a documented provider-specific right to automate.
 */
export interface SocialDeliveryJob {
  tenantId:string; identityId:string;characterId:string;eventId:string;
  externalFanHash:string;action:"reply"; idempotencyKey:string;
}
export interface SocialDeliveryGate {
  /** Resolves current permission, consent and vault authorization under tenant/character. */
  readPermission(job:SocialDeliveryJob):Promise<DeliveryPermission|null>;
  /** Atomic existing events journal lease keyed by tenant+provider+eventId. */
  claim(job:SocialDeliveryJob):Promise<"acquired"|"duplicate"|"busy">;
  finish(job:SocialDeliveryJob,outcome:"blocked"|"sent"|"retry",reason?:string):Promise<void>;
}
export interface SocialAuthorizedTransport {
  send(job:SocialDeliveryJob):Promise<void>;
}
export async function runSocialDelivery(
  job:SocialDeliveryJob, gate:SocialDeliveryGate,
  transport:SocialAuthorizedTransport | null,now=new Date(),
):Promise<"blocked"|"duplicate"|"busy"|"sent"|"retry"> {
  if(!job.tenantId || !job.identityId || !job.characterId ||
      !job.externalFanHash || !job.eventId || !job.idempotencyKey) return "blocked";
  const lease=await gate.claim(job);
  if(lease!=="acquired")return lease;
  try{
    const permission=await gate.readPermission(job);
    if(!permission || !transport || !canDeliver(permission,job.action,now)){
      await gate.finish(job,"blocked","consent_or_capability_unavailable");
      return "blocked";
    }
    await transport.send(job);
    await gate.finish(job,"sent");
    return "sent";
  }catch{
    // Unknown provider outcome MUST be reconciled by provider event ID. Never
    // blindly resubmit a payout or social message after ambiguous timeout.
    await gate.finish(job,"retry","unknown_provider_outcome_reconcile");
    return "retry";
  }
}

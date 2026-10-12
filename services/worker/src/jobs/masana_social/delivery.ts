import {canDeliver,type SocialDeliveryJob,type SocialDeliveryGate} from "@masanawa/masana-social";
export type {SocialDeliveryJob,SocialDeliveryGate} from "@masanawa/masana-social";
/**
 * Capability revalidation is mandatory at execution time (not only at webhook
 * admission). This adapter never opens WhatsApp personal sessions.
 * Actual enabled provider transport must be supplied by a separately authorized
 * AF00 composition with a documented provider-specific right to automate.
 */
export interface SocialAuthorizedTransport {
  send(job:SocialDeliveryJob):Promise<void>;
}
export async function runSocialDelivery(
  job:SocialDeliveryJob, gate:SocialDeliveryGate,
  transport:SocialAuthorizedTransport | null,now=new Date(),
):Promise<"blocked"|"duplicate"|"busy"|"sent"|"held_unknown"> {
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
    await gate.finish(job,"held_unknown","unknown_provider_outcome_reconcile");
    return "held_unknown";
  }
}

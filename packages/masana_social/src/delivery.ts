import type {DeliveryPermission} from "./domain.js";
export interface SocialDeliveryJob {
  tenantId:string; identityId:string;characterId:string;eventId:string;
  externalFanHash:string;action:"reply"; idempotencyKey:string;
}
export interface SocialDeliveryGate {
  /** Resolves current permission, consent and vault authorization under tenant/character. */
  readPermission(job:SocialDeliveryJob):Promise<DeliveryPermission|null>;
  /** Atomic existing events journal lease keyed by tenant+provider+eventId. */
  claim(job:SocialDeliveryJob):Promise<"acquired"|"duplicate"|"busy">;
  finish(job:SocialDeliveryJob,outcome:"blocked"|"sent"|"held_unknown",reason?:string):Promise<void>;
}

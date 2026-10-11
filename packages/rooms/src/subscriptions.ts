import { createHash } from "node:crypto";
import { RoomError } from "./index.js";
export type SubscriptionState = "active"|"grace"|"on_hold"|"past_due"|"expired"|"cancelled"|"refunded";
export interface RoomPlan {
 readonly planId:string;readonly roomId:string;readonly period:"month"|"year";readonly state:"draft"|"active"|"retired";
}
export interface RoomPriceVersion {
 readonly planId:string;readonly version:number;readonly amountMinor:string;
 readonly currency:string;readonly storeProductId:string;readonly effectiveAt:string;
}
export interface RoomEntitlement {
 readonly roomId:string;readonly planId:string;readonly priceVersion:number;
 readonly state:SubscriptionState;readonly periodEnd:string;
}
export interface VerifiedPlaySubscription {
 /** The provider verifies these; never trust client-supplied fields. */
 readonly packageName:string;readonly storeProductId:string;
 readonly subscriptionState:string;readonly periodEnd:string;
 readonly orderId:string|null;readonly acknowledged:boolean;
 readonly obfuscatedAccountId:string|null;
}
export interface PlaySubscriptionVerifier {
 verify(token:string):Promise<VerifiedPlaySubscription>;
 acknowledge(token:string,productId:string):Promise<void>;
}
export function parsePurchaseToken(raw:unknown):string {
 if(typeof raw!=="string"||raw.length<20||raw.length>2048||! /^[A-Za-z0-9._:\-]+$/u.test(raw))
   throw new RoomError(422,"invalid_purchase_token");
 return raw;
}
export function purchaseTokenHash(token:string):string {
 return createHash("sha256").update(token,"utf8").digest("hex");
}
export function validatePrice(input:{amountMinor:unknown;currency:unknown;storeProductId:unknown;effectiveAt:unknown}):void {
 if(typeof input.amountMinor!=="string"||! /^[1-9][0-9]{0,14}$/u.test(input.amountMinor))
   throw new RoomError(422,"invalid_price_minor");
 if(typeof input.currency!=="string"||! /^[A-Z]{3}$/u.test(input.currency))
   throw new RoomError(422,"invalid_currency");
 if(typeof input.storeProductId!=="string"||! /^[a-z][a-z0-9._]{2,179}$/u.test(input.storeProductId))
   throw new RoomError(422,"invalid_store_product");
 if(typeof input.effectiveAt!=="string"||!Number.isFinite(Date.parse(input.effectiveAt)))
   throw new RoomError(422,"invalid_effective_at");
}
export function requirePricingStaff(roles:readonly string[]):void {
 if(!roles.some(r=>r==="pricing_manager"||r==="super_admin"))
   throw new RoomError(403,"pricing_role_required");
}
export function authorizedState(v:VerifiedPlaySubscription,nowMs=Date.now()):SubscriptionState {
 const expiry=Date.parse(v.periodEnd);
 if(!Number.isFinite(expiry))throw new RoomError(503,"play_invalid_expiry");
 if(v.subscriptionState==="SUBSCRIPTION_STATE_ACTIVE"&&expiry>nowMs)return "active";
 if(v.subscriptionState==="SUBSCRIPTION_STATE_IN_GRACE_PERIOD"&&expiry>nowMs)return "grace";
 // Google cancellation continues access until the paid period expires.
 if(v.subscriptionState==="SUBSCRIPTION_STATE_CANCELED"&&expiry>nowMs)return "active";
 if(v.subscriptionState==="SUBSCRIPTION_STATE_ON_HOLD")return "on_hold";
 if(v.subscriptionState==="SUBSCRIPTION_STATE_PAUSED")return "past_due";
 if(v.subscriptionState==="SUBSCRIPTION_STATE_EXPIRED"||expiry<=nowMs)return "expired";
 throw new RoomError(409,"purchase_not_entitled");
}


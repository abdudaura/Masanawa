
import type {FastifyInstance,FastifyRequest} from "fastify";
import {RoomError,authorizedState,parsePurchaseToken,purchaseTokenHash,requirePricingStaff,validatePrice} from "@masanawa/rooms";
import type {PlaySubscriptionVerifier} from "@masanawa/rooms";
import type {RoomActor,RoomSubscriptionsRepository} from "@masanawa/rooms";
export interface RoomSubscriptionPorts {
 readonly repository:RoomSubscriptionsRepository;
 readonly authorize:(header:string|undefined,capability:"rooms.read"|"rooms.join"|"rooms.staff")=>Promise<RoomActor>;
 readonly play:PlaySubscriptionVerifier;
 readonly playPackageName:string;
 /** Server-generated stable Google Billing obfuscated external account binding. */
 readonly purchaseAccountBinding:(tenantId:string,userId:string)=>string;
 /** Must remain off until Google Play, RTDN, device and policy qualification. */
 readonly paymentsEnabled:()=>boolean;
 /** Signature, issuer and audience must be verified by trusted server configuration. */
 readonly verifyRtdnPush:(authorization:string|undefined)=>Promise<boolean>;
}
const fields=(req:FastifyRequest):Record<string,unknown>=>{
 const x=req.body;return x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
};
const pathId=(req:FastifyRequest,key:string):string=>{
 const v=(req.params as Record<string,unknown>)[key];
 if(typeof v!=="string"||! /^[a-zA-Z0-9_-]{4,180}$/u.test(v))throw new RoomError(422,"invalid_identifier");
 return v;
};
const failure=(e:unknown,reply:any)=>{
 if(e instanceof RoomError)return reply.code(e.status).send({code:e.code});
 if((e as {code?:string})?.code==="23505")return reply.code(409).send({code:"purchase_already_claimed"});
 return reply.code(503).send({code:"subscription_unavailable"});
};
export function registerRoomSubscriptionRoutes(app:FastifyInstance,p:RoomSubscriptionPorts):void {
 const actor=async(req:FastifyRequest,cap:"rooms.read"|"rooms.join"|"rooms.staff")=>
  p.authorize(typeof req.headers.authorization==="string"?req.headers.authorization:undefined,cap);
 const staff=async(req:FastifyRequest)=>{
  const a=await actor(req,"rooms.staff");requirePricingStaff(a.roles);return a;
 };
 app.get("/v1/rooms/:id/plans",async(req,reply)=>{
  try{
   const a=await actor(req,"rooms.read");
   return {prices:await p.repository.listPlans(a.tenantId,pathId(req,"id")),storeEnabled:p.paymentsEnabled(),
    buyerBinding:a.userId?p.purchaseAccountBinding(a.tenantId,a.userId):null};
  }catch(e){return failure(e,reply);}
 });
 app.get("/v1/subscriptions",async(req,reply)=>{
  try{const a=await actor(req,"rooms.read");
   if(!a.userId)throw new RoomError(401,"authentication_required");
   return {items:await p.repository.myEntitlements(a.tenantId,a.userId)};
  }catch(e){return failure(e,reply);}
 });
 app.post("/v1/rooms/:id/subscription/verify",async(req,reply)=>{
  try{
   if(!p.paymentsEnabled())throw new RoomError(410,"room_payments_disabled");
   const a=await actor(req,"rooms.join");
   if(!a.userId)throw new RoomError(401,"authentication_required");
   const b=fields(req),token=parsePurchaseToken(b.purchaseToken);
   const planId=b.planId,revision=b.priceVersion;
   if(typeof planId!=="string"||! /^room-plan_[a-zA-Z0-9_-]+$/u.test(planId)||
      typeof revision!=="number"||!Number.isSafeInteger(revision)||revision<1)
    throw new RoomError(422,"invalid_plan_selection");
   const roomId=pathId(req,"id");
   // A customer's accepted historical price remains verifiable after an Admin price revision.
   const price=await p.repository.findHistoricalPrice(a.tenantId,roomId,planId,revision);
   if(!price||price.planId!==planId||price.version!==revision)
    throw new RoomError(409,"price_version_stale");
   const verified=await p.play.verify(token);
   if(verified.packageName!==p.playPackageName||verified.storeProductId!==price.storeProductId||
      verified.obfuscatedAccountId!==p.purchaseAccountBinding(a.tenantId,a.userId))
    throw new RoomError(403,"purchase_product_mismatch");
   const state=authorizedState(verified);
   if(state!=="active"&&state!=="grace")throw new RoomError(409,"purchase_not_entitled");
   if(!verified.acknowledged)await p.play.acknowledge(token,price.storeProductId);
   const outcome=await p.repository.persistVerified({
    tenantId:a.tenantId,userId:a.userId,roomId,planId,priceVersion:revision,
    storeProductId:verified.storeProductId,tokenHash:purchaseTokenHash(token),
    state,periodEnd:verified.periodEnd,orderId:verified.orderId,
   });
   return outcome;
  }catch(e){return failure(e,reply);}
 });
 app.post("/v1/admin/rooms/:id/plans",async(req,reply)=>{
  try{const a=await staff(req),period=fields(req).period;
   if(period!=="month"&&period!=="year")throw new RoomError(422,"invalid_period");
   const planId=await p.repository.createPlan(a.tenantId,pathId(req,"id"),period);
   return reply.code(201).send({planId});
  }catch(e){return failure(e,reply);}
 });
 app.post("/v1/admin/rooms/:id/plans/:planId/prices",async(req,reply)=>{
  try{
   const a=await staff(req),b=fields(req);
   const v={amountMinor:b.amountMinor,currency:b.currency,storeProductId:b.storeProductId,effectiveAt:b.effectiveAt};
   validatePrice(v);
   const record=await p.repository.addPrice(a.tenantId,pathId(req,"planId"),v as {
    amountMinor:string;currency:string;storeProductId:string;effectiveAt:string
   });
   return reply.code(201).send(record);
  }catch(e){return failure(e,reply);}
 });
 app.post("/v1/admin/rooms/:id/activate-paid",async(req,reply)=>{
  try{
   const a=await staff(req);
   if(!p.paymentsEnabled())throw new RoomError(410,"room_payments_disabled");
   await p.repository.activatePaid(a.tenantId,pathId(req,"id"));
   return {paid:true};
  }catch(e){return failure(e,reply);}
 });
 app.post("/v1/webhooks/play",async(req,reply)=>{
  try{
   const authorization=req.headers.authorization;
   if(!await p.verifyRtdnPush(typeof authorization==="string"?authorization:undefined))
    throw new RoomError(403,"rtdn_unauthorized");
   const m=fields(req).message as Record<string,unknown>|undefined;
   if(!m||typeof m.messageId!=="string"||! /^[A-Za-z0-9_-]{1,120}$/u.test(m.messageId)||
      typeof m.data!=="string"||m.data.length>20000)
    throw new RoomError(422,"invalid_rtdn");
   const raw=JSON.parse(Buffer.from(m.data,"base64").toString("utf8")) as Record<string,unknown>;
   const notification=raw.subscriptionNotification as Record<string,unknown>|undefined;
   if(!notification)return {acknowledged:true,linked:false};
   const token=parsePurchaseToken(notification.purchaseToken),hash=purchaseTokenHash(token);
   const tenantId=await p.repository.ownerForToken(hash);
   if(!tenantId)return {acknowledged:true,linked:false};
   const state=await p.play.verify(token);
   if(state.packageName!==p.playPackageName)throw new RoomError(403,"rtdn_package_mismatch");
   const result=await p.repository.applyNotification({
    tenantId,id:m.messageId,tokenHash:hash,
    eventType:String(notification.notificationType??"unknown").slice(0,80),
    state:authorizedState(state),periodEnd:state.periodEnd,orderId:state.orderId,
   });
   return {acknowledged:true,linked:result==="linked"};
  }catch(e){return failure(e,reply);}
 });
}

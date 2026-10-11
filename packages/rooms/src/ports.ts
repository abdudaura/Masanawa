import type {RoomPreview,RoomQuestion} from "./index.js";
export interface RoomActor {tenantId:string;userId:string|null;roles:readonly string[];}
export interface RoomsRepository {
 list(actor:RoomActor,filters:{joined?:boolean;search?:string;language?:string}):Promise<RoomPreview[]>;
 get(actor:RoomActor,id:string):Promise<RoomPreview|null>;
 staffRooms(actor:RoomActor):Promise<RoomPreview[]>;
 staffRoom(actor:RoomActor,id:string):Promise<RoomPreview|null>;
 create(actor:RoomActor,input:{title:string;slug:string;teacherCharacterId:string;language:string}):Promise<RoomPreview>;
 publish(actor:RoomActor,id:string,eligibleMasana:boolean):Promise<void>;
 join(actor:RoomActor,id:string):Promise<void>;
 leave(actor:RoomActor,id:string):Promise<void>;
 ask(actor:RoomActor,id:string,body:string,key:string):Promise<RoomQuestion>;
 questions(actor:RoomActor,id:string):Promise<RoomQuestion[]>;
 question(actor:RoomActor,id:string,questionId:string):Promise<RoomQuestion|null>;
 staffQueue(actor:RoomActor):Promise<RoomQuestion[]>;
 review(actor:RoomActor,questionId:string,answer:string,decision:"approve"|"reject"):Promise<void>;
 lessons(actor:RoomActor,id:string):Promise<Array<{lessonId:string;body:string;kind:string}>>;
 createLesson(actor:RoomActor,id:string,body:string,kind:"lesson"|"announcement"):Promise<void>;
}
/** Separate verified-Play paid lifecycle; reuses rooms.rooms and one PG owner. */
export interface RoomSubscriptionsRepository {
 listPlans(tenantId:string,roomId:string):Promise<import("./subscriptions.js").RoomPriceVersion[]>;
 myEntitlements(tenantId:string,userId:string):Promise<import("./subscriptions.js").RoomEntitlement[]>;
 findHistoricalPrice(tenantId:string,roomId:string,planId:string,version:number):Promise<import("./subscriptions.js").RoomPriceVersion|null>;
 createPlan(tenantId:string,roomId:string,period:"month"|"year"):Promise<string>;
 addPrice(tenantId:string,planId:string,input:{
  amountMinor:string;currency:string;storeProductId:string;effectiveAt:string;
 }):Promise<import("./subscriptions.js").RoomPriceVersion>;
 activatePaid(tenantId:string,roomId:string):Promise<void>;
 persistVerified(input:{
  tenantId:string;userId:string;roomId:string;priceVersion:number;planId:string;
  tokenHash:string;storeProductId:string;state:import("./subscriptions.js").SubscriptionState;
  periodEnd:string;orderId:string|null;
 }):Promise<import("./subscriptions.js").RoomEntitlement>;
 applyNotification(input:{
  tenantId:string;id:string;tokenHash:string;eventType:string;
  state:import("./subscriptions.js").SubscriptionState;periodEnd:string;orderId:string|null;
 }):Promise<"linked"|"unlinked"|"duplicate">;
 ownerForToken(tokenHash:string):Promise<string|null>;
}


import type {FastifyInstance, FastifyRequest} from "fastify";
import {RoomError,requireFan,validateIdempotencyKey} from "@masanawa/rooms";
import {validateDiscussionBody,validateDiscussionTarget,validateDiscussionCursor,requireDiscussionModerator} from "@masanawa/rooms";
import type {DiscussionPage,DiscussionReply,DiscussionDecision} from "@masanawa/rooms";
import type {RoomActor} from "@masanawa/rooms/ports";

export interface DiscussionStore {
  list(actor:RoomActor,roomId:string,kind:"lesson"|"question",targetId:string,cursor:{before:string;beforeId:string}|null):Promise<DiscussionPage>;
  create(actor:RoomActor,roomId:string,kind:"lesson"|"question",targetId:string,body:string,key:string,parentReplyId:string|null):Promise<DiscussionReply>;
  staffQueue(actor:RoomActor):Promise<DiscussionReply[]>;
  decide(actor:RoomActor,replyId:string,decision:DiscussionDecision):Promise<void>;
}
export interface DiscussionRoutePorts {
  readonly store:DiscussionStore;
  readonly authorize:(header:string|undefined,capability:"rooms.read"|"rooms.ask"|"rooms.staff")=>Promise<RoomActor>;
  readonly enabled:()=>boolean; // Must be explicitly enabled only after AF00 composition
}
function fail(error:unknown,reply:any){
 if(error instanceof RoomError)return reply.code(error.status).send({code:error.code});
 if((error as {code?:string})?.code==="23505")return reply.code(409).send({code:"discussion_conflict"});
 return reply.code(503).send({code:"discussion_unavailable"});
}
export function registerRoomDiscussionRoutes(app:FastifyInstance,ports:DiscussionRoutePorts):void{
 const guard=async(r:FastifyRequest,cap:"rooms.read"|"rooms.ask"|"rooms.staff")=>{
   if(!ports.enabled())throw new RoomError(410,"rooms_disabled");
   const h=r.headers.authorization;
   return ports.authorize(typeof h==="string"?h:undefined,cap);
 };
 app.get("/v1/rooms/:id/discussion",async(req,reply)=>{
   try{
     const a=await guard(req,"rooms.read");requireFan(a.userId);
     const p=req.params as {id:string};
     const q=req.query as {kind?:unknown;parentId?:unknown;cursor?:unknown};
     const t=validateDiscussionTarget(q.kind,q.parentId);
     return await ports.store.list(a,p.id,t.kind,t.id,validateDiscussionCursor(q.cursor));
   }catch(e){return fail(e,reply);}
 });
 app.post("/v1/rooms/:id/discussion",async(req,reply)=>{
   try{
     const a=await guard(req,"rooms.ask");requireFan(a.userId);
     const p=req.params as {id:string},b=(req.body??{}) as Record<string,unknown>;
     const t=validateDiscussionTarget(b.parentKind,b.parentId);
     const k=req.headers["idempotency-key"];
     const key=validateIdempotencyKey(typeof k==="string"?k:undefined);
     const pr=b.parentReplyId;
     if(pr!=null && (typeof pr!=="string" || !/^room-reply_[A-Za-z0-9_-]{8,120}$/.test(pr)))
       throw new RoomError(422,"invalid_parent_reply");
     const result=await ports.store.create(a,p.id,t.kind,t.id,validateDiscussionBody(b.body),key,pr??null as string|null);
     return reply.code(202).send(result);
   }catch(e){return fail(e,reply);}
 });
 app.get("/v1/admin/rooms/discussion",async(req,reply)=>{
   try{
     const a=await guard(req,"rooms.staff");requireDiscussionModerator(a.roles);
     return {items:await ports.store.staffQueue(a)};
   }catch(e){return fail(e,reply);}
 });
 app.post("/v1/admin/rooms/discussion/:replyId/review",async(req,reply)=>{
   try{
     const a=await guard(req,"rooms.staff");requireDiscussionModerator(a.roles);
     const p=req.params as {replyId:string},b=(req.body??{}) as {decision?:unknown};
     if(!["approve","hide","remove"].includes(String(b.decision)))throw new RoomError(422,"invalid_decision");
     await ports.store.decide(a,p.replyId,b.decision as DiscussionDecision);
     return {reviewed:true};
   }catch(e){return fail(e,reply);}
 });
}

import type {FastifyInstance,FastifyRequest} from "fastify";
import type {Actor} from "@masanawa/feed";
import type {DraftInput,EditorialAction,EditorialState,EditorialPost} from "../../../../../packages/feed/src/review.js";

type EditorialPort={
 create(actor:Actor,input:DraftInput):Promise<EditorialPost>;
 get(actor:Actor,id:string):Promise<EditorialPost>;
 list(actor:Actor,states?:readonly EditorialState[]):Promise<readonly EditorialPost[]>;
 change(actor:Actor,id:string,action:EditorialAction,revision:number,key:string,scheduledAt?:string|null):Promise<EditorialPost>;
};
export interface AdminReviewRoutesOptions {
 service:EditorialPort;
 principal:(req:FastifyRequest)=>Promise<Actor|null>;
 tenant:(req:FastifyRequest)=>string|null;
 enabled:()=>boolean;
}
const obj=(x:unknown):Record<string,unknown>=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const string=(x:unknown)=>typeof x==="string"?x:"";
const actions=["submit","revise","approve","schedule","take_down"] as const;
const states=["draft","in_review","scheduled","published","hidden","removed"] as const;
export async function registerAdminFeedReviewRoutes(app:FastifyInstance,o:AdminReviewRoutesOptions){
 const guard=async(req:FastifyRequest,reply:{code:(n:number)=>{send:(v:unknown)=>unknown}},
    command:(actor:Actor)=>Promise<unknown>)=>{
  if(!o.enabled())return reply.code(503).send({code:"editorial_feature_disabled"});
  try{
   const actor=await o.principal(req),tenant=o.tenant(req);
   if(!actor)return reply.code(401).send({code:"authentication_required"});
   if(!tenant||actor.tenantId!==tenant)return reply.code(403).send({code:"tenant_denied"});
   if(actor.kind!=="staff"||!actor.permissions?.includes("content_editor"))
     return reply.code(403).send({code:"editorial_permission_denied"});
   return await command(actor);
  }catch(e){
   const error=e as {status?:number;code?:string};
   if(error.status&&error.status>=400&&error.status<500)
     return reply.code(error.status).send({code:error.code??"editorial_rejected"});
   throw e;
  }
 };
 app.post("/v1/admin/feed/drafts",async(req,rep)=>guard(req,rep,actor=>{
  const b=obj(req.body);
  const media=b.media;
  if(media!==undefined&&(!Array.isArray(media)||media.some(x=>typeof x!=="string")))
   return Promise.reject(Object.assign(new Error("invalid_media"),{status:422,code:"invalid_media"}));
  return o.service.create(actor,{authorMasanaId:string(b.authorMasanaId),kind:string(b.kind) as DraftInput["kind"],
   body:string(b.body),media:media as string[]|undefined,transcript:b.transcript==null?null:string(b.transcript),
   idempotencyKey:string(req.headers["idempotency-key"])});
 }));
 app.get("/v1/admin/feed/review",async(req,rep)=>guard(req,rep,actor=>{
  const q=obj(req.query),state=q.state;
  if(state!==undefined&&(typeof state!=="string"||!states.includes(state as EditorialState)))
   return Promise.reject(Object.assign(new Error("invalid_state"),{status:422,code:"invalid_state"}));
  return o.service.list(actor,state?[state as EditorialState]:[]);
 }));
 app.get("/v1/admin/feed/posts/:id/editorial",async(req,rep)=>guard(req,rep,actor=>
  o.service.get(actor,string(obj(req.params).id))));
 app.post("/v1/admin/feed/posts/:id/transition",async(req,rep)=>guard(req,rep,actor=>{
  const b=obj(req.body),action=b.action,revision=b.expectedRevision;
  if(typeof action!=="string"||!actions.includes(action as EditorialAction)
      ||typeof revision!=="number"||!Number.isSafeInteger(revision)||revision<0)
    return Promise.reject(Object.assign(new Error("invalid_transition"),{status:422,code:"invalid_transition"}));
  return o.service.change(actor,string(obj(req.params).id),action as EditorialAction,revision,
   string(req.headers["idempotency-key"]),b.scheduledAt===undefined?null:string(b.scheduledAt));
 }));
}

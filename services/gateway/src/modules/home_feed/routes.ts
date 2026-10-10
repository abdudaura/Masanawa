import type {FastifyInstance,FastifyRequest} from "fastify";
type Actor={kind:"fan"|"staff"|"masana";tenantId:string;id:string;permissions?:readonly string[];approved?:boolean};
type FeedPort={
 list(t:string,v:string|null,m:"for_you"|"following",c?:string):Promise<unknown>;
 detail(t:string,v:string|null,id:string):Promise<unknown>;
 publish(a:Actor,p:{authorMasanaId:string;kind:"text"|"image"|"audio";body:string;media?:string[];transcript?:string|null;idempotencyKey:string}):Promise<unknown>;
 like(a:Actor,id:string,e:boolean):Promise<unknown>;save(a:Actor,id:string,e:boolean):Promise<unknown>;
 comment(a:Actor,id:string,text:string,key:string,newAccount:boolean):Promise<unknown>;
 comments(t:string,id:string,v:string|null,b?:string):Promise<unknown>;
};
export interface FeedRoutesOptions {
 readonly service:FeedPort;
 /** AF00 must resolve identity from the authenticated server session; never from request body. */
 readonly principal:(request:FastifyRequest)=>Promise<Actor|null>;
 readonly tenant:(request:FastifyRequest)=>string|null;
 readonly isNewAccount:(request:FastifyRequest)=>Promise<boolean>;
 readonly enabled:()=>boolean;
}
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==="string"?v:"";
const view=(v:unknown)=>v===true;
export async function registerHomeFeedRoutes(app:FastifyInstance,o:FeedRoutesOptions){
 const run=async(req:FastifyRequest,reply:{code:(n:number)=>{send:(v:unknown)=>unknown}},perform:(ctx:{tenant:string;viewer:string|null;actor:Actor|null})=>Promise<unknown>)=>{
  if(!o.enabled())return reply.code(503).send({code:"feature_disabled"});
  const actor=await o.principal(req),tenant=o.tenant(req);
  if(!tenant||(actor&&actor.tenantId!==tenant))return reply.code(403).send({code:"tenant_denied"});
  try{return await perform({tenant,viewer:actor?.kind==="fan"?actor.id:null,actor});}
  catch(e){const err=e as {status?:number;code?:string};if(err.status&&err.status>=400&&err.status<500)return reply.code(err.status).send({code:err.code??"invalid_request"});throw e;}
 };
 const member=(actor:Actor|null)=>{if(!actor)throw Object.assign(new Error("authentication_required"),{status:401,code:"authentication_required"});return actor};
 app.get("/v1/feed",async(req,rep)=>run(req,rep,async({tenant,viewer})=>{
  const q=object(req.query),mode=q.mode==="following"?"following":"for_you";return o.service.list(tenant,viewer,mode,str(q.cursor)||undefined);
 }));
 app.get("/v1/posts/:id",async(req,rep)=>run(req,rep,async({tenant,viewer})=>o.service.detail(tenant,viewer,str(object(req.params).id))));
 app.get("/v1/posts/:id/comments",async(req,rep)=>run(req,rep,async({tenant,viewer})=>o.service.comments(tenant,str(object(req.params).id),viewer,str(object(req.query).before)||undefined)));
 app.post("/v1/admin/feed/posts",async(req,rep)=>run(req,rep,async({actor})=>{
  const a=member(actor),b=object(req.body);
  return o.service.publish(a,{authorMasanaId:str(b.authorMasanaId),kind:str(b.kind) as "text"|"image"|"audio",body:str(b.body),media:Array.isArray(b.media)?b.media.filter(x=>typeof x==="string") as string[]:[],transcript:typeof b.transcript==="string"?b.transcript:null,idempotencyKey:str(req.headers["idempotency-key"])});
 }));
 app.put("/v1/posts/:id/like",async(req,rep)=>run(req,rep,async({actor})=>o.service.like(member(actor),str(object(req.params).id),view(object(req.body).enabled))));
 app.put("/v1/posts/:id/save",async(req,rep)=>run(req,rep,async({actor})=>o.service.save(member(actor),str(object(req.params).id),view(object(req.body).enabled))));
 app.post("/v1/posts/:id/comments",async(req,rep)=>run(req,rep,async({actor})=>{
  const a=member(actor),b=object(req.body);
  return o.service.comment(a,str(object(req.params).id),str(b.body),str(req.headers["idempotency-key"]),await o.isNewAccount(req));
 }));
}

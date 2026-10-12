import type {FastifyInstance,FastifyRequest} from "fastify";
import {createFanMemoryService,FanMemoryError,type FanMemoryStore,type FanPrincipal} from "./service.js";
/** AF00 supplies authenticated session identity; NEVER derive roles or user ID from client data. */
export function registerFanMemoryRoutes(app:FastifyInstance,deps:{
 store:FanMemoryStore; resolvePrincipal:(r:FastifyRequest)=>Promise<FanPrincipal>;
}):void {
 const svc=createFanMemoryService(deps.store);
 function error(reply:any,e:unknown){
  const code=e instanceof FanMemoryError?e.status:
    e&&typeof e==="object"&&"statusCode" in e &&
    (e.statusCode===401||e.statusCode===403)?e.statusCode:503;
  return reply.code(code).send({
   error:e instanceof FanMemoryError?e.code:
    code===401?"fan_login_required":code===403?"fan_permission_denied":"memory_unavailable"});
 }
 app.get("/v1/me/memory",async(r,reply)=>{
  try{
   const q=r.query as Record<string,unknown>;
   if(typeof q.characterId!=="string")return reply.code(400).send({error:"character_required"});
   return await svc.view(await deps.resolvePrincipal(r),q.characterId);
  }catch(e){return error(reply,e);}
 });
 app.patch("/v1/me/memory",async(r,reply)=>{
  try{
   const x=r.body as Record<string,unknown>;
   if(!x||typeof x.characterId!=="string")return reply.code(400).send({error:"character_required"});
   return await svc.consent(await deps.resolvePrincipal(r),x.characterId,{
    enabled:x.enabled,expectedRevision:x.expectedRevision});
  }catch(e){return error(reply,e);}
 });
 app.delete("/v1/me/memory",async(r,reply)=>{
  try{
   const x=r.body as Record<string,unknown>;
   if(!x||typeof x.characterId!=="string")return reply.code(400).send({error:"character_required"});
   const result=await svc.erase(await deps.resolvePrincipal(r),x.characterId,x.recordId??null,r.headers["idempotency-key"]);
   return reply.code(result.state==="completed"?200:202).send(result);
  }catch(e){return error(reply,e);}
 });
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { VideoPrincipal } from "../external_videos/contract.js";
import { createYouTubeSourceAdminService, SourceAdminError, type AdminYouTubeSourceStore } from "./source_admin.js";

/** Routes are separate from public HMAC webhook; AF00 injects the existing
 * session + staff role authorizer, never headers/body role assertions. */
export function registerYouTubeSourceAdminRoutes(app:FastifyInstance, deps:{
  store:AdminYouTubeSourceStore;
  resolvePrincipal:(request:FastifyRequest)=>Promise<VideoPrincipal>;
}):void{
  const service=createYouTubeSourceAdminService(deps.store);
  const error=(err:unknown,reply:{code:(n:number)=>{send:(v:unknown)=>unknown}})=>{
    if(err instanceof SourceAdminError)return reply.code(err.status).send({code:err.code});
    throw err;
  };
  app.get("/v1/admin/video-sources",async(req,reply)=>{
    try{return {items:await service.list(await deps.resolvePrincipal(req))};}
    catch(err){return error(err,reply);}
  });
  app.post("/v1/admin/video-sources",async(req,reply)=>{
    try{return reply.code(201).send(await service.create(await deps.resolvePrincipal(req),req.body));}
    catch(err){return error(err,reply);}
  });
  app.patch<{Params:{id:string}}>("/v1/admin/video-sources/:id/pause",async(req,reply)=>{
    try{return await service.pause(await deps.resolvePrincipal(req),req.params.id);}
    catch(err){return error(err,reply);}
  });
}

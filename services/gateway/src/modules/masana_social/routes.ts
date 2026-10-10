import type {FastifyInstance, FastifyRequest} from "fastify";
import {SocialHttpError, type TrustedStaffActor, createMasanaSocialService} from "./service.js";
export interface SocialRouteAuth {
  /** Must resolve an authenticated staff session, never trust tenant/user fields supplied by client. */
  authenticateStaff(request:FastifyRequest):Promise<TrustedStaffActor|undefined>;
  /** Tenant must be derived from trusted deployment/session context, not user query. */
  publicTenant(request:FastifyRequest):Promise<string>;
}
export function registerMasanaSocialRoutes(app:FastifyInstance,
  service:ReturnType<typeof createMasanaSocialService>,auth:SocialRouteAuth):void {
  async function response<T>(reply:{code:(v:number)=>unknown},work:()=>Promise<T>):Promise<T|{error:{code:string;message:string}}>{
    try{return await work();}catch(error){
      if(error instanceof SocialHttpError){
        reply.code(error.statusCode);
        return {error:{code:error.code,message:error.message}};
      }
      const pgCode=(error as {code?:unknown})?.code;
      if(pgCode==="23505"){reply.code(409);return {error:{code:"social_identity_conflict",message:"Account already linked"}};}
      if(pgCode==="23503"){reply.code(404);return {error:{code:"masana_not_found",message:"Masana not found"}};}
      throw error;
    }
  }
  const params=(r:FastifyRequest)=>r.params as {characterId:string;identityId?:string};
  const body=(r:FastifyRequest)=> (r.body && typeof r.body==="object" && !Array.isArray(r.body))
    ? r.body as Record<string,unknown> : {};
  app.get("/v1/masana/:characterId/social-links",async(req,reply)=>response(reply,async()=>
    service.publicLinks(await auth.publicTenant(req),params(req).characterId)));
  app.get("/v1/admin/masana/:characterId/social-accounts",async(req,reply)=>response(reply,async()=>
    service.adminList(await auth.authenticateStaff(req),params(req).characterId)));
  app.post("/v1/admin/masana/:characterId/social-accounts",async(req,reply)=>response(reply,async()=>
    service.create(await auth.authenticateStaff(req),params(req).characterId,body(req))));
  for(const action of ["verify","publish","pause","resume","revoke","edit"] as const){
    app.post("/v1/admin/masana/:characterId/social-accounts/:identityId/"+action,
      async(req,reply)=>response(reply,async()=>service.transition(
        await auth.authenticateStaff(req),params(req).characterId,params(req).identityId ?? "",
        action,body(req))));
  }
}

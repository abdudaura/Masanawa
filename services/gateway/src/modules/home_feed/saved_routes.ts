import type {FastifyInstance,FastifyRequest} from "fastify";
import type {Actor} from "../../../../../packages/feed/src/index.js";
import type {SavedLibraryService} from "../../../../../packages/feed/src/saved.js";

/** Bind to AF00's existing session, tenant and feature flag. No body-supplied actor. */
export function registerSavedLibraryRoutes(app:FastifyInstance,deps:{
  service:Pick<SavedLibraryService,"list"|"saveVideo">;
  principal:(request:FastifyRequest)=>Promise<Actor|null>;
  tenant:(request:FastifyRequest)=>string|null;
  enabled:()=>boolean;
}):void {
  const execute=async(request:FastifyRequest,reply:{
    code:(status:number)=>{send:(body:unknown)=>unknown}
  },action:(actor:Actor)=>Promise<unknown>)=>{
    if(!deps.enabled())return reply.code(503).send({code:"feature_disabled"});
    const actor=await deps.principal(request);
    if(!actor)return reply.code(401).send({code:"authentication_required"});
    if(!deps.tenant(request)||actor.tenantId!==deps.tenant(request))return reply.code(403).send({code:"tenant_denied"});
    try{return await action(actor);}
    catch(err){const e=err as {status?:number;code?:string};
      if(e.status&&e.status>=400&&e.status<500)return reply.code(e.status).send({code:e.code??"invalid_request"});
      throw err;
    }
  };
  app.get("/v1/saved",async(req,reply)=>execute(req,reply,async(actor)=>{
    const q=(req.query??{}) as Record<string,unknown>;
    if(q.cursor!==undefined&&typeof q.cursor!=="string")
      return Promise.reject(Object.assign(new Error("invalid_cursor"),{status:422,code:"invalid_cursor"}));
    return deps.service.list(actor,q.cursor as string|undefined);
  }));
  app.put("/v1/videos/:id/save",async(req,reply)=>execute(req,reply,async(actor)=>{
    const id=(req.params as {id:string}).id;
    const value=(req.body??{}) as Record<string,unknown>;
    if(typeof value.enabled!=="boolean")throw Object.assign(new Error("invalid_saved_state"),{status:422,code:"invalid_saved_state"});
    return deps.service.saveVideo(actor,id,value.enabled);
  }));
}

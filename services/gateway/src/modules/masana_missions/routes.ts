import type { FastifyInstance,FastifyRequest } from "fastify";
import { MissionError,checkedRevision,requireEditor,requireOps,
  validateMission,validateSlot } from "@masanawa/masana-missions";
import type { StaffActor } from "@masanawa/masana-missions";
import type { MissionRepository } from "@masanawa/masana-missions/ports";
/** AF00 alone composes this module after the registered migration and staff-auth ports exist. */
export interface MissionRoutePorts {
  readonly repository:MissionRepository;
  /** Must verify bearer session and staff roles server-side; never trust request roles/tenant. */
  readonly authorize:(header:string|undefined)=>Promise<StaffActor>;
  /** Default FALSE until migration, Feed idempotency, durable worker and kill switch are installed. */
  readonly enabled:()=>boolean;
}
function body(req:FastifyRequest):Record<string,unknown>{
  if(!req.body || Array.isArray(req.body) || typeof req.body!=="object")
    throw new MissionError(422,"object_required");
  return req.body as Record<string,unknown>;
}
function path(req:FastifyRequest):string{
  const p=req.params as {id?:unknown};
  if(typeof p.id!=="string" || !/^[a-z0-9_-]{3,128}$/u.test(p.id))
    throw new MissionError(422,"invalid_id");
  return p.id;
}
function problem(err:unknown,reply:any){
  if(err instanceof MissionError)return reply.code(err.status).send({code:err.code});
  const code=(err as {code?:string})?.code;
  if(code==="23505")return reply.code(409).send({code:"duplicate_mission_or_slot"});
  if(code==="23503"||code==="23514"||code==="22008")
    return reply.code(422).send({code:"invalid_mission_reference"});
  return reply.code(503).send({code:"missions_unavailable"});
}
export function registerMissionRoutes(app:FastifyInstance,ports:MissionRoutePorts):void{
  async function guard(req:FastifyRequest):Promise<StaffActor>{
    if(!ports.enabled())throw new MissionError(410,"missions_disabled");
    const h=req.headers.authorization;
    const actor=await ports.authorize(typeof h==="string"?h:undefined);
    requireEditor(actor);return actor;
  }
  app.get("/v1/admin/missions",async(req,reply)=>{
    try {return {items:await ports.repository.list(await guard(req))};}
    catch(e){return problem(e,reply);}
  });
  app.get("/v1/admin/missions/:id",async(req,reply)=>{
    try{const v=await ports.repository.get(await guard(req),path(req));
      if(!v)throw new MissionError(404,"mission_not_found");return v;}
    catch(e){return problem(e,reply);}
  });
  app.post("/v1/admin/missions",async(req,reply)=>{
    try{const actor=await guard(req);const v=await ports.repository.create(actor,validateMission(body(req)));
      return reply.code(201).send(v);}
    catch(e){return problem(e,reply);}
  });
  app.patch("/v1/admin/missions/:id/state",async(req,reply)=>{
    try{const actor=await guard(req),b=body(req);
      if(b.state!=="active"&&b.state!=="paused")throw new MissionError(422,"invalid_mission_state");
      if(b.state==="active")requireOps(actor);
      return ports.repository.setState(actor,path(req),b.state,checkedRevision(b.revision));}
    catch(e){return problem(e,reply);}
  });
  app.get("/v1/admin/missions/:id/slots",async(req,reply)=>{
    try{return {items:await ports.repository.slots(await guard(req),path(req))};}
    catch(e){return problem(e,reply);}
  });
  app.post("/v1/admin/missions/:id/slots",async(req,reply)=>{
    try{const actor=await guard(req);return reply.code(201)
      .send(await ports.repository.addSlot(actor,path(req),validateSlot(body(req))));}
    catch(e){return problem(e,reply);}
  });
  app.post("/v1/admin/missions/slots/:id/approve",async(req,reply)=>{
    try{return ports.repository.approveSlot(await guard(req),path(req),
      checkedRevision(body(req).revision));}
    catch(e){return problem(e,reply);}
  });
  app.post("/v1/admin/missions/slots/:id/retry",async(req,reply)=>{
    try{const actor=await guard(req);requireOps(actor);
      return ports.repository.retrySlot(actor,path(req),checkedRevision(body(req).revision));}
    catch(e){return problem(e,reply);}
  });
  app.get("/v1/admin/missions/:id/scorecard",async(req,reply)=>{
    try{return ports.repository.scorecard(await guard(req),path(req));}
    catch(e){return problem(e,reply);}
  });
}

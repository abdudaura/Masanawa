import type { FastifyInstance } from "fastify";
import { FAN_DISCLOSURE_VERSION, FanSetupValidationError, parseFanSetupUpdate } from "@masanawa/identity";
import type { FanSetupProfile, FanSetupUpdate } from "@masanawa/identity";

export type FanSetupActor = Readonly<{tenantId:string; userId:string}>;
export type FanSetupDependencies = {
  /** Inject existing session authority. Do not read user/tenant from request body. */
  auth: {fan(authorization: string | undefined): Promise<FanSetupActor>};
  store: {
    read(actor:FanSetupActor):Promise<FanSetupProfile|null>;
    update(input:FanSetupActor & {update:FanSetupUpdate}):Promise<FanSetupProfile>;
  };
  /** Only the existing account-owned media service may attest a user-owned upload. */
  verifyAvatar: (actor:FanSetupActor & {mediaId:string}) => Promise<boolean>;
  /** Default false. AF00 owns the central feature flag and route composition. */
  enabled?:()=>boolean;
};
export function registerFanSetupRoutes(app:FastifyInstance,deps:FanSetupDependencies):void {
  app.get("/v1/me",async(request,reply)=>{
    if (!deps.enabled?.()) return reply.code(503).send({code:"fan_setup_disabled"});
    const actor=await deps.auth.fan(request.headers.authorization);
    const data=await deps.store.read(actor);
    return data ?? reply.code(404).send({code:"fan_not_found"});
  });
  app.patch("/v1/me",async(request,reply)=>{
    if (!deps.enabled?.()) return reply.code(503).send({code:"fan_setup_disabled"});
    const actor=await deps.auth.fan(request.headers.authorization);
    let update: FanSetupUpdate;
    try {update=parseFanSetupUpdate(request.body);}
    catch(error){
      if(error instanceof FanSetupValidationError)
        return reply.code(400).send({code:error.code,reason:error.reason});
      throw error;
    }
    if(update.avatarMediaId !== undefined && update.avatarMediaId !== null) {
      if(!await deps.verifyAvatar({...actor,mediaId:update.avatarMediaId}))
        return reply.code(403).send({code:"unverified_avatar"});
    }
    try {
      const profile=await deps.store.update({...actor,update});
      return reply.code(200).send(profile);
    } catch(error) {
      if(error instanceof Error && error.message==="revision_conflict")
        return reply.code(409).send({code:"revision_conflict"});
      if(error instanceof Error && error.message==="fan_not_found")
        return reply.code(404).send({code:"fan_not_found"});
      throw error;
    }
  });
}
export {FAN_DISCLOSURE_VERSION};

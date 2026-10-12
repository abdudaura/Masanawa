import type { FastifyInstance } from "fastify";
import { hashPlatformSessionToken, validDeviceId, validDeviceRevokeKey,
  type FanDevicePrincipal, type FanDeviceSessionStore } from "@masanawa/security";

export interface FanDeviceRoutesDeps {
  /** AF00 passes the canonical customer session authorizer (never query/body identity). */
  readonly authorize: (header:string|undefined)=>Promise<FanDevicePrincipal|null>;
  readonly store: FanDeviceSessionStore;
  /** Default-off until AF00 qualifies migration, auth composition and rollout. */
  readonly enabled?: () => boolean;
}
function accessHash(header:string|undefined):string|null {
  const token=/^Bearer (msw_access_[A-Za-z0-9_-]{40,80})$/iu.exec(header?.trim()??"")?.[1];
  if(!token)return null;
  try{return hashPlatformSessionToken(token);}catch{return null;}
}
/** C09 /v1/account/devices is deliberately separate from deprecated human contacts. */
export function registerFanDeviceRoutes(app:FastifyInstance,deps:FanDeviceRoutesDeps):void {
  async function actor(header:string|undefined) {
    const hash=accessHash(header);
    if(!hash)return null;
    try {
      const identity=await deps.authorize(header);
      if(!identity?.tenantId||!identity.fanUserId)return null;
      return {hash,identity};
    } catch {return null;}
  }
  app.get("/v1/account/devices",async(req,reply)=>{
    if (!deps.enabled?.()) return reply.code(503).send({code:"feature_disabled"});
    const current=await actor(req.headers.authorization);
    if(!current)return reply.code(401).send({code:"unauthorized"});
    const items=await deps.store.list(current.identity,current.hash);
    if(!items)return reply.code(401).send({code:"session_expired"});
    return {items};
  });
  app.post("/v1/account/devices/:deviceId/revoke",async(req,reply)=>{
    if (!deps.enabled?.()) return reply.code(503).send({code:"feature_disabled"});
    const current=await actor(req.headers.authorization);
    if(!current)return reply.code(401).send({code:"unauthorized"});
    const id=(req.params as {deviceId?:unknown}).deviceId;
    const input=req.body as {idempotencyKey?:unknown}|null;
    if(!validDeviceId(id)||!validDeviceRevokeKey(input?.idempotencyKey)||
      (input!==null&&(typeof input!=="object"||Array.isArray(input)||
      Object.keys(input).some(k=>k!=="idempotencyKey"))))
      return reply.code(422).send({code:"invalid_device_command"});
    const result=await deps.store.revoke(current.identity,current.hash,id,input!.idempotencyKey as string);
    if(result==="unauthorized")return reply.code(401).send({code:"session_expired"});
    if(result==="step_up_required")return reply.code(428).send({code:"recent_verification_required"});
    if(result==="current")return reply.code(409).send({code:"use_logout_for_current_device"});
    if(result==="not_found")return reply.code(404).send({code:"device_not_found"});
    return {id,revoked:true,replayed:result==="already"};
  });
}

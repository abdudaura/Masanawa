import type { FastifyInstance } from "fastify";
import type { MasanaAuth } from "./service.js";
import type { FollowingInput, FollowingPage } from "../../../../../adapters/storage/postgres/src/masana/following.js";

export interface FollowingStore {
  list(input:FollowingInput):Promise<FollowingPage>;
  setMute(input:{tenantId:string;fanId:string;characterId:string;muted:boolean}):Promise<boolean|null>;
}
const record=(v:unknown):Record<string,unknown> =>
  v!==null && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : {};
const text=(v:unknown,max:number):string=>{
  if(v===undefined||v===null) return "";
  if(typeof v!=="string"||v.length>max) throw Object.assign(new Error("invalid_filter"),{statusCode:400});
  return v.trim();
};
const id=(v:unknown):string=>{
  if(typeof v!=="string"||v.length>160||!/^[A-Za-z0-9_-]+$/.test(v))
    throw Object.assign(new Error("invalid_character_id"),{statusCode:400});
  return v;
};

/** Distinct fan-private C46 API; existing /v1/masana/:id/follow stays canonical. */
export function registerFollowingRoutes(app:FastifyInstance,deps:{
  auth:Pick<MasanaAuth,"fan">; store:FollowingStore
}):void {
  app.get("/v1/me/following",async(request,reply)=>{
    const actor=await deps.auth.fan(request.headers.authorization);
    const q=record(request.query);
    const limit=q.limit===undefined?20:Number(q.limit);
    if(!Number.isInteger(limit)||limit<1||limit>50)
      return reply.code(400).send({code:"invalid_limit"});
    const language=text(q.language,16);
    if(language!==""&&!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(language))
      return reply.code(400).send({code:"invalid_language"});
    return deps.store.list({tenantId:actor.tenantId,fanId:actor.userId,
      q:text(q.q,100),language,cursor:text(q.cursor,160)||null,limit});
  });
  app.put("/v1/me/following/:id/mute",async(request,reply)=>{
    const actor=await deps.auth.fan(request.headers.authorization);
    const characterId=id(record(request.params).id);
    const body=record(request.body);
    if(typeof body.muted!=="boolean"||Object.keys(body).some(k=>k!=="muted"))
      return reply.code(400).send({code:"invalid_mute_request"});
    const muted=await deps.store.setMute({tenantId:actor.tenantId,fanId:actor.userId,
      characterId,muted:body.muted});
    if(muted===null)return reply.code(404).send({code:"masana_not_followed"});
    return {characterId,muted};
  });
}

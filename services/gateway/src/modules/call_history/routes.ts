import type {FastifyInstance} from "fastify";
import {HistoryFault,readHistoryPageSize,readHistoryCursor,type HistoryPage} from "./policy.js";
export interface HistoryActor {tenantId:string;fanUserId:string;}
export interface CallHistoryPorts {
  /** Must be the existing trusted J04 authenticated fan resolver, never request fields. */
  resolveFan:(authorization:string)=>Promise<HistoryActor>;
  store:{list:(scope:HistoryActor,options:{
    limit:number;cursor:{createdAt:string;callId:string}|null;
  })=>Promise<HistoryPage>};
  enabled:()=>Promise<boolean>;
}
/** Register static /history before shared J04 dynamic /:id. AF00 owns mounting. */
export function registerMasanaCallHistoryRoutes(app:FastifyInstance,ports:CallHistoryPorts):void{
 app.get("/v1/calls/history",async(req,reply)=>{
  try{
   const auth=req.headers.authorization;
   if(typeof auth!=="string"||!auth.startsWith("Bearer ")||auth.length<12)
     throw new HistoryFault("unauthorized",401);
   const actor=await ports.resolveFan(auth);
   if(!actor?.tenantId||!actor.fanUserId)throw new HistoryFault("unauthorized",401);
   let enabled=false;
   try{enabled=await ports.enabled();}catch{/* fail closed */}
   if(!enabled)throw new HistoryFault("call_history_disabled",410);
   const query=(req.query??{}) as Record<string,unknown>;
   if(Object.keys(query).some(k=>k!=="limit"&&k!=="cursor"))
     throw new HistoryFault("invalid_history_query",422);
   return await ports.store.list(actor,{limit:readHistoryPageSize(query.limit),
     cursor:readHistoryCursor(query.cursor)});
  }catch(error){
   if(error instanceof HistoryFault)return reply.code(error.status).send({code:error.code});
   return reply.code(503).send({code:"call_history_unavailable"});
  }
 });
}

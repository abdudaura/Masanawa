import type {FastifyInstance,FastifyRequest} from "fastify";
import type {FanPrincipal} from "./service.js";
export interface MemoryAdminPrincipal extends FanPrincipal {roles:readonly string[]}
export interface MemoryAdminPort {
 /** Aggregated counts ONLY; never include fan identifiers/content. */
 aggregate(tenantId:string):Promise<readonly {characterId:string;enabledFans:number}[]>;
}
export function registerFanMemoryAdminRoutes(app:FastifyInstance,deps:{
 resolveStaff:(r:FastifyRequest)=>Promise<MemoryAdminPrincipal>;port:MemoryAdminPort;
}):void{
 app.get("/v1/admin/fan-memory/aggregate",async(r,reply)=>{
  try{
   const p=await deps.resolveStaff(r);
   if(!p.roles.some(x=>x==="fan_data_officer"||x==="super_admin"))
    return reply.code(403).send({error:"fan_data_role_required"});
   return {items:await deps.port.aggregate(p.tenantId)};
  }catch{return reply.code(503).send({error:"fan_memory_admin_unavailable"});}
 });
}

import type {FastifyInstance,FastifyRequest} from 'fastify';
import {RoomError,requireFan,requireRoomStaff} from '@masanawa/rooms';
import type {RoomActor} from '@masanawa/rooms/ports';

/** Structural port keeps Gateway independent of the PostgreSQL implementation. */
export interface RoomMembershipRouteRepository {
 members(a:RoomActor,id:string):Promise<unknown[]>;
 setRole(a:RoomActor,id:string,userId:string,role:unknown):Promise<void>;
 moderate(a:RoomActor,id:string,userId:string,action:unknown):Promise<void>;
 invites(a:RoomActor,id:string):Promise<unknown[]>;
 issue(a:RoomActor,id:string):Promise<unknown>;
 revoke(a:RoomActor,id:string,inviteId:string):Promise<void>;
 accept(a:RoomActor,id:string,token:unknown):Promise<{joined:true}>;
}

export interface RoomMembershipRoutePorts {
 repository:RoomMembershipRouteRepository;
 authorize:(header:string|undefined,capability:'rooms.read'|'rooms.join'|'rooms.staff')=>Promise<RoomActor>;
 enabled:()=>boolean;
}
/** AF00 mounts once with canonical auth and after schema qualification; disabled by default. */
export function registerRoomMembershipRoutes(app:FastifyInstance,ports:RoomMembershipRoutePorts):void {
 const route=(method:'get'|'post',path:string,cap:'rooms.read'|'rooms.join'|'rooms.staff',fn:(a:RoomActor,p:Record<string,string>,b:Record<string,unknown>)=>Promise<unknown>)=>{
  app[method](path,async(req:FastifyRequest,reply)=>{
   // Invitation tokens must never be cached, reflected in errors or placed in URLs.
   reply.header('Cache-Control','no-store');
   try{
    if(!ports.enabled())throw new RoomError(410,'rooms_membership_disabled');
    const h=req.headers.authorization;
    const a=await ports.authorize(typeof h==='string'?h:undefined,cap);
    requireFan(a.userId);
    if(cap==='rooms.staff')requireRoomStaff(a.roles);
    const body=req.body;
    if(body!==undefined&&(body===null||typeof body!=='object'||Array.isArray(body)))throw new RoomError(422,'invalid_request');
    return await fn(a,req.params as Record<string,string>,(body??{}) as Record<string,unknown>);
   }catch(e){
    if(e instanceof RoomError)return reply.code(e.status).send({code:e.code});
    return reply.code(503).send({code:'rooms_unavailable'});
   }
  });
 };
 route('get','/v1/rooms/:id/members','rooms.read',async(a,p)=>({items:await ports.repository.members(a,p.id!)}));
 route('post','/v1/admin/rooms/:id/members/:userId/role','rooms.staff',async(a,p,b)=>{await ports.repository.setRole(a,p.id!,p.userId!,b.role);return {updated:true};});
 route('post','/v1/rooms/:id/members/:userId/moderate','rooms.join',async(a,p,b)=>{await ports.repository.moderate(a,p.id!,p.userId!,b.action);return {updated:true};});
 route('get','/v1/rooms/:id/invites','rooms.read',async(a,p)=>({items:await ports.repository.invites(a,p.id!)}));
 route('post','/v1/rooms/:id/invites','rooms.join',async(a,p)=>ports.repository.issue(a,p.id!));
 route('post','/v1/rooms/:id/invites/:inviteId/revoke','rooms.join',async(a,p)=>{await ports.repository.revoke(a,p.id!,p.inviteId!);return {revoked:true};});
 route('post','/v1/rooms/:id/invites/accept','rooms.join',async(a,p,b)=>ports.repository.accept(a,p.id!,b.token));
}

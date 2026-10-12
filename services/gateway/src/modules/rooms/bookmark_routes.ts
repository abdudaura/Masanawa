import type {FastifyInstance,FastifyRequest} from "fastify";
import {RoomError,requireFan} from "@masanawa/rooms";
import type {RoomActor} from "@masanawa/rooms";
type Lesson={lessonId:string;body:string;kind:"lesson"|"announcement";bookmarkedAt:string};
export interface RoomBookmarkPorts {
  readonly authorize:(header:string|undefined,cap:"rooms.read")=>Promise<RoomActor>;
  readonly store:{
    list(actor:RoomActor,roomId:string):Promise<Lesson[]>;
    save(actor:RoomActor,roomId:string,lessonId:string):Promise<void>;
    remove(actor:RoomActor,roomId:string,lessonId:string):Promise<void>;
  };
  /** Default off until AF00 registers migration, ACL composition and consumer routing. */
  readonly enabled?:()=>boolean;
}
const validRoom=(id:unknown)=>typeof id==="string"&&/^room_[a-zA-Z0-9_-]{3,100}$/u.test(id);
const validLesson=(id:unknown)=>typeof id==="string"&&/^room-lesson_[a-zA-Z0-9-]{8,100}$/u.test(id);
function mapError(error:unknown,reply:any){
  if(error instanceof RoomError)return reply.code(error.status).send({code:error.code});
  return reply.code(503).send({code:"saved_lessons_unavailable"});
}
/** Add routes once through AF00's existing Gateway module registrar, never via a parallel server. */
export function registerRoomBookmarkRoutes(app:FastifyInstance,ports:RoomBookmarkPorts):void {
  const run=async(req:FastifyRequest,reply:any,kind:"list"|"save"|"remove")=>{
    reply.header("Cache-Control","no-store");
    if(ports.enabled?.()!==true)return reply.code(503).send({code:"saved_lessons_disabled"});
    try {
      const principal=await ports.authorize(req.headers.authorization,"rooms.read");
      requireFan(principal.userId);
      const params=req.params as {id?:unknown;lessonId?:unknown};
      if(!validRoom(params.id)||(kind!=="list"&&!validLesson(params.lessonId)))
        throw new RoomError(422,"invalid_bookmark_target");
      // No client-controlled tenant/user, roles or paid entitlement state accepted.
      if(kind==="list")return {items:await ports.store.list(principal,params.id as string)};
      if(req.body!==undefined && req.body!==null &&
         (typeof req.body!=="object"||Array.isArray(req.body)||Object.keys(req.body).length!==0))
        throw new RoomError(422,"unexpected_bookmark_payload");
      if(kind==="save"){
        await ports.store.save(principal,params.id as string,params.lessonId as string);
        return reply.code(200).send({saved:true});
      }
      await ports.store.remove(principal,params.id as string,params.lessonId as string);
      return reply.code(200).send({saved:false});
    } catch(error) {return mapError(error,reply);}
  };
  app.get("/v1/rooms/:id/bookmarks",async(req,reply)=>run(req,reply,"list"));
  app.put("/v1/rooms/:id/lessons/:lessonId/bookmark",async(req,reply)=>run(req,reply,"save"));
  app.delete("/v1/rooms/:id/lessons/:lessonId/bookmark",async(req,reply)=>run(req,reply,"remove"));
}

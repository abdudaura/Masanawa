import type {FastifyInstance,FastifyRequest} from "fastify";
import {RoomError,requireRoomStaff,requireFan,validateQuestion,validateIdempotencyKey} from "@masanawa/rooms";
import type {RoomActor,RoomsRepository} from "@masanawa/rooms";

type Capability="rooms.read"|"rooms.join"|"rooms.ask"|"rooms.staff";
export interface RoomsRoutePorts {
 readonly repository:RoomsRepository;
 /** Server-side verified actor only; never take tenant/user/roles from client body. */
 readonly authorize:(authorizationHeader:string|undefined,capability:Capability)=>Promise<RoomActor>;
 /** Separate approved-Masana authority; characters may be present but not approved. */
 readonly isApprovedMasana:(tenantId:string,characterId:string)=>Promise<boolean>;
 readonly enabled:()=>boolean;
}
const data=(request:FastifyRequest)=>request.body as Record<string,unknown>|undefined;
const id=(request:FastifyRequest)=>(request.params as {id:string}).id;
function respondError(error:unknown,reply:any){
 if(error instanceof RoomError)return reply.code(error.status).send({code:error.code,message:error.message});
 if((error as {code?:string})?.code==="23505")return reply.code(409).send({code:"conflict"});
 if((error as {code?:string})?.code==="23503")return reply.code(422).send({code:"invalid_reference"});
 return reply.code(503).send({code:"rooms_unavailable"});
}
/** AF00 must compose this once in services/gateway/src/app.ts. No root edits in this lane. */
export function registerRoomsRoutes(app:FastifyInstance,ports:RoomsRoutePorts):void {
 const guard=async(req:FastifyRequest,cap:Capability)=>{
   if(!ports.enabled())throw new RoomError(410,"rooms_disabled");
   const h=req.headers.authorization;
   return ports.authorize(typeof h==="string"?h:undefined,cap);
 };
 app.get("/v1/rooms",async(req,reply)=>{
   try{const a=await guard(req,"rooms.read");const q=req.query as {tab?:string;q?:string;lang?:string};
     return {items:await ports.repository.list(a,{joined:q.tab==="joined",search:q.q??"",language:q.lang??""})};
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/rooms/:id",async(req,reply)=>{
   try{const a=await guard(req,"rooms.read");const v=await ports.repository.get(a,id(req));
     if(!v)throw new RoomError(404,"room_not_found");return v;
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/rooms/:id/join",async(req,reply)=>{
   try{const a=await guard(req,"rooms.join");requireFan(a.userId);
     await ports.repository.join(a,id(req));return reply.code(200).send({joined:true});
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/rooms/:id/leave",async(req,reply)=>{
   try{const a=await guard(req,"rooms.join");requireFan(a.userId);
     await ports.repository.leave(a,id(req));return reply.code(200).send({joined:false});
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/rooms/:id/questions",async(req,reply)=>{
   try{const a=await guard(req,"rooms.ask");requireFan(a.userId);
     const key=req.headers["idempotency-key"];
     const item=await ports.repository.ask(a,id(req),validateQuestion(data(req)?.body),
       validateIdempotencyKey(typeof key==="string"?key:""));
     return reply.code(202).send(item);
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/rooms/:id/questions",async(req,reply)=>{
   try{return {items:await ports.repository.questions(await guard(req,"rooms.read"),id(req))};
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/rooms/:id/questions/:questionId",async(req,reply)=>{
   try{const a=await guard(req,"rooms.read");const p=req.params as {id:string;questionId:string};
     const item=await ports.repository.question(a,p.id,p.questionId);
     if(!item)throw new RoomError(404,"question_not_found");return item;
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/rooms/:id/lessons",async(req,reply)=>{
   try{return {items:await ports.repository.lessons(await guard(req,"rooms.read"),id(req))};
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/admin/rooms",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     return {items:await ports.repository.staffRooms(a)};
   }catch(e){return respondError(e,reply);}
 });
 app.get("/v1/admin/rooms/questions",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     return {items:await ports.repository.staffQueue(a)};
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/admin/rooms",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     const b=data(req)||{};const item=await ports.repository.create(a,{
       title:String(b.professionTitle||""),slug:String(b.slug||""),
       teacherCharacterId:String(b.teacherCharacterId||""),language:String(b.language||"en")
     });return reply.code(201).send(item);
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/admin/rooms/:id/publish",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     const source=await ports.repository.staffRoom(a,id(req));
     if(!source)throw new RoomError(409,"staff_draft_read_required");
     const eligible=await ports.isApprovedMasana(a.tenantId,source.teacherCharacterId);
     if(!eligible)throw new RoomError(403,"masana_teacher_required");
     await ports.repository.publish(a,id(req),eligible);return {published:true};
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/admin/rooms/:id/lessons",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     const b=data(req)||{};await ports.repository.createLesson(a,id(req),String(b.body||""),b.kind==="announcement"?"announcement":"lesson");
     return reply.code(201).send({created:true});
   }catch(e){return respondError(e,reply);}
 });
 app.post("/v1/admin/rooms/questions/:questionId/review",async(req,reply)=>{
   try{const a=await guard(req,"rooms.staff");requireRoomStaff(a.roles);
     const p=req.params as {questionId:string};const b=data(req)||{};
     if(b.decision!=="approve"&&b.decision!=="reject")throw new RoomError(422,"invalid_decision");
     await ports.repository.review(a,p.questionId,String(b.answer||""),b.decision);
     return {reviewed:true};
   }catch(e){return respondError(e,reply);}
 });
}

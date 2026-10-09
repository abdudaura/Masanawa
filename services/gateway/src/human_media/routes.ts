import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { createPrivateVoiceNoteService } from "./service.js";
import { MAX_VOICE_BYTES } from "./ogg_opus.js";

type Service=ReturnType<typeof createPrivateVoiceNoteService>;
const uuid=Type.String({pattern:"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"});
const conversation=Type.Object({conversationId:uuid},{additionalProperties:false});
const item=Type.Object({messageId:uuid},{additionalProperties:false});
/** Authenticated Gateway only. Never return private object-store URLs or object keys. */
export function registerHumanVoiceRoutes(app:FastifyInstance,voice:Service):void {
 const privateResponse={onRequest:async(_request:unknown,reply:import('fastify').FastifyReply)=>{
  reply.header('Cache-Control','no-store, private').header('X-Content-Type-Options','nosniff');
 }};
 app.addContentTypeParser("audio/ogg",{parseAs:"buffer",bodyLimit:MAX_VOICE_BYTES},
  (_request,body,done)=>done(null,body));
 app.post("/messages/:conversationId/voice-notes",{
  ...privateResponse,
  bodyLimit:MAX_VOICE_BYTES,
  schema:{params:conversation,headers:Type.Object({
   "x-message-client-request-id":Type.String({minLength:12,maxLength:128}),
  })},
 },async(request,reply)=>{
  if(!Buffer.isBuffer(request.body)){
   reply.code(415);return {code:"messages.voice.ogg_required"};
  }
  const saved=await voice.send({
   authorizationHeader:request.headers.authorization,
   conversationId:(request.params as {conversationId:string}).conversationId,
   clientRequestId:String(request.headers["x-message-client-request-id"]??""),
   ogg:request.body,
  });
  reply.code(201);return saved;
 });
 app.get("/messages/:conversationId/voice-notes",{
  ...privateResponse,
  schema:{params:conversation,querystring:Type.Object({
   limit:Type.Optional(Type.Integer({minimum:1,maximum:50})),
   before:Type.Optional(Type.String({minLength:1,maxLength:19})),
  },{additionalProperties:false})},
 },async request=>voice.list({
  authorizationHeader:request.headers.authorization,
  conversationId:(request.params as {conversationId:string}).conversationId,
  ...(request.query as {limit?:number;before?:string}),
 }));
 app.get("/messages/voice/:messageId",{
  ...privateResponse,
  schema:{params:item},
 },async(request,reply)=>{
  const audio=await voice.read({
   authorizationHeader:request.headers.authorization,
   messageId:(request.params as {messageId:string}).messageId,
  });
  reply.header("Cache-Control","no-store, private")
   .header("Content-Disposition",'inline; filename="voice-note.ogg"')
   .type("audio/ogg");
  return reply.send(audio);
 });
 app.delete("/messages/voice/:messageId",{...privateResponse,schema:{params:item}},
  async request=>voice.remove({
   authorizationHeader:request.headers.authorization,
   messageId:(request.params as {messageId:string}).messageId,
  }));
}

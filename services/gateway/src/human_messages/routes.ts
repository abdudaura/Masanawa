import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanDmService } from "./service.js";
const Conversation = Type.Object({conversationId:Type.String({minLength:36,maxLength:36})},{additionalProperties:false});
const Message = Type.Object({messageId:Type.String({minLength:36,maxLength:36})},{additionalProperties:false});
const Limit = Type.Object({
  limit:Type.Optional(Type.Integer({minimum:1,maximum:50})),
  before:Type.Optional(Type.String({minLength:1,maxLength:19})),
},{additionalProperties:false});
const Body = Type.Object({
  clientRequestId:Type.String({minLength:12,maxLength:128}),
  body:Type.String({minLength:1,maxLength:16000}),
},{additionalProperties:false});
/** Register on the existing authenticated Gateway only. NEVER expose a separate unauthenticated DM port. */
export function registerHumanDmRoutes(app:FastifyInstance, service:HumanDmService):void {
  app.get("/messages",{schema:{querystring:Limit}},async request=>
    service.inbox({authorizationHeader:request.headers.authorization,...(request.query as {limit?:number;before?:string})}));
  app.post("/messages",{schema:{body:Type.Object({
    otherUserId:Type.String({minLength:3,maxLength:256}),
  },{additionalProperties:false})}},async(request,reply)=>{
    const result=await service.open({authorizationHeader:request.headers.authorization,
      otherUserId:(request.body as {otherUserId:string}).otherUserId});
    reply.code(201);return result;
  });
  app.get("/messages/:conversationId",{schema:{params:Conversation,querystring:Limit}},
    async request=>service.history({
      authorizationHeader:request.headers.authorization,
      conversationId:(request.params as {conversationId:string}).conversationId,
      ...(request.query as {limit?:number;before?:string}),
    }));
  app.post("/messages/:conversationId",{schema:{params:Conversation,body:Body}},async(request,reply)=>{
    const result=await service.send({
      authorizationHeader:request.headers.authorization,
      conversationId:(request.params as {conversationId:string}).conversationId,
      ...(request.body as {clientRequestId:string;body:string}),
    });
    reply.code(201);return result;
  });
  app.patch("/messages/items/:messageId",{schema:{
    params:Message,
    body:Type.Object({body:Type.String({minLength:1,maxLength:16000})},{additionalProperties:false}),
  }},async request=>service.edit({
    authorizationHeader:request.headers.authorization,
    messageId:(request.params as {messageId:string}).messageId,
    body:(request.body as {body:string}).body,
  }));
  app.delete("/messages/items/:messageId",{schema:{params:Message}},async request=>
    service.remove({authorizationHeader:request.headers.authorization,
      messageId:(request.params as {messageId:string}).messageId}));
  app.put("/messages/:conversationId/read",{schema:{params:Conversation,
    body:Type.Object({throughSequence:Type.String({minLength:1,maxLength:19})},{additionalProperties:false})}},
    async request=>service.read({
      authorizationHeader:request.headers.authorization,
      conversationId:(request.params as {conversationId:string}).conversationId,
      throughSequence:(request.body as {throughSequence:string}).throughSequence,
    }));
}

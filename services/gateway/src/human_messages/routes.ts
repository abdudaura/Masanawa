import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanMessageService } from "./service.js";

const conversationParams=Type.Object({
  conversationId:Type.String({minLength:8,maxLength:128}),
},{additionalProperties:false});
const messageParams=Type.Object({
  conversationId:Type.String({minLength:8,maxLength:128}),
  messageId:Type.String({minLength:8,maxLength:128}),
},{additionalProperties:false});
const pageQuery=Type.Object({
  limit:Type.Optional(Type.Integer({minimum:1,maximum:50})),
  before:Type.Optional(Type.String({minLength:10,maxLength:512})),
},{additionalProperties:false});
const auth=(request:{headers:{authorization?:string}})=>request.headers.authorization;
/** C02 only. Integration owner registers this against real C01/Pg/session composition. */
export function registerHumanMessageRoutes(app: FastifyInstance, service: HumanMessageService): void {
  app.post("/messages/conversations",{
    schema:{body:Type.Object({recipientUserId:Type.String({minLength:3,maxLength:256})},{additionalProperties:false})},
  },async request=>service.start({authorizationHeader:auth(request),
    recipientUserId:(request.body as {recipientUserId:string}).recipientUserId}));
  app.get("/messages/conversations",{
    schema:{querystring:Type.Object({limit:Type.Optional(Type.Integer({minimum:1,maximum:50}))},{additionalProperties:false})},
  },async request=>service.list({authorizationHeader:auth(request),
    limit:(request.query as {limit?:number}).limit}));
  app.get("/messages/conversations/:conversationId",{
    schema:{params:conversationParams},
  },async request=>service.read({authorizationHeader:auth(request),
    conversationId:(request.params as {conversationId:string}).conversationId}));
  app.get("/messages/conversations/:conversationId/messages",{
    schema:{params:conversationParams,querystring:pageQuery},
  },async request=>service.history({authorizationHeader:auth(request),
    conversationId:(request.params as {conversationId:string}).conversationId,
    ...(request.query as {limit?:number;before?:string})}));
  app.post("/messages/conversations/:conversationId/messages",{
    schema:{params:conversationParams,body:Type.Object({
      requestId:Type.String({minLength:8,maxLength:128}),
      text:Type.String({minLength:1,maxLength:4000}),
    },{additionalProperties:false})},
  },async request=>service.send({authorizationHeader:auth(request),
    conversationId:(request.params as {conversationId:string}).conversationId,
    ...(request.body as {requestId:string;text:string})}));
  app.patch("/messages/conversations/:conversationId/messages/:messageId",{
    schema:{params:messageParams,body:Type.Object({
      text:Type.String({minLength:1,maxLength:4000}),
      expectedRevision:Type.Integer({minimum:1,maximum:2147483647}),
    },{additionalProperties:false})},
  },async request=>service.edit({authorizationHeader:auth(request),
    ...(request.params as {conversationId:string;messageId:string}),
    ...(request.body as {text:string;expectedRevision:number})}));
  app.delete("/messages/conversations/:conversationId/messages/:messageId",{
    schema:{params:messageParams,querystring:Type.Object({
      expectedRevision:Type.Integer({minimum:1,maximum:2147483647}),
    },{additionalProperties:false})},
  },async request=>service.remove({authorizationHeader:auth(request),
    ...(request.params as {conversationId:string;messageId:string}),
    expectedRevision:(request.query as {expectedRevision:number}).expectedRevision}));
}

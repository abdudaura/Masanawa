import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanDmPreferenceService } from "./service.js";
import { DmPreferenceError } from "./policy.js";
const Params=Type.Object({conversationId:Type.String({minLength:36,maxLength:36})},{additionalProperties:false});
const Update=Type.Object({
  expectedVersion:Type.Integer({minimum:0,maximum:2147483646}),
  muteMode:Type.Union([Type.Literal("off"),Type.Literal("until"),Type.Literal("forever")]),
  mutedUntil:Type.Optional(Type.Union([Type.String({maxLength:32}),Type.Null()])),
  preview:Type.Union([Type.Literal("hidden"),Type.Literal("generic")]),
},{additionalProperties:false});
/** Composed only by C02/C03/R14 Gateway owner; do not alter global app handler. */
export function registerHumanDmPreferenceRoutes(app:FastifyInstance,service:HumanDmPreferenceService):void {
  const onError=(error:Error,_request:unknown,reply:{code:(n:number)=>{send:(value:unknown)=>void};send:(error:Error)=>void})=>{
    if(error instanceof DmPreferenceError){reply.code(error.statusCode).send({error:error.code});return;}
    reply.send(error);
  };
  app.get("/messages/preferences/unread",{errorHandler:onError},async request=>
    service.unread({authorizationHeader:request.headers.authorization}));
  app.get("/messages/:conversationId/notification-preferences",{schema:{params:Params},errorHandler:onError},async request=>
    service.get({authorizationHeader:request.headers.authorization,conversationId:(request.params as {conversationId:string}).conversationId}));
  app.put("/messages/:conversationId/notification-preferences",{schema:{params:Params,body:Update},errorHandler:onError},async request=>
    service.set({authorizationHeader:request.headers.authorization,
      conversationId:(request.params as {conversationId:string}).conversationId,
      change:request.body as Parameters<HumanDmPreferenceService["set"]>[0]["change"]}));
  app.get("/messages/:conversationId/notification-target",{schema:{params:Params},errorHandler:onError},async request=>
    service.resolveTarget({authorizationHeader:request.headers.authorization,conversationId:(request.params as {conversationId:string}).conversationId}));
}

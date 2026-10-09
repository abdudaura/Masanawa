import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { createHumanAiAssistService } from "./service.js";
type Service = ReturnType<typeof createHumanAiAssistService>;
const Id = Type.String({minLength:36,maxLength:36});
const Prepare = Type.Object({
  conversationId:Id,
  messageIds:Type.Array(Id,{minItems:1,maxItems:3}),
  purpose:Type.Union([Type.Literal("reply"),Type.Literal("translate"),Type.Literal("prepare_talk")]),
  language:Type.String({minLength:2,maxLength:12}),
  redact:Type.Union([Type.Literal("mask"),Type.Literal("original")]),
  disclosureConfirmed:Type.Literal(true),
},{additionalProperties:false});
const Send = Type.Object({
  reviewToken:Type.String({minLength:50,maxLength:4096}),
  recipientUserId:Type.String({minLength:3,maxLength:256}),
  reviewedBody:Type.String({minLength:1,maxLength:8000}),
  confirmed:Type.Literal(true),
},{additionalProperties:false});
/** Add to existing authenticated Gateway only after C01/C02 service and inference are composed. */
export function registerHumanAiAssistRoutes(app:FastifyInstance, service:Service):void {
  app.post("/messages/ai/prepare",{schema:{body:Prepare}},async request => service.prepare({
    authorizationHeader:request.headers.authorization,
    ...(request.body as Omit<Parameters<Service["prepare"]>[0],"authorizationHeader">),
  }));
  app.post("/messages/ai/send-reviewed",{schema:{body:Send}},async request => service.sendReviewed({
    authorizationHeader:request.headers.authorization,
    ...(request.body as Omit<Parameters<Service["sendReviewed"]>[0],"authorizationHeader">),
  }));
}

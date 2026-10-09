import type { FastifyInstance, FastifyRequest } from "fastify";
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
// Reject unknown authority fields BEFORE Fastify/AJV can strip them.
function rejectUnknown(allowed: readonly string[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (request.body && typeof request.body === "object" &&
        Object.keys(request.body).some(key => !allowed.includes(key))) {
      throw Object.assign(new Error("assist.invalid_fields"), {statusCode:400});
    }
  };
}
/** Add to existing authenticated Gateway only after C01/C02 service and inference are composed. */
export function registerHumanAiAssistRoutes(app:FastifyInstance, service:Service):void {
  app.post("/messages/ai/prepare",{schema:{body:Prepare},
    preValidation:rejectUnknown(["conversationId","messageIds","purpose","language","redact","disclosureConfirmed"])},async request => service.prepare({
    ...(request.body as Omit<Parameters<Service["prepare"]>[0],"authorizationHeader">),
    ...(request.headers.authorization === undefined ? {} : {authorizationHeader:request.headers.authorization}),
  }));
  app.post("/messages/ai/send-reviewed",{schema:{body:Send},
    preValidation:rejectUnknown(["reviewToken","recipientUserId","reviewedBody","confirmed"])},async request => service.sendReviewed({
    ...(request.body as Omit<Parameters<Service["sendReviewed"]>[0],"authorizationHeader">),
    ...(request.headers.authorization === undefined ? {} : {authorizationHeader:request.headers.authorization}),
  }));
}


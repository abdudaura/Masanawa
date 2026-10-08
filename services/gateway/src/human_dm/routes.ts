import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanDmService } from "./service.js";
import { HumanDmError } from "./service.js";

const uuid = Type.String({ pattern: "^[0-9a-fA-F-]{36}$", minLength: 36, maxLength: 36 });
const thread = Type.Object({ conversationId: uuid }, { additionalProperties: false });
const message = Type.Object({ conversationId: uuid, messageId: uuid }, { additionalProperties: false });

export function registerHumanDmRoutes(app: FastifyInstance, service: HumanDmService): void {
  // No auth bypass or public route; every operation authorizes current bearer.
  const handle = async <T>(operation: () => Promise<T>, reply: { code(status: number): unknown }) => {
    try { return await operation(); } catch (error) {
      if (error instanceof HumanDmError) {
        reply.code(error.statusCode);
        return { error: { code: error.code, message: error.code } };
      }
      throw error;
    }
  };
  app.post("/v1/messages/conversations", {
    schema: { body: Type.Object({ otherUserId: Type.String({minLength:3,maxLength:256}) }, {additionalProperties:false}) },
  }, async (request, reply) => handle(async () => { const v = await service.open({authorizationHeader:request.headers.authorization, ...request.body as {otherUserId:string}}); reply.code(201); return v; },reply));
  app.get("/v1/messages/conversations", {
    schema: { querystring: Type.Object({ limit: Type.Optional(Type.Integer({minimum:1,maximum:50})), before: Type.Optional(Type.String({maxLength:150})) }, {additionalProperties:false}) },
  }, async (request, reply) => handle(() => service.list({authorizationHeader:request.headers.authorization,...request.query as {limit?:number;before?:string}}),reply));
  app.get("/v1/messages/conversations/:conversationId/messages", {
    schema: { params:thread, querystring:Type.Object({limit:Type.Optional(Type.Integer({minimum:1,maximum:50})),beforeSequence:Type.Optional(Type.Integer({minimum:1}))},{additionalProperties:false}) },
  }, async (request,reply) => handle(() => service.history({authorizationHeader:request.headers.authorization,...request.params as {conversationId:string},...request.query as {limit?:number;beforeSequence?:number}}),reply));
  app.post("/v1/messages/conversations/:conversationId/messages", {
    schema: {params:thread, body: Type.Object({clientMessageId:uuid,text:Type.String({minLength:1,maxLength:4096})},{additionalProperties:false})},
  }, async (request,reply) => handle(() => service.send({authorizationHeader:request.headers.authorization,...request.params as {conversationId:string},...request.body as {clientMessageId:string;text:string}}),reply));
  app.post("/v1/messages/conversations/:conversationId/read", {
    schema: {params:thread,body:Type.Object({upToSequence:Type.Integer({minimum:1})},{additionalProperties:false})},
  }, async (request,reply) => handle(() => service.read({authorizationHeader:request.headers.authorization,...request.params as {conversationId:string},...request.body as {upToSequence:number}}),reply));
  app.patch("/v1/messages/conversations/:conversationId/messages/:messageId", {
    schema: {params:message,body:Type.Object({text:Type.String({minLength:1,maxLength:4096})},{additionalProperties:false})},
  },async(request,reply)=> handle(()=>service.edit({authorizationHeader:request.headers.authorization,...request.params as {conversationId:string;messageId:string},...request.body as {text:string}}),reply));
  app.delete("/v1/messages/conversations/:conversationId/messages/:messageId", {
    schema: {params:message},
  },async(request,reply)=> handle(()=>service.remove({authorizationHeader:request.headers.authorization,...request.params as {conversationId:string;messageId:string}}),reply));
}

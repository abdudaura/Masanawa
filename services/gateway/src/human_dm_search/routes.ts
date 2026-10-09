import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { HumanSearchError, createHumanDmSearchService } from "./search.js";

/** Isolated opt-in route composition. F15/F12 owns production mounting. */
export function registerHumanDmSearchRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createHumanDmSearchService>,
): void {
  app.get("/v1/human/messages/search", {
    schema: {querystring: Type.Object({
      text: Type.String({minLength:2, maxLength:512}),
      conversationId: Type.Optional(Type.String({minLength:36,maxLength:36})),
      after: Type.Optional(Type.String({minLength:20,maxLength:800})),
      limit: Type.Optional(Type.Integer({minimum:1,maximum:30})),
    },{additionalProperties:false})},
  }, async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    try {
      return await service.search({
        ...(request.headers.authorization ? {authorizationHeader: request.headers.authorization} : {}),
        ...(request.query as {text:string;conversationId?:string;after?:string;limit?:number}),
      });
    } catch (error) {
      const status = error instanceof HumanSearchError ? error.status : 503;
      const code = error instanceof HumanSearchError ? error.code : "unavailable";
      reply.code(status);
      return {error:{code, message: code}};
    }
  });
}

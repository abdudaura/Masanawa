import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanContactService } from "./service.js";

/** Register only when real contact repository and canonical session authorizer exist. */
export function registerHumanContactRoutes(app: FastifyInstance, service: HumanContactService): void {
  app.get("/messages/contacts/lookup/:handle", {
    schema: { params: Type.Object({ handle: Type.String({ minLength: 2, maxLength: 41 }) }, { additionalProperties: false }) },
  }, async (request) => service.lookup({
    authorizationHeader: request.headers.authorization,
    handle: (request.params as { handle: string }).handle,
  }));

  app.get("/messages/contacts/preferences", async (request) => service.ownPolicy({
    authorizationHeader: request.headers.authorization,
  }));

  app.put("/messages/contacts/preferences", {
    schema: { body: Type.Object({ policy: Type.Union([Type.Literal("anyone"), Type.Literal("requests"), Type.Literal("nobody")]) }, { additionalProperties: false }) },
  }, async (request) => service.updatePolicy({
    authorizationHeader: request.headers.authorization,
    policy: (request.body as { policy: "anyone" | "requests" | "nobody" }).policy,
  }));

  app.post("/messages/contacts/requests", {
    schema: { body: Type.Object({ handle: Type.String({ minLength: 2, maxLength: 41 }) }, { additionalProperties: false }) },
  }, async (request) => service.request({
    authorizationHeader: request.headers.authorization,
    handle: (request.body as { handle: string }).handle,
  }));

  app.post("/messages/contacts/requests/:requesterId/response", {
    schema: {
      params: Type.Object({ requesterId: Type.String({ minLength: 3, maxLength: 256 }) }, { additionalProperties: false }),
      body: Type.Object({ accept: Type.Boolean() }, { additionalProperties: false }),
    },
  }, async (request) => service.respond({
    authorizationHeader: request.headers.authorization,
    requesterId: (request.params as { requesterId: string }).requesterId,
    accept: (request.body as { accept: boolean }).accept,
  }));

  app.get("/messages/contacts", {
    schema: { querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, { additionalProperties: false }) },
  }, async (request) => service.list({
    authorizationHeader: request.headers.authorization,
    limit: (request.query as { limit?: number }).limit,
  }));
}

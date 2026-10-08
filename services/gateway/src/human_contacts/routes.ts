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

  app.get("/messages/contacts/preferences", async (request) => service.ownPreferences({
    authorizationHeader: request.headers.authorization,
  }));

  app.patch("/messages/contacts/preferences", {
    schema: { body: Type.Object({
      policy: Type.Optional(Type.Union([Type.Literal("anyone"), Type.Literal("requests"), Type.Literal("nobody")])),
      discoverableByHandle: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false, minProperties: 1 }) },
  }, async (request) => service.updatePreferences({
    authorizationHeader: request.headers.authorization,
    ...(request.body as { policy?: "anyone" | "requests" | "nobody"; discoverableByHandle?: boolean }),
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

  app.delete("/messages/contacts/:otherUserId", {
    schema: { params: Type.Object({ otherUserId: Type.String({ minLength: 3, maxLength: 256 }) }, { additionalProperties: false }) },
  }, async (request) => service.revoke({
    authorizationHeader: request.headers.authorization,
    otherUserId: (request.params as { otherUserId: string }).otherUserId,
  }));

  app.get("/messages/contacts", {
    schema: { querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, { additionalProperties: false }) },
  }, async (request) => service.list({
    authorizationHeader: request.headers.authorization,
    limit: (request.query as { limit?: number }).limit,
  }));
}

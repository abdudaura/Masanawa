import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Type from "typebox";
import type { HumanContactService } from "./service.js";

/** Reject extra input before Fastify's default AJV removes it. */
function strictBody(allowed: readonly string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body;
    if (body !== null && typeof body === "object" && !Array.isArray(body) &&
        Object.keys(body).some((key) => !allowed.includes(key))) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Unsupported contact request fields",
      });
    }
  };
}

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
    preValidation: strictBody(["policy", "discoverableByHandle"]),
    schema: { body: Type.Object({
      policy: Type.Optional(Type.Union([Type.Literal("anyone"), Type.Literal("requests"), Type.Literal("nobody")])),
      discoverableByHandle: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false, minProperties: 1 }) },
  }, async (request) => service.updatePreferences({
    authorizationHeader: request.headers.authorization,
    ...(request.body as { policy?: "anyone" | "requests" | "nobody"; discoverableByHandle?: boolean }),
  }));

  app.post("/messages/contacts/requests", {
    preValidation: strictBody(["handle"]),
    schema: { body: Type.Object({ handle: Type.String({ minLength: 2, maxLength: 41 }) }, { additionalProperties: false }) },
  }, async (request) => service.request({
    authorizationHeader: request.headers.authorization,
    handle: (request.body as { handle: string }).handle,
  }));

  app.post("/messages/contacts/requests/:requesterId/response", {
    preValidation: strictBody(["accept", "requestRevision"]),
    schema: {
      params: Type.Object({ requesterId: Type.String({ minLength: 3, maxLength: 256 }) }, { additionalProperties: false }),
      body: Type.Object({
        accept: Type.Boolean(),
        requestRevision: Type.String({ pattern: "^[1-9][0-9]{0,18}$" }),
      }, { additionalProperties: false }),
    },
  }, async (request) => service.respond({
    authorizationHeader: request.headers.authorization,
    requesterId: (request.params as { requesterId: string }).requesterId,
    accept: (request.body as { accept: boolean }).accept,
    requestRevision: (request.body as { requestRevision: string }).requestRevision,
  }));

  app.delete("/messages/contacts/:otherUserId", {
    schema: { params: Type.Object({ otherUserId: Type.String({ minLength: 3, maxLength: 256 }) }, { additionalProperties: false }) },
  }, async (request) => service.revoke({
    authorizationHeader: request.headers.authorization,
    otherUserId: (request.params as { otherUserId: string }).otherUserId,
  }));

  // Additive cursor API. The old /messages/contacts response remains unchanged.
  app.get("/v1/messages/contacts/page", {
    preValidation: async (request, reply) => {
      if (Object.keys(request.query as object).some(key => key !== "limit" && key !== "cursor")) {
        return reply.code(400).send({ code: "messages.invalid_page_query" });
      }
    },
    schema: { querystring: Type.Object({
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      cursor: Type.Optional(Type.String({ minLength: 8, maxLength: 1024, pattern: "^[A-Za-z0-9_-]+$" })),
    }, { additionalProperties: false }) },
  }, async request => {
    const { limit, cursor } = request.query as { limit?: number; cursor?: string };
    return service.page({
      authorizationHeader: request.headers.authorization,
      ...(limit === undefined ? {} : { limit }),
      ...(cursor === undefined ? {} : { cursor }),
    });
  });

  app.get("/messages/contacts", {
    schema: { querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, { additionalProperties: false }) },
  }, async (request) => {
    const { limit } = request.query as { limit?: number };
    return service.list({
      authorizationHeader: request.headers.authorization,
      ...(limit === undefined ? {} : { limit }),
    });
  });
}



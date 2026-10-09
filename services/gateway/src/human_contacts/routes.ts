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

/** Contact discovery and relationship status are private, session-bound data.
 * Attach this to each C01 route at onRequest so even authorization failures,
 * schema-validation errors and service exceptions carry no-store headers.
 * Do not install a global hook or change unrelated Gateway/financial routes. */
async function preventContactCaching(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header("Cache-Control", "no-store");
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
}

/** Register only when real contact repository and canonical session authorizer exist. */
export function registerHumanContactRoutes(app: FastifyInstance, service: HumanContactService): void {
  app.get("/messages/contacts/lookup/:handle", {
    onRequest: preventContactCaching,
    schema: { params: Type.Object({ handle: Type.String({ minLength: 2, maxLength: 41 }) }, { additionalProperties: false }) },
  }, async (request) => service.lookup({
    authorizationHeader: request.headers.authorization,
    handle: (request.params as { handle: string }).handle,
  }));

  app.get("/messages/contacts/preferences", { onRequest: preventContactCaching }, async (request) => service.ownPreferences({
    authorizationHeader: request.headers.authorization,
  }));

  app.patch("/messages/contacts/preferences", {
    onRequest: preventContactCaching,
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
    onRequest: preventContactCaching,
    preValidation: strictBody(["handle"]),
    schema: { body: Type.Object({ handle: Type.String({ minLength: 2, maxLength: 41 }) }, { additionalProperties: false }) },
  }, async (request) => service.request({
    authorizationHeader: request.headers.authorization,
    handle: (request.body as { handle: string }).handle,
  }));

  app.post("/messages/contacts/requests/:requesterId/response", {
    onRequest: preventContactCaching,
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
    onRequest: preventContactCaching,
    schema: { params: Type.Object({ otherUserId: Type.String({ minLength: 3, maxLength: 256 }) }, { additionalProperties: false }) },
  }, async (request) => service.revoke({
    authorizationHeader: request.headers.authorization,
    otherUserId: (request.params as { otherUserId: string }).otherUserId,
  }));

  // Additive cursor API. The old /messages/contacts response remains unchanged.
  app.get("/messages/contacts/page", {
    onRequest: preventContactCaching,
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
    onRequest: preventContactCaching,
    schema: { querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, { additionalProperties: false }) },
  }, async (request) => {
    const { limit } = request.query as { limit?: number };
    return service.list({
      authorizationHeader: request.headers.authorization,
      ...(limit === undefined ? {} : { limit }),
    });
  });
}


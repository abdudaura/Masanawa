import type { FastifyInstance } from "fastify";
import Type from "typebox";
import {
  AccountDeletionError,
  type AccountDeletionService,
} from "./account_deletion.js";

function fail(error: unknown, reply: { code(status: number): unknown }) {
  if (error instanceof AccountDeletionError) {
    reply.code(error.statusCode);
    return { code: error.code, message: error.code };
  }
  reply.code(503);
  return { code: "ACCOUNT_DELETION_UNAVAILABLE", message: "ACCOUNT_DELETION_UNAVAILABLE" };
}

/** All operations are session-scoped. No user IDs or privileged transitions are accepted. */
export function registerAccountDeletionRoutes(
  app: FastifyInstance,
  service: AccountDeletionService,
): void {
  app.get("/account/deletion", async (request, reply) => {
    try {
      return { request: await service.status(request.headers.authorization) };
    } catch (error) {
      return fail(error, reply);
    }
  });
  app.post("/account/deletion/request", {
    schema: { body: Type.Object({}, { additionalProperties: true }) },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body || Object.keys(body).length !== 0) {
      reply.code(400);
      return { code: "ACCOUNT_DELETION_BODY_INVALID", message: "Unexpected fields" };
    }
    try {
      return await service.request(request.headers.authorization);
    } catch (error) {
      return fail(error, reply);
    }
  });
  app.post("/account/deletion/verify", {
    schema: {
      body: Type.Object({
        code: Type.String({ pattern: "^[0-9]{6}$" }),
      }, { additionalProperties: false }),
    },
  }, async (request, reply) => {
    try {
      const body = request.body as { code: string };
      return { request: await service.verify({
        authorizationHeader: request.headers.authorization,
        code: body.code,
      }) };
    } catch (error) {
      return fail(error, reply);
    }
  });
}

import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { InvitationService } from "./service.js";

/** Shared app composer must register exactly once with real auth/privacy/quota. */
export function registerInvitationRoutes(app: FastifyInstance, service: InvitationService): void {
  app.post("/invites", async (request, reply) => {
    const response = await service.create({
      authorizationHeader: request.headers.authorization,
    });
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return response;
  });
  app.get("/invites/:token", {
    schema: {
      params: Type.Object({
        token: Type.String({
          minLength: 1, maxLength: 1024, pattern: "^[A-Za-z0-9_.-]+$",
        }),
      }, { additionalProperties: false }),
    },
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const result = await service.resolve(token);
    reply.header("Cache-Control", "private, no-store");
    reply.header("Referrer-Policy", "no-referrer");
    return result;
  });
}

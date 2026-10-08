import type { FastifyInstance } from "fastify";
import type { createProfileAvatarService } from "./service.js";

type AvatarService = ReturnType<typeof createProfileAvatarService>;

/** Register only when durable S3 and SQL cleanup journal are configured. */
export function registerProfileAvatarRoutes(
  app: FastifyInstance, service: AvatarService,
): void {
  app.addContentTypeParser(
    "image/png",
    { parseAs: "buffer", bodyLimit: 2 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );
  app.post("/profiles/me/avatar", {
    bodyLimit: 2 * 1024 * 1024,
  }, async (request, reply) => {
    if (!Buffer.isBuffer(request.body)) {
      reply.code(415);
      return { code: "profiles.avatar.png_required" };
    }
    const saved = await service.upload({
      authorizationHeader: request.headers.authorization,
      png: request.body,
    });
    reply.code(201);
    return saved;
  });
  app.delete("/profiles/me/avatar", async (request) =>
    service.remove({
      authorizationHeader: request.headers.authorization,
    }),
  );
}

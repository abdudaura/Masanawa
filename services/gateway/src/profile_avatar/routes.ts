import type { FastifyInstance } from "fastify";
import { AvatarMutationError, type createProfileAvatarService } from "./service.js";

type AvatarService = ReturnType<typeof createProfileAvatarService>;

function expectedAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^v1:[A-Za-z0-9_-]{0,1400}$/u.test(value)) {
    throw new AvatarMutationError("profiles.avatar.version_required", 400);
  }
  const encoded = value.slice(3);
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  if (Buffer.from(decoded).toString("base64url") !== encoded ||
      decoded.length > 1000 ||
      (decoded !== "" && (!decoded.startsWith("https://") ||
        decoded.includes("\n") || decoded.includes("\r")))) {
    throw new AvatarMutationError("profiles.avatar.invalid_version", 400);
  }
  return decoded || null;
}

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
    onRequest: async (_request, reply) => {
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
    },
  }, async (request, reply) => {
    if (!Buffer.isBuffer(request.body)) {
      reply.code(415);
      return { code: "profiles.avatar.png_required" };
    }
    const saved = await service.upload({
      authorizationHeader: request.headers.authorization,
      png: request.body,
      expectedUrl: expectedAvatarUrl(request.headers['x-avatar-expected']),
    });
    reply.code(201);
    return saved;
  });
  app.delete("/profiles/me/avatar", {
    onRequest: async (_request, reply) => {
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
    },
  }, async (request) =>
    service.remove({
      authorizationHeader: request.headers.authorization,
      expectedUrl: expectedAvatarUrl(request.headers['x-avatar-expected']),
    }),
  );
}

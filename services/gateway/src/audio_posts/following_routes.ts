import type { FastifyInstance, FastifyReply } from "fastify";
import type { PostActor } from "./contract.js";
import type { createFollowingService } from "./following.js";
import { FollowingError } from "./following.js";

type Service = ReturnType<typeof createFollowingService>;

/** AF00 registers this under the verified AF08 actor; it must not use caller IDs. */
export function registerAudioFollowingRoutes(app: FastifyInstance, deps: {
  service: Service;
  requireActor: (authorization: string | undefined) => Promise<PostActor>;
}): void {
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof FollowingError) {
      const status = error.code === "NOT_FOUND" ? 404 :
        error.code === "FORBIDDEN" ? 403 :
        error.code === "CAPABILITY_UNAVAILABLE" ? 503 : 400;
      return reply.code(status).send({ code: error.code, message: error.message });
    }
    throw error;
  };
  app.put("/audio-posts/:postId/follow", async (request, reply) => {
    try {
      const params = request.params as { postId?: unknown };
      const body = request.body;
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).length !== 1 || !("enabled" in body)) {
        throw new FollowingError("VALIDATION", "Invalid follow request");
      }
      const input = body as { enabled: unknown };
      const current = await deps.requireActor(request.headers.authorization);
      return await deps.service.set(current, {
        postId: params.postId, enabled: input.enabled,
      });
    } catch (error) { return fail(reply, error); }
  });
  app.get("/audio-posts/:postId/follow", async (request, reply) => {
    try {
      const params = request.params as { postId?: unknown };
      return await deps.service.status(
        await deps.requireActor(request.headers.authorization), params.postId,
      );
    } catch (error) { return fail(reply, error); }
  });
  app.get("/audio-posts/following", async (request, reply) => {
    try {
      const query = request.query;
      if (!query || typeof query !== "object" || Array.isArray(query) ||
          Object.keys(query).some(k => k !== "cursor" && k !== "limit")) {
        throw new FollowingError("VALIDATION", "Invalid following request");
      }
      const q = query as { cursor?: unknown; limit?: unknown };
      const limit = q.limit === undefined ? undefined : Number(q.limit);
      return await deps.service.feed(
        await deps.requireActor(request.headers.authorization),
        { cursor: q.cursor, limit },
      );
    } catch (error) { return fail(reply, error); }
  });
}

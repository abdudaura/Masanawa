import type { FastifyInstance } from "fastify";
import type { PostActor } from "./contract.js";
import type { createAudioPostService } from "./service.js";
import { AudioPostError } from "./service.js";

type Service = ReturnType<typeof createAudioPostService>;

/** Gateway composition must supply AF08's real session/tenant resolver. */
export function registerAudioPostRoutes(app: FastifyInstance, deps: {
  service: Service;
  requireActor: (authorization: string | undefined) => Promise<PostActor>;
}): void {
  const actor = (authorization: string | undefined) => deps.requireActor(authorization);
  const fail = (reply: { code: (status: number) => unknown }, error: unknown): never => {
    if (error instanceof AudioPostError) {
      const status = error.code === "FORBIDDEN" ? 403 :
        error.code === "NOT_FOUND" ? 404 :
        error.code === "CONFLICT" ? 409 :
        error.code === "CAPABILITY_UNAVAILABLE" ? 503 : 400;
      reply.code(status);
    }
    throw error;
  };
  app.post("/audio-posts", async (request, reply) => {
    try {
      const current = await actor(request.headers.authorization);
      const post = await deps.service.publish(current, request.body);
      reply.code(post.status === "processing" ? 202 : 200);
      return post;
    } catch (error) { return fail(reply, error); }
  });
  app.get("/audio-posts", async (request, reply) => {
    try {
      const current = await actor(request.headers.authorization);
      const query = (request.query ?? {}) as Record<string, unknown>;
      const rawLimit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 30 ||
          (query.cursor !== undefined && typeof query.cursor !== "string")) {
        throw new AudioPostError("VALIDATION", "Invalid feed cursor or limit");
      }
      return await deps.service.feed({
        tenantId: current.tenantId,
        viewerId: current.accountId,
        cursor: query.cursor as string | undefined,
        limit: rawLimit,
      });
    } catch (error) { return fail(reply, error); }
  });
  app.get("/audio-posts/mine", async (request, reply) => {
    try { return await deps.service.mine(await actor(request.headers.authorization)); }
    catch (error) { return fail(reply, error); }
  });
  app.put("/audio-posts/:postId/reaction", async (request, reply) => {
    try {
      const params = request.params as { postId?: unknown };
      const body = request.body as { kind?: unknown; enabled?: unknown } | null;
      if (typeof params.postId !== "string" ||
          !body || (body.kind !== "like" && body.kind !== "save") ||
          typeof body.enabled !== "boolean" || Object.keys(body).some(k => !["kind", "enabled"].includes(k))) {
        throw new AudioPostError("VALIDATION", "Invalid reaction");
      }
      return await deps.service.reaction(await actor(request.headers.authorization), {
        postId: params.postId, kind: body.kind, enabled: body.enabled,
      });
    } catch (error) { return fail(reply, error); }
  });
  // No public worker approval endpoint. Audio moderation and publication use a
  // trusted private job binding; never expose settle() to untrusted clients.
}

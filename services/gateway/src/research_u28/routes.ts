import type { FastifyInstance } from "fastify";
import { ResearchError, assertLimit, assertMode, normalizeResearchQuery } from "./model.js";
import type { ResearchService } from "./service.js";

/** Isolated route module: F18 is the sole owner of Gateway app/main composition. */
export function registerResearchRoutes(app: FastifyInstance, research: ResearchService): void {
  app.post("/agent/research", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    const value = request.body;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ResearchError("research.invalid_request", 400);
    }
    const body = value as Record<string, unknown>;
    // Reject actor, tenant, scope, provider URL or arbitrary instructions, even
    // when an upstream AJV layer would normally remove additional fields.
    if (Object.keys(body).some((key) => !["query", "mode", "limit"].includes(key))) {
      throw new ResearchError("research.invalid_request", 400);
    }
    const query = normalizeResearchQuery(body.query);
    const mode = assertMode(body.mode);
    const limit = assertLimit(body.limit);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (request.raw.aborted) abort();
    request.raw.once("aborted", abort);
    reply.raw.once("close", abort);
    try {
      return await research.search({
        authorizationHeader: request.headers.authorization,
        query, mode, limit,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof ResearchError) {
        reply.status(error.statusCode === 499 ? 409 : error.statusCode);
        return { error: error.code };
      }
      throw error;
    } finally {
      request.raw.off("aborted", abort);
      reply.raw.off("close", abort);
    }
  });
}


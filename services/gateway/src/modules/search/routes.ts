import type { FastifyInstance } from "fastify";
import { parseSearchQuery, SearchRequestError, type SearchStore } from "./contract.js";

export interface SearchRouteDependencies {
  /** AF00 must inject canonical optional session validation and server-owned tenant. */
  readonly resolveReader: (header: string | undefined) => Promise<{ tenantId: string }>;
  readonly store: SearchStore;
  readonly enabled: () => boolean;
}
/** A single public read endpoint, distinct from user discovery and human DMs. */
export function registerSearchRoutes(app: FastifyInstance, deps: SearchRouteDependencies): void {
  app.get("/v1/search", async (request, reply) => {
    if (!deps.enabled()) return reply.code(503).send({ code: "feature_disabled" });
    let parsed: ReturnType<typeof parseSearchQuery>;
    try { parsed = parseSearchQuery(request.query); }
    catch (error) {
      if (error instanceof SearchRequestError)
        return reply.code(400).send({ code: error.code });
      throw error;
    }
    // The caller cannot supply tenant, role, visibility or user identifiers.
    // Invalid bearer tokens must be rejected by the existing canonical resolver.
    const reader = await deps.resolveReader(request.headers.authorization);
    if (!reader.tenantId || typeof reader.tenantId !== "string")
      return reply.code(403).send({ code: "tenant_unavailable" });
    return deps.store.search({ ...parsed, tenantId: reader.tenantId });
  });
}

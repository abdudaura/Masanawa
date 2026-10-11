import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  VideoAdmissionError, createVideoAdmissionService, type VideoStore,
} from "./service.js";
import type { VideoPrincipal } from "./contract.js";

/** Composition must supply an authenticated, server-derived actor: never trust request role headers/body. */
export function registerExternalVideoRoutes(app: FastifyInstance, deps: {
  store: VideoStore;
  resolvePrincipal: (request: FastifyRequest) => Promise<VideoPrincipal>;
}): void {
  const service = createVideoAdmissionService(deps.store);
  const replyError = (err: unknown) => {
    if (err instanceof VideoAdmissionError) return { status: err.status, body: { error: err.code, message: err.message } };
    return { status: 503, body: { error: "video_unavailable", message: "Video service temporarily unavailable" } };
  };
  app.get("/v1/videos", async (request, reply) => {
    try {
      const principal = await deps.resolvePrincipal(request);
      const items = await service.list(principal, request.query as Record<string, unknown>);
      return { items, nextCursor: items.length === 20 ? items.at(-1)?.id ?? null : null };
    } catch (err) { const r = replyError(err); return reply.code(r.status).send(r.body); }
  });
  app.get<{Params:{id:string}}>("/v1/videos/:id/availability", async (request, reply) => {
    try {
      return await service.availability(await deps.resolvePrincipal(request), request.params.id);
    } catch (err) { const r = replyError(err); return reply.code(r.status).send(r.body); }
  });
  app.get("/v1/admin/video-items", async (request, reply) => {
    try {
      const principal = await deps.resolvePrincipal(request);
      const query = request.query as Record<string, unknown>;
      const items = await service.list(principal, query, false);
      // Same stable (created_at, item_id) cursor as the public catalog.
      // A full page may have a successor; an empty extra fetch ends the scan.
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      return { items, nextCursor: items.length === limit ? items.at(-1)?.id ?? null : null };
    } catch (err) { const r = replyError(err); return reply.code(r.status).send(r.body); }
  });
  app.post("/v1/admin/video-items", async (request, reply) => {
    try { return reply.code(201).send(await service.submit(await deps.resolvePrincipal(request), request.body)); }
    catch (err) { const r = replyError(err); return reply.code(r.status).send(r.body); }
  });
  app.patch<{ Params: {id: string} }>("/v1/admin/video-items/:id/review", async (request, reply) => {
    try { return await service.review(await deps.resolvePrincipal(request), request.params.id, request.body); }
    catch (err) { const r = replyError(err); return reply.code(r.status).send(r.body); }
  });
}

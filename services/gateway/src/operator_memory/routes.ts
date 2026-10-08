import type { FastifyInstance } from "fastify";
import type { MemoryService } from "./service.js";

/**
 * Isolated registration; shared Gateway composer is exclusively Work/F11.
 * Caller authentication is rechecked inside every service operation.
 */
export function registerOperatorMemoryRoutes(
  app: FastifyInstance,
  service: MemoryService,
): void {
  app.get("/operator/memory/consent", async request =>
    service.consent({ authorizationHeader: request.headers.authorization }));
  app.put("/operator/memory/consent", async request => {
    const body = request.body as { enabled?: unknown; expectedRevision?: unknown } | null;
    return service.setConsent({
      authorizationHeader: request.headers.authorization,
      enabled: body?.enabled as boolean,
      expectedRevision: body?.expectedRevision as number,
    });
  });
  app.get("/operator/memory", async request => ({
    memories: await service.list({ authorizationHeader: request.headers.authorization }),
  }));
  app.post("/operator/memory", async request => {
    const body = request.body as Record<string, unknown> | null;
    return service.remember({
      authorizationHeader: request.headers.authorization,
      kind: body?.kind as "preference",
      content: body?.content as string,
      ttlDays: body?.ttlDays as number,
    });
  });
  app.patch("/operator/memory/:id", async request => {
    const body = request.body as Record<string, unknown> | null;
    const params = request.params as { id: string };
    return service.correct({
      authorizationHeader: request.headers.authorization,
      id: params.id,
      expectedRevision: body?.expectedRevision as number,
      content: body?.content as string,
    });
  });
  app.post("/operator/memory/:id/forget/prepare", async request => {
    const body = request.body as Record<string, unknown> | null;
    const params = request.params as { id: string };
    return service.prepareForget({
      authorizationHeader: request.headers.authorization,
      id: params.id,
      expectedRevision: body?.expectedRevision as number,
    });
  });
}

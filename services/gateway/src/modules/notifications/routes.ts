import type { FastifyInstance, FastifyRequest } from "fastify";

/** Server-resolved identities only. Never bind tenant/user from request headers, query or body. */
export interface NotificationPrincipal {
  tenantId: string;
  fanUserId: string;
  signedIn: true;
}
export interface NotificationView {
  id: string; kind: string; targetKind: string; targetId: string;
  title: string; body: string; createdAt: string; readAt: string | null;
}
export interface NotificationStore {
  list(actor: { tenantId: string; fanUserId: string }, limit: number, cursor?: string):
    Promise<{ items: NotificationView[]; nextCursor: string | null }>;
  acknowledge(actor: { tenantId: string; fanUserId: string }, id: string): Promise<boolean>;
}
const code = (status: number, label: string, message: string) => ({
  status, error: { code: label, message },
});

/**
 * AF00 must inject the existing authenticated session/tenant resolver. No
 * development header fallback exists, and routes are unregistered until wired.
 */
export function registerNotificationRoutes(
  app: FastifyInstance,
  dependencies: {
    store: NotificationStore;
    resolvePrincipal: (request: FastifyRequest) => Promise<NotificationPrincipal | null>;
  },
): void {
  async function principal(req: FastifyRequest): Promise<NotificationPrincipal | null> {
    const actor = await dependencies.resolvePrincipal(req);
    return actor?.signedIn === true && typeof actor.tenantId === "string" &&
      actor.tenantId.length > 0 && typeof actor.fanUserId === "string" &&
      actor.fanUserId.length > 0 ? actor : null;
  }

  app.get("/v1/notifications", async (request, reply) => {
    const actor = await principal(request);
    if (!actor) return reply.code(401).send(code(401, "unauthorized", "Sign in to view notifications").error);
    const q = (request.query ?? {}) as Record<string, unknown>;
    const rawLimit = q.limit ?? "30";
    const n = typeof rawLimit === "string" && /^[1-9]\d?$/.test(rawLimit)
      ? Number(rawLimit) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 50 ||
      (q.cursor != null && (typeof q.cursor !== "string" || q.cursor.length > 512))) {
      return reply.code(422).send({ error: { code: "invalid_page", message: "Invalid page options" } });
    }
    try {
      return await dependencies.store.list(actor, n, q.cursor as string | undefined);
    } catch (err) {
      if (err instanceof RangeError) {
        return reply.code(422).send({ error: { code: "invalid_cursor", message: "Invalid page cursor" } });
      }
      throw err;
    }
  });

  app.post("/v1/notifications/:id/read", async (request, reply) => {
    const actor = await principal(request);
    if (!actor) return reply.code(401).send({ error: { code: "unauthorized", message: "Sign in to view notifications" } });
    const { id } = request.params as { id: string };
    if (!/^[a-zA-Z0-9_:\-.]{1,128}$/.test(id)) {
      return reply.code(422).send({ error: { code: "invalid_notification", message: "Invalid notification" } });
    }
    const acknowledged = await dependencies.store.acknowledge(actor, id);
    if (!acknowledged) {
      return reply.code(404).send({ error: { code: "not_found", message: "Notification not found" } });
    }
    return { id, read: true };
  });
}

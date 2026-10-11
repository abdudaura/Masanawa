import type { FastifyInstance } from "fastify";
import type {
  FanInboxItem, FanInboxScope,
} from "../../../../../adapters/storage/postgres/src/masana_chat/inbox.js";

export interface MasanaInboxRoutesDeps {
  resolveFan: (authorizationHeader: string | undefined) => Promise<{
    tenantId: string; fanUserId: string;
  }>;
  inbox: {
    list(scope: FanInboxScope, query: string): Promise<readonly FanInboxItem[]>;
    setPinned(scope: FanInboxScope, characterId: string,
      pinned: boolean, expectedRevision: number): Promise<number | null>;
    markRead(scope: FanInboxScope, characterId: string): Promise<number | null>;
  };
}
const validId = (x: unknown): x is string =>
  typeof x === "string" && /^character_[0-9a-f-]{36}$/i.test(x);
const record = (x: unknown): Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x)
    ? x as Record<string, unknown> : {};
/** AF00 mounts once with its canonical auth resolver and PG pool. */
export function registerMasanaInboxRoutes(
  app: FastifyInstance, deps: MasanaInboxRoutesDeps,
): void {
  async function fan(request: {headers: {authorization?: string}}):
      Promise<FanInboxScope | null> {
    if (!request.headers.authorization) return null;
    const actor = await deps.resolveFan(request.headers.authorization);
    return actor.tenantId && actor.fanUserId ? actor : null;
  }
  app.get("/v1/chats", async (request, reply) => {
    const scope = await fan(request);
    if (!scope) return reply.code(401).send({code:"unauthorized"});
    const raw = record(request.query).q;
    if (raw !== undefined &&
        (typeof raw !== "string" || raw.length > 80))
      return reply.code(422).send({code:"invalid_search"});
    const chats = await deps.inbox.list(scope, typeof raw === "string" ? raw : "");
    return reply.send({chats});
  });
  app.patch("/v1/chats/:characterId", async (request, reply) => {
    const scope = await fan(request);
    if (!scope) return reply.code(401).send({code:"unauthorized"});
    const id = record(request.params).characterId;
    const body = record(request.body);
    if (!validId(id) || typeof body.pinned !== "boolean" ||
        !Number.isSafeInteger(body.expectedRevision) ||
        (body.expectedRevision as number) < 0)
      return reply.code(422).send({code:"invalid_pin"});
    const updated = await deps.inbox.setPinned(
      scope, id, body.pinned, body.expectedRevision as number);
    if (updated === null)
      return reply.code(409).send({code:"stale_or_unavailable_chat"});
    return reply.send({revision: updated, pinned: body.pinned});
  });
  app.post("/v1/chats/:characterId/read", async (request, reply) => {
    const scope = await fan(request);
    if (!scope) return reply.code(401).send({code:"unauthorized"});
    const id = record(request.params).characterId;
    if (!validId(id)) return reply.code(422).send({code:"invalid_character"});
    const revision = await deps.inbox.markRead(scope, id);
    if (revision === null)
      return reply.code(404).send({code:"chat_unavailable"});
    return reply.send({revision});
  });
}

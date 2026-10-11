import type { FastifyInstance, FastifyRequest } from "fastify";
import { parseCanonicalId } from "@masanawa/contracts";
import type { MasanaChatActor, MasanaChatEligibility } from "./routes.js";
/** Structural port; no cross-workspace source import or second data layer. */
export interface MasanaMessageActionStore {
  hideOwnedSentTurn(actor: MasanaChatActor, characterId: string, requestId: string): Promise<boolean>;
}

/** Feature-local C13 route pack. AF00 owns its unique registration and auth wiring. */
export interface MasanaMessageActionDependencies {
  resolveFan(header: string | undefined): Promise<MasanaChatActor>;
  eligibility: MasanaChatEligibility;
  store: MasanaMessageActionStore;
  /** No handler is usable until server operator explicitly enables this gate. */
  enabled(): boolean;
}
export function registerMasanaMessageActionRoutes(
  app: FastifyInstance, deps: MasanaMessageActionDependencies,
): void {
  app.post("/v1/masana/:id/chat/turns/:requestId/hide", async (req: FastifyRequest, reply) => {
    if (!deps.enabled()) return reply.code(410).send({ code: "feature_unavailable" });
    const raw = req.params as Record<string, unknown>;
    let id: string, turn: string;
    try {
      if (typeof raw.id !== "string" || typeof raw.requestId !== "string") throw new Error();
      id = parseCanonicalId("character", raw.id);
      turn = parseCanonicalId("request", raw.requestId);
    } catch { return reply.code(422).send({ code: "invalid_message_identifier" }); }
    const actor = await deps.resolveFan(req.headers.authorization);
    if (!actor?.tenantId || !actor?.fanUserId)
      return reply.code(401).send({ code: "unauthorized" });
    if (!await deps.eligibility.isApprovedPlatformMasana({
      tenantId: actor.tenantId, characterId: id,
    })) return reply.code(404).send({ code: "not_found" });
    const hidden = await deps.store.hideOwnedSentTurn(actor, id, turn);
    if (!hidden) return reply.code(404).send({ code: "not_found" });
    return reply.send({ requestId: turn, hidden: true });
  });
}

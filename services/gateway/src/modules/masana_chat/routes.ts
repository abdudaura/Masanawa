import type { FastifyInstance } from "fastify";
import { createCanonicalId, parseCanonicalId } from "@masanawa/contracts";
import type { AgentConversationService } from "../../agent_conversation_contract.js";

/** Existing session and turn service remains the sole write/idempotency authority. */
export interface MasanaChatActor {
  readonly tenantId: string;
  readonly fanUserId: string;
}
export interface MasanaChatEligibility {
  isApprovedPlatformMasana(input: {
    readonly tenantId: string;
    readonly characterId: string;
  }): Promise<boolean>;
}
export interface MasanaChatDependencies {
  readonly resolveFan: (authorizationHeader: string | undefined) => Promise<MasanaChatActor>;
  readonly eligibility: MasanaChatEligibility;
  readonly conversations: AgentConversationService;
}
function object(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? v as Record<string, unknown> : {};
}
function nonEmpty(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;
}
/**
 * Fan-only entry point. No contact IDs, recipient user IDs, custom tenant,
 * model/skill selection or user-created characters may pass this boundary.
 * AF00 must close/retire the historical agent write ingress separately.
 */
export function registerMasanaChatRoutes(app: FastifyInstance, deps: MasanaChatDependencies): void {
  async function admit(
    authHeader: string | undefined, rawId: unknown,
  ): Promise<{ characterId: string; tenantId: string; fanUserId: string } | null> {
    const actor = await deps.resolveFan(authHeader);
    const characterId = typeof rawId === "string" ? rawId : "";
    if (!/^character_[0-9a-f-]{36}$/i.test(characterId)) return null;
    const canonical = parseCanonicalId("character", characterId);
    if (!actor.tenantId || !actor.fanUserId) return null;
    if (!await deps.eligibility.isApprovedPlatformMasana({
      tenantId: actor.tenantId, characterId: canonical,
    })) return null;
    return { characterId: canonical, tenantId: actor.tenantId, fanUserId: actor.fanUserId };
  }
  app.post("/v1/masana/:id/chat/sessions", async (request, reply) => {
    const actor = await admit(request.headers.authorization, object(request.params).id);
    if (!actor) return reply.code(403).send({ code: "masana_chat_forbidden" });
    const created = await deps.conversations.open({
      authorizationHeader: request.headers.authorization, characterId: actor.characterId,
    });
    return reply.code(201).send(created);
  });
  app.post("/v1/masana/:id/chat/sessions/:sessionId/turns", async (request, reply) => {
    const actor = await admit(request.headers.authorization, object(request.params).id);
    if (!actor) return reply.code(403).send({ code: "masana_chat_forbidden" });
    const body = object(request.body);
    const text = nonEmpty(body.text, 32000);
    const requestId = nonEmpty(body.requestId, 110);
    if (!text || !requestId) return reply.code(422).send({ code: "invalid_chat_turn" });
    const sessionId = object(request.params).sessionId;
    if (typeof sessionId !== "string") return reply.code(422).send({ code: "invalid_session" });
    let canonicalRequest: ReturnType<typeof parseCanonicalId<"request">>;
    let canonicalSession: ReturnType<typeof parseCanonicalId<"character-session">>;
    try {
      canonicalRequest = parseCanonicalId("request", requestId);
      canonicalSession = parseCanonicalId("character-session", sessionId);
    } catch {
      return reply.code(422).send({ code: "invalid_chat_identifier" });
    }
    // Existing session repository authorizes the same fan/character/tenant pair.
    // Existing mobileShell.claimTurn enforces stable requestId replay semantics.
    const result = await deps.conversations.turn({
      authorizationHeader: request.headers.authorization,
      characterId: actor.characterId,
      characterSessionId: canonicalSession,
      text, requestId: canonicalRequest,
      correlationId: createCanonicalId("correlation"),
      representation: "platform-agent",
      surface: "chat",
    });
    return reply.send(result);
  });
  app.post("/v1/masana/:id/chat/sessions/:sessionId/close", async (request, reply) => {
    const actor = await admit(request.headers.authorization, object(request.params).id);
    if (!actor) return reply.code(403).send({ code: "masana_chat_forbidden" });
    let canonicalSession: ReturnType<typeof parseCanonicalId<"character-session">>;
    try {
      const raw = object(request.params).sessionId;
      if (typeof raw !== "string") throw new TypeError("invalid_session");
      canonicalSession = parseCanonicalId("character-session", raw);
    } catch { return reply.code(422).send({ code: "invalid_session" }); }
    await deps.conversations.close({
      authorizationHeader: request.headers.authorization,
      characterId: actor.characterId,
      characterSessionId: canonicalSession,
    });
    return reply.send({ closed: true });
  });
}

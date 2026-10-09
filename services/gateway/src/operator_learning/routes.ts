import type { FastifyInstance, FastifyReply } from "fastify";
import { createCanonicalId, parseCanonicalId } from "@masanawa/contracts";
import {
  createTeachingContinuity,
  TeachingContinuityError,
  type TeachingProgressRepository,
  type StudyActionRequest,
  type TeachingTurnDispatcher,
} from "@masanawa/skills";
import type {
  AgentConversationAuthorizer,
  AgentConversationService,
} from "../agent_conversation_contract.js";

export interface OperatorLearningRouteDependencies {
  readonly authorizer: AgentConversationAuthorizer;
  readonly conversation: AgentConversationService;
  readonly progress: TeachingProgressRepository;
}

/** Strict body parsing: don't accidentally accept model-authorized fields. */
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("learning.invalid_request");
  }
  return value as Record<string, unknown>;
}

function requiredString(raw: unknown, max: number): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > max) {
    throw new TypeError("learning.invalid_request");
  }
  return raw;
}

function clientError(reply: FastifyReply, error: unknown) {
  if (error instanceof TeachingContinuityError) {
    const status = error.code === "learning.forbidden" ? 403 :
      error.code === "learning.stale_checkpoint" ? 409 :
      error.code === "learning.invalid_action" ? 400 : 503;
    return reply.code(status).send({ error: error.code });
  }
  if (error instanceof TypeError || error instanceof RangeError) {
    return reply.code(400).send({ error: "learning.invalid_request" });
  }
  throw error;
}

/**
 * Isolated route registrar, deliberately NOT installed in app.ts until the
 * one Gateway composer reconciles C07/U02 and provides the existing services.
 * Authorization comes only from the Gateway's current Character admission.
 */
export function registerOperatorLearningRoutes(
  app: FastifyInstance,
  dependencies: OperatorLearningRouteDependencies,
): void {
  app.get("/agent/learning/progress", async (request, reply) => {
    try {
      const query = object(request.query);
      const characterId = parseCanonicalId(
        "character", requiredString(query.characterId, 160),
      );
      const admission = await dependencies.authorizer.authorize({
        authorizationHeader: request.headers.authorization,
        characterId,
      });
      if (admission.scope.characterId !== characterId) {
        return reply.code(403).send({ error: "learning.forbidden" });
      }
      const service = createTeachingContinuity({
        repository: dependencies.progress,
        dispatcher: { async dispatch() { return { state: "rejected" }; } },
      });
      reply.header("cache-control", "no-store");
      return await service.read({
        tenantId: admission.scope.tenantId,
        userId: admission.scope.userId,
      }, admission.scope);
    } catch (error) {
      return clientError(reply, error);
    }
  });

  app.post("/agent/learning/actions", async (request, reply) => {
    try {
      const body = object(request.body);
      const allowed = new Set([
        "characterId", "characterSessionId", "requestId", "action",
        "expectedUpdatedAt", "answer",
      ]);
      if (Object.keys(body).some((key) => !allowed.has(key))) {
        throw new TypeError("learning.invalid_request");
      }
      const characterId = parseCanonicalId(
        "character", requiredString(body.characterId, 160),
      );
      const sessionId = parseCanonicalId(
        "character-session", requiredString(body.characterSessionId, 180),
      );
      const requestId = parseCanonicalId(
        "request", requiredString(body.requestId, 180),
      );
      const admission = await dependencies.authorizer.authorize({
        authorizationHeader: request.headers.authorization,
        characterId,
      });
      if (admission.scope.characterId !== characterId) {
        return reply.code(403).send({ error: "learning.forbidden" });
      }

      // Canonical conversation.turn enforces the current session/relationship
      // and persists the Study assistant turn using its own requestId journal.
      const dispatcher: TeachingTurnDispatcher = {
        async dispatch(input) {
          if (input.scope.tenantId !== admission.scope.tenantId ||
              input.scope.userId !== admission.scope.userId ||
              input.scope.relationshipId !== admission.scope.relationshipId ||
              input.scope.characterId !== admission.scope.characterId) {
            return { state: "rejected", code: "learning.forbidden" };
          }
          try {
            await dependencies.conversation.turn({
              authorizationHeader: request.headers.authorization,
              characterSessionId: sessionId,
              characterId,
              requestId,
              correlationId: createCanonicalId("correlation"),
              text: input.studyText,
            });
            return { state: "accepted" };
          } catch {
            // A request might have committed before its reply was lost. Its
            // canonical requestId MUST be reconciled, never sent with a new ID.
            return { state: "uncertain", code: "learning.turn_status_unknown" };
          }
        },
      };
      const service = createTeachingContinuity({
        repository: dependencies.progress,
        dispatcher,
      });
      const action = {
        action: body.action,
        requestId: requestId as string,
        expectedUpdatedAt: body.expectedUpdatedAt,
        ...(body.answer !== undefined ? { answer: body.answer } : {}),
      } as StudyActionRequest;
      reply.header("cache-control", "no-store");
      return await service.act({
        tenantId: admission.scope.tenantId,
        userId: admission.scope.userId,
      }, admission.scope, action);
    } catch (error) {
      return clientError(reply, error);
    }
  });
}

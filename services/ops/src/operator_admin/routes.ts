import type { FastifyInstance } from "fastify";
import { OperatorMutationNotConfigured, OperatorPermissionDenied, OperatorReadbackFailure, OperatorRevisionConflict, type OperatorAgentControl } from "./agent_control.js";

function errorReply(reply: { code(status: number): { send(value: unknown): unknown } }, error: unknown) {
  if (error instanceof TypeError || error instanceof RangeError) {
    return reply.code(400).send({ code: "INVALID_AGENT_CONTROL_REQUEST" });
  }
  if (error instanceof OperatorRevisionConflict) {
    return reply.code(409).send({ code: "AGENT_REVISION_CONFLICT" });
  }
  if (error instanceof OperatorMutationNotConfigured) {
    return reply.code(503).send({ code: "AGENT_CONTROL_UNAVAILABLE" });
  }
  if (error instanceof OperatorReadbackFailure) {
    return reply.code(503).send({ code: "AGENT_READBACK_UNCERTAIN" });
  }
  if (error instanceof OperatorPermissionDenied) {
    return reply.code(403).send({ code: "AGENT_CONTROL_DENIED" });
  }
  // Unknown repository/runtime errors are not authority failures. Do not
  // disclose tenant, DB or credential details or pretend a write succeeded.
  return reply.code(503).send({ code: "AGENT_CONTROL_UNAVAILABLE" });
}

function revision(value: string | undefined): number {
  if (!value || !/^"[1-9][0-9]{0,9}"$/.test(value)) {
    throw new TypeError("A strong numeric If-Match revision is required");
  }
  const parsed = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(parsed)) throw new TypeError("Invalid revision");
  return parsed;
}

/**
 * Additive route plugin only. The central Ops owner must explicitly compose
 * it with the real AgentAdminAuthorizer, database and audit acceptance gates.
 * No route auto-registers or bypasses the existing admin session.
 */
export function registerOperatorAgentRoutes(app: FastifyInstance, control: OperatorAgentControl): void {
  app.get("/v1/admin/operator/agents", async (request, reply) => {
    try {
      reply.header("cache-control", "no-store");
      return await control.snapshot({ authorizationHeader: request.headers.authorization });
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.delete("/v1/admin/operator/agents/:characterId/skills/:skillVersionId", async (request, reply) => {
    try {
      reply.header("cache-control", "no-store");
      const params = request.params as Record<string, string>;
      return await control.detachSkill({
        authorizationHeader: request.headers.authorization,
        characterId: params.characterId,
        skillVersionId: params.skillVersionId,
        expectedRevision: revision(request.headers["if-match"]),
      });
    } catch (error) {
      return errorReply(reply, error);
    }
  });
}

import { createCanonicalId, parseCanonicalId } from "@masanawa/contracts";
import type { FastifyInstance } from "fastify";
import type { AssistantRole, AssistantWorkspaceService } from "./service.js";

class InvalidWorkspaceInput extends Error {
  readonly statusCode = 400;
}

function role(value: unknown): AssistantRole {
  if (value !== "gwani" && value !== "gwana") {
    throw new InvalidWorkspaceInput("Invalid assistant role");
  }
  return value;
}

function object(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidWorkspaceInput("Invalid assistant request");
  }
  if (allowed && Object.keys(value).some(key => !allowed.includes(key))) {
    throw new InvalidWorkspaceInput("Unexpected assistant request field");
  }
  return value as Record<string, unknown>;
}

function historyLimit(raw: unknown): number {
  if (raw === undefined) return 50;
  if (typeof raw !== "string" || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(raw)) {
    throw new InvalidWorkspaceInput("Invalid history limit");
  }
  return Number(raw);
}

function text(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 6000) {
    throw new InvalidWorkspaceInput("Invalid message text");
  }
  return raw;
}

/**
 * Intended for additive registration by the single shared Gateway integration
 * owner. Never expose userId, tenantId or Character IDs as client-supplied
 * authorization. Canonical services reauthorize each underlying read/write.
 */
export function registerAssistantWorkspaceRoutes(
  app: FastifyInstance,
  service: AssistantWorkspaceService,
): void {
  app.get("/assistant/workspace", async (request) => {
    const query = object(request.query, ["limit"]);
    return service.snapshot({
      authorizationHeader: request.headers.authorization,
      limit: historyLimit(query.limit),
    });
  });

  app.put("/assistant/workspace/persona", async (request) => {
    const body = object(request.body, ["role"]);
    return service.select({
      authorizationHeader: request.headers.authorization,
      role: role(body.role),
    });
  });

  app.post("/assistant/workspace/sessions", async (request) => {
    const body = object(request.body, ["role"]);
    return service.open({
      authorizationHeader: request.headers.authorization,
      role: role(body.role),
    });
  });

  app.post("/assistant/workspace/sessions/:sessionId/turn", async (request) => {
    const body = object(request.body, ["role", "requestId", "text"]);
    const params = object(request.params);
    return service.turn({
      authorizationHeader: request.headers.authorization,
      role: role(body.role),
      characterSessionId: parseCanonicalId(
        "character-session", text(params.sessionId),
      ),
      requestId: parseCanonicalId("request", text(body.requestId)),
      correlationId: createCanonicalId("correlation"),
      text: text(body.text),
    });
  });

  app.get("/assistant/workspace/turns/:requestId/status", async (request) => {
    const query = object(request.query, ["role"]);
    const params = object(request.params);
    return service.turnStatus({
      authorizationHeader: request.headers.authorization,
      role: role(query.role),
      requestId: parseCanonicalId("request", text(params.requestId)),
    });
  });
}


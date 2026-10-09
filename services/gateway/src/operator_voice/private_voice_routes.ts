import type { FastifyInstance } from "fastify";
import type { PrivateOperatorVoiceService } from "./private_voice_service.js";

class InvalidPrivateVoiceRequest extends Error {
  readonly statusCode = 400;
  readonly code = "VOICE_BAD_REQUEST";
}

function object(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InvalidPrivateVoiceRequest("Invalid voice request");
  }
  return body as Record<string, unknown>;
}

function required(
  body: Record<string, unknown>,
  field: string,
  max = 160,
): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new InvalidPrivateVoiceRequest("Invalid " + field);
  }
  return value;
}

function exact(body: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(body).some((key) => !keys.includes(key))) {
    throw new InvalidPrivateVoiceRequest("Unsupported voice request field");
  }
}

/** Isolated Fastify composition for F18/Work; not registered in shared app. */
export function registerPrivateOperatorVoiceRoutes(
  app: FastifyInstance,
  service: PrivateOperatorVoiceService,
): void {
  app.post("/agent/operator/voice/grant", async (request, reply) => {
    const body = object(request.body);
    exact(body, ["characterId", "characterSessionId", "admissionId"]);
    const result = await service.start({
      authorizationHeader: request.headers.authorization,
      characterId: required(body, "characterId"),
      characterSessionId: required(body, "characterSessionId"),
      admissionId: required(body, "admissionId"),
    });
    reply.header("cache-control", "no-store");
    return result;
  });

  app.get("/agent/operator/voice/turns/:requestId/status", async (request, reply) => {
    const query = object(request.query);
    exact(query, ["characterId", "characterSessionId"]);
    const params = object(request.params);
    exact(params, ["requestId"]);
    const result = await service.turnStatus({
      authorizationHeader: request.headers.authorization,
      characterId: required(query, "characterId"),
      characterSessionId: required(query, "characterSessionId"),
      requestId: required(params, "requestId"),
    });
    reply.header("cache-control", "no-store");
    return result;
  });
}

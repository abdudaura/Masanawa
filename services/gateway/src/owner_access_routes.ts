import type { FastifyInstance } from "fastify";
import type {
  OwnerAccessModality,
  OwnerAccessService,
} from "./owner_access.js";

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

function integer(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return parsed;
}

function modality(value: unknown): OwnerAccessModality {
  if (value !== "text" && value !== "voice" && value !== "video") {
    throw new TypeError("Invalid modality");
  }
  return value;
}

export function registerOwnerAccessRoutes(
  app: FastifyInstance,
  service: OwnerAccessService,
): void {
  app.post("/agent/twin/owner-access/quote", async (request) => {
    const body = request.body as Record<string, unknown>;
    return service.quote({
      authorizationHeader: request.headers.authorization,
      characterId: text(body.characterId, "characterId", 180),
      modality: modality(body.modality),
      durationMinutes: integer(body.durationMinutes, "durationMinutes", 5, 480),
    });
  });

  app.post("/agent/twin/owner-access/request", async (request) => {
    const body = request.body as Record<string, unknown>;
    return service.request({
      authorizationHeader: request.headers.authorization,
      characterId: text(body.characterId, "characterId", 180),
      quoteId: text(body.quoteId, "quoteId", 256),
    });
  });

  app.post("/agent/twin/owner-access/:requestId/action", async (request) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, unknown>;
    const action = body.action;
    if (
      action !== "accept" &&
      action !== "decline" &&
      action !== "schedule" &&
      action !== "start" &&
      action !== "complete" &&
      action !== "cancel" &&
      action !== "dispute"
    ) {
      throw new TypeError("Invalid owner access action");
    }
    return service.act({
      authorizationHeader: request.headers.authorization,
      characterId: text(body.characterId, "characterId", 180),
      requestId: text(params.requestId, "requestId"),
      action,
      ...(typeof body.scheduledFor === "string"
        ? { scheduledFor: body.scheduledFor }
        : {}),
      ...(typeof body.disputeReason === "string"
        ? {
            disputeReason: body.disputeReason as
              | "service-not-delivered"
              | "service-quality"
              | "other",
          }
        : {}),
    });
  });

  app.get("/agent/twin/owner-access/latest", async (request) => {
    const query = request.query as Record<string, unknown>;
    return service.latest({
      authorizationHeader: request.headers.authorization,
      characterId: text(query.characterId, "characterId", 180),
    });
  });

  app.post(
    "/agent/twin/owner-access/:requestId/heartbeat",
    async (request) => {
      const body = request.body as Record<string, unknown>;
      const params = request.params as Record<string, unknown>;
      return service.heartbeat({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 180),
        requestId: text(params.requestId, "requestId"),
      });
    },
  );

  app.get(
    "/agent/twin/owner-access/:requestId/messages",
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const params = request.params as Record<string, unknown>;
      return service.messages({
        authorizationHeader: request.headers.authorization,
        characterId: text(query.characterId, "characterId", 180),
        requestId: text(params.requestId, "requestId"),
        limit: integer(query.limit ?? 100, "limit", 1, 200),
      });
    },
  );

  app.post(
    "/agent/twin/owner-access/:requestId/messages",
    async (request) => {
      const body = request.body as Record<string, unknown>;
      const params = request.params as Record<string, unknown>;
      return service.sendMessage({
        authorizationHeader: request.headers.authorization,
        characterId: text(body.characterId, "characterId", 180),
        requestId: text(params.requestId, "requestId"),
        messageId: text(body.messageId, "messageId", 160),
        body: text(body.body, "body", 4000),
      });
    },
  );

  app.get("/agent/twin/owner-access/:requestId", async (request) => {
    const query = request.query as Record<string, unknown>;
    const params = request.params as Record<string, unknown>;
    return service.read({
      authorizationHeader: request.headers.authorization,
      characterId: text(query.characterId, "characterId", 180),
      requestId: text(params.requestId, "requestId"),
    });
  });
}

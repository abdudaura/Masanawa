import type { FastifyInstance } from "fastify";
import type { TwinReportReason, TwinSafetyService } from "./twin_safety.js";

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

function reportReason(value: unknown): TwinReportReason {
  return text(value, "reason", 64) as TwinReportReason;
}

export function registerTwinSafetyRoutes(
  app: FastifyInstance,
  service: TwinSafetyService,
): void {
  app.post("/agent/twin/:characterId/block", async (request) => {
    const params = request.params as Record<string, unknown>;
    return service.block({
      authorizationHeader: request.headers.authorization,
      characterId: text(params.characterId, "characterId", 180),
    });
  });

  app.delete("/agent/twin/:characterId/block", async (request) => {
    const params = request.params as Record<string, unknown>;
    return service.unblock({
      authorizationHeader: request.headers.authorization,
      characterId: text(params.characterId, "characterId", 180),
    });
  });

  app.post("/agent/twin/:characterId/report", async (request) => {
    const params = request.params as Record<string, unknown>;
    const body = request.body as Record<string, unknown>;
    return service.report({
      authorizationHeader: request.headers.authorization,
      characterId: text(params.characterId, "characterId", 180),
      reason: reportReason(body.reason),
      detail:
        body.detail === null || body.detail === undefined
          ? null
          : text(body.detail, "detail", 1000),
    });
  });
}

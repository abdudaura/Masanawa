import type { FastifyInstance } from "fastify";
import type { TwinActivityService } from "./twin_activity.js";

export function registerTwinActivityRoutes(
  app: FastifyInstance,
  service: TwinActivityService,
): void {
  app.get("/agent/twin/activity", async (request) => {
    const query = request.query as Record<string, unknown>;
    const raw = query.limit;
    let limit: number | undefined;
    if (raw !== undefined) {
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
        throw new TypeError("Invalid activity limit");
      }
      limit = value;
    }
    return service.read({
      authorizationHeader: request.headers.authorization,
      ...(limit === undefined ? {} : { limit }),
    });
  });
}

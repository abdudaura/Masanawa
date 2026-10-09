import type { FastifyInstance } from "fastify";
import type { TwinQualityService } from "./quality.js";

/** Shared Gateway owner mounts once; no competing app.ts edits. */
export function registerTwinQualityRoutes(app: FastifyInstance, service: TwinQualityService): void {
  app.get("/v1/twin-quality", async (request) => {
    const query = request.query as Record<string, unknown>;
    const value = query.limit;
    if (value !== undefined &&
        (typeof value !== "string" || !/^(?:[1-9]|[1-9][0-9]|100)$/u.test(value))) {
      throw new TypeError("Invalid Twin quality limit");
    }
    return service.read({
      authorizationHeader: request.headers.authorization,
      ...(value === undefined ? {} : {limit: Number(value)}),
    });
  });
}

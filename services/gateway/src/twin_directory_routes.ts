import type { FastifyInstance } from "fastify";
import type { TwinDirectoryService } from "./twin_directory.js";

export function registerTwinDirectoryRoutes(
  app: FastifyInstance,
  service: TwinDirectoryService,
): void {
  app.get("/agent/twins", async (request) => {
    const query = request.query as Record<string, unknown>;
    const rawLimit = query.limit;
    let limit: number | undefined;
    if (rawLimit !== undefined) {
      const value = typeof rawLimit === "number" ? rawLimit : Number(rawLimit);
      if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
        throw new TypeError("Invalid twin directory limit");
      }
      limit = value;
    }
    const rawQuery = query.q;
    if (rawQuery !== undefined && typeof rawQuery !== "string") {
      throw new TypeError("Invalid twin search query");
    }
    return service.search({
      authorizationHeader: request.headers.authorization,
      ...(rawQuery === undefined ? {} : { query: rawQuery }),
      ...(limit === undefined ? {} : { limit }),
    });
  });

  app.get("/agent/twins/:publicId", async (request, reply) => {
    const params = request.params as { publicId?: string };
    const item = await service.resolve({
      authorizationHeader: request.headers.authorization,
      publicId: params.publicId ?? "",
    });
    if (!item) return reply.code(404).send({ error: "Twin not found" });
    return item;
  });
}

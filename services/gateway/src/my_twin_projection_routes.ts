import type { FastifyInstance } from "fastify";
import type { MyTwinProjectionService } from "./my_twin_projection.js";

export function registerMyTwinProjectionRoutes(
  app: FastifyInstance,
  service: MyTwinProjectionService,
): void {
  app.get("/v1/my-twin", async (request) =>
    service.read({
      authorizationHeader: request.headers.authorization,
    }),
  );

  app.put("/v1/my-twin/discoverability", async (request) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.discoverable !== "boolean") {
      throw new TypeError("discoverable must be boolean");
    }
    return service.setDiscoverable({
      authorizationHeader: request.headers.authorization,
      discoverable: body.discoverable,
    });
  });
}

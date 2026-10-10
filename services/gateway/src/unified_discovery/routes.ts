import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { UnifiedDiscoveryService, DiscoveryFilter } from "./service.js";

/** Registered by the single Gateway composition owner, not by feature code. */
export function registerUnifiedDiscoveryRoutes(app: FastifyInstance, service: UnifiedDiscoveryService): void {
  app.get("/discovery/public", {
    schema: {
      querystring: Type.Object({
        q: Type.String({ minLength: 2, maxLength: 120 }),
        type: Type.Optional(Type.Union([
          Type.Literal("all"), Type.Literal("talks"), Type.Literal("people"),
          Type.Literal("experts"), Type.Literal("twins"),
        ])),
        liveOnly: Type.Optional(Type.Boolean()),
        offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 49 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
      }, { additionalProperties: false }),
    },
  }, async (request) => {
    const params = request.query as {
      q: string; type?: DiscoveryFilter; liveOnly?: boolean;
      offset?: number; limit?: number;
    };
    return service.search({
      authorizationHeader: request.headers.authorization,
      query: params.q,
      ...(params.type === undefined ? {} : { filter: params.type }),
      ...(params.liveOnly === undefined ? {} : { liveOnly: params.liveOnly }),
      ...(params.offset === undefined ? {} : { offset: params.offset }),
      ...(params.limit === undefined ? {} : { limit: params.limit }),
    });
  });
}

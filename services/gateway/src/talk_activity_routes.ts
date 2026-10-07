import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkActivityService } from "./talk_activity/service.js";

export function registerTalkActivityRoutes(
  app: FastifyInstance,
  service: TalkActivityService,
): void {
  app.get(
    "/activity",
    {
      schema: {
        querystring: Type.Object(
          {
            filter: Type.Optional(
              Type.Union([
                Type.Literal("all"),
                Type.Literal("talks"),
                Type.Literal("money"),
                Type.Literal("social"),
              ]),
            ),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 60 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as {
        filter?: "all" | "talks" | "money" | "social";
        limit?: number;
      };
      return service.read({
        authorizationHeader: request.headers.authorization,
        filter: query.filter ?? "all",
        limit: query.limit ?? 60,
      });
    },
  );
}

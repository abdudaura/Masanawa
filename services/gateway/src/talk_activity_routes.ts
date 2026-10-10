import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkActivityService } from "./talk_activity/service.js";

export function registerTalkActivityRoutes(
  app: FastifyInstance,
  service: TalkActivityService,
): void {
  app.post(
    "/activity/:activityId/read",
    {
      schema: {
        params: Type.Object(
          { activityId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { activityId } = request.params as { activityId: string };
      return service.markRead({
        authorizationHeader: request.headers.authorization,
        activityId,
      });
    },
  );

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

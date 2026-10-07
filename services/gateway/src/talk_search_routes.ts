import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkSearchType } from "./talk_search/model.js";
import type { TalkSearchService } from "./talk_search/service.js";

export function registerTalkSearchRoutes(
  app: FastifyInstance,
  search: TalkSearchService,
): void {
  app.get(
    "/search",
    {
      schema: {
        querystring: Type.Object(
          {
            q: Type.String({ minLength: 2, maxLength: 120 }),
            type: Type.Optional(
              Type.Union([
                Type.Literal("all"),
                Type.Literal("talks"),
                Type.Literal("people"),
                Type.Literal("experts"),
                Type.Literal("twins"),
              ]),
            ),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as {
        q: string;
        type?: TalkSearchType;
        limit?: number;
      };
      return search.search({
        authorizationHeader: request.headers.authorization,
        query: query.q,
        type: query.type ?? "all",
        limit: query.limit ?? 30,
      });
    },
  );
}

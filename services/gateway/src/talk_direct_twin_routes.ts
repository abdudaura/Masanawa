import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { DirectTwinService } from "./talk_direct_twin/service.js";

const params = Type.Object(
  {
    talkId: Type.String({ minLength: 1, maxLength: 256 }),
    seatId: Type.String({ minLength: 1, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export function registerDirectTwinRoutes(
  app: FastifyInstance,
  service: DirectTwinService,
): void {
  app.get(
    "/talks/:talkId/twin-seats/mine",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 256 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const path = request.params as { talkId: string };
      return service.mine({
        authorizationHeader: request.headers.authorization,
        talkId: path.talkId,
      });
    },
  );

  app.get(
    "/talks/:talkId/twin-seats/:seatId/direct",
    { schema: { params } },
    async (request) => {
      const path = request.params as { talkId: string; seatId: string };
      return service.read({
        authorizationHeader: request.headers.authorization,
        talkId: path.talkId,
        seatId: path.seatId,
      });
    },
  );

  app.put(
    "/talks/:talkId/twin-seats/:seatId/direct",
    {
      schema: {
        params,
        body: Type.Object(
          {
            expectedRevision: Type.Union([
              Type.Integer({ minimum: 0 }),
              Type.Null(),
            ]),
            instruction: Type.String({ minLength: 1, maxLength: 2000 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const path = request.params as { talkId: string; seatId: string };
      const body = request.body as {
        expectedRevision: number | null;
        instruction: string;
      };
      return service.set({
        authorizationHeader: request.headers.authorization,
        talkId: path.talkId,
        seatId: path.seatId,
        expectedRevision:
          body.expectedRevision === 0 ? null : body.expectedRevision,
        instruction: body.instruction,
      });
    },
  );

  app.delete(
    "/talks/:talkId/twin-seats/:seatId/direct",
    {
      schema: {
        params,
        querystring: Type.Object(
          {
            expectedRevision: Type.Integer({ minimum: 1 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const path = request.params as { talkId: string; seatId: string };
      const query = request.query as { expectedRevision: number };
      return service.clear({
        authorizationHeader: request.headers.authorization,
        talkId: path.talkId,
        seatId: path.seatId,
        expectedRevision: query.expectedRevision,
      });
    },
  );
}

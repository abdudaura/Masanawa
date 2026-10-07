import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkGiftService } from "./talk_gifts/service.js";

export function registerTalkGiftRoutes(
  app: FastifyInstance,
  gifts: TalkGiftService,
): void {
  app.post(
    "/talks/:talkId/gifts",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            requestId: Type.String({ minLength: 1, maxLength: 256 }),
            amountCredits: Type.Integer({
              minimum: 1,
              maximum: 1_000_000_000_000,
            }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const params = request.params as { talkId: string };
      const body = request.body as {
        requestId: string;
        amountCredits: number;
      };
      return gifts.gift({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        requestId: body.requestId,
        amountCredits: body.amountCredits,
      });
    },
  );
}

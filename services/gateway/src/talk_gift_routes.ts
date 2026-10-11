import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkGiftService } from "./talk_gifts/service.js";

export function registerTalkGiftRoutes(
  app: FastifyInstance,
  gifts: TalkGiftService,
): void {
  app.get(
    "/talks/:talkId/gifts/catalog",
    {
      schema: {
        params: Type.Object({ talkId: Type.String({ minLength: 1, maxLength: 160 }) }, { additionalProperties: false }),
      },
    },
    async (request) => {
      const params = request.params as { talkId: string };
      return gifts.catalog({ authorizationHeader: request.headers.authorization, talkId: params.talkId });
    },
  );

  app.post(
    "/talks/:talkId/gifts",
    {
      preValidation: async (request, reply) => {
        // Fastify's default validator strips extra keys; reject them before validation.
        const body = request.body;
        if (body !== null && typeof body === "object" && !Array.isArray(body)) {
          const allowed = ["requestId", "catalogItemId", "amountCredits"];
          if (Object.keys(body).some((key) => !allowed.includes(key))) {
            return reply.code(400).send({ message: "talks.gift.invalid_request" });
          }
        }
      },
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            requestId: Type.String({ minLength: 1, maxLength: 256 }),
            catalogItemId: Type.Optional(Type.String({ minLength: 1, maxLength: 48 })),
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
        catalogItemId?: string;
      };
      return gifts.gift({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        requestId: body.requestId,
        amountCredits: body.amountCredits,
        ...(body.catalogItemId !== undefined ? { catalogItemId: body.catalogItemId } : {}),
      });
    },
  );
}

import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkAiSeatService } from "./talk_ai_seats/service.js";

export function registerTalkAiSeatRoutes(
  app: FastifyInstance,
  service: TalkAiSeatService,
): void {
  app.get(
    "/talks/:talkId/ai-seats",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return service.candidates({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );

  app.post(
    "/talks/:talkId/ai-seat-quotes",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            personaId: Type.String({ minLength: 1, maxLength: 160 }),
            mode: Type.Union([
              Type.Literal("host_add"),
              Type.Literal("sponsor"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      const { talkId } = request.params as { talkId: string };
      const body = request.body as {
        personaId: string;
        mode: "host_add" | "sponsor";
      };
      const quote = await service.quote({
        authorizationHeader: request.headers.authorization,
        talkId,
        personaId: body.personaId,
        mode: body.mode,
      });
      reply.code(201);
      return quote;
    },
  );

  app.post(
    "/talks/:talkId/ai-seat-quotes/:quoteId/confirm",
    {
      schema: {
        params: Type.Object(
          {
            talkId: Type.String({ minLength: 1, maxLength: 160 }),
            quoteId: Type.String({ minLength: 1, maxLength: 160 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId, quoteId } = request.params as {
        talkId: string;
        quoteId: string;
      };
      return service.confirm({
        authorizationHeader: request.headers.authorization,
        talkId,
        quoteId,
      });
    },
  );
}

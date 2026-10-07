import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkPollService } from "./talk_polls/service.js";

const TalkParams = Type.Object(
  { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);
const PollParams = Type.Object(
  {
    talkId: Type.String({ minLength: 1, maxLength: 160 }),
    pollId: Type.String({ minLength: 1, maxLength: 160 }),
  },
  { additionalProperties: false },
);

export function registerTalkPollRoutes(
  app: FastifyInstance,
  polls: TalkPollService,
): void {
  app.get("/talks/:talkId/poll", { schema: { params: TalkParams } }, async request => {
    const { talkId } = request.params as { talkId: string };
    return polls.current({
      authorizationHeader: request.headers.authorization,
      talkId,
    });
  });

  app.post(
    "/talks/:talkId/polls",
    {
      schema: {
        params: TalkParams,
        body: Type.Object(
          {
            question: Type.String({ minLength: 1, maxLength: 240 }),
            options: Type.Array(
              Type.String({ minLength: 1, maxLength: 120 }),
              { minItems: 2, maxItems: 4 },
            ),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      const { talkId } = request.params as { talkId: string };
      const body = request.body as { question: string; options: string[] };
      const poll = await polls.create({
        authorizationHeader: request.headers.authorization,
        talkId,
        question: body.question,
        options: body.options,
      });
      reply.code(201);
      return poll;
    },
  );

  app.post(
    "/talks/:talkId/polls/:pollId/vote",
    {
      schema: {
        params: PollParams,
        body: Type.Object(
          { optionId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
      },
    },
    async request => {
      const { talkId, pollId } = request.params as {
        talkId: string;
        pollId: string;
      };
      const { optionId } = request.body as { optionId: string };
      return polls.vote({
        authorizationHeader: request.headers.authorization,
        talkId,
        pollId,
        optionId,
      });
    },
  );

  app.post(
    "/talks/:talkId/polls/:pollId/close",
    { schema: { params: PollParams } },
    async request => {
      const { talkId, pollId } = request.params as {
        talkId: string;
        pollId: string;
      };
      return polls.close({
        authorizationHeader: request.headers.authorization,
        talkId,
        pollId,
      });
    },
  );
}

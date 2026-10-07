import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkReplayService } from "./talk_replay/service.js";

export function registerTalkReplayRoutes(
  app: FastifyInstance,
  replay: TalkReplayService,
): void {
  app.get(
    "/talks/:talkId/replay",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 180 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return replay.view({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );

  app.post(
    "/talks/:talkId/replay/publication",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 1, maxLength: 180 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          { published: Type.Boolean() },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { published } = request.body as { published: boolean };
      return replay.setPublished({
        authorizationHeader: request.headers.authorization,
        talkId,
        published,
      });
    },
  );
}

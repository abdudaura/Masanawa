import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkLiveService } from "./talk_live/service.js";

const Params = Type.Object(
  { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);

export function registerTalkLiveRoutes(
  app: FastifyInstance,
  service: TalkLiveService,
): void {
  app.post(
    "/talks/:talkId/live/connect",
    { schema: { params: Params } },
    async (request, reply) => {
      const { talkId } = request.params as { talkId: string };
      const session = await service.connect({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
      reply.code(201);
      return session;
    },
  );

  app.post(
    "/talks/:talkId/live/heartbeat",
    {
      schema: {
        params: Params,
        body: Type.Object(
          { sessionId: Type.String({ minLength: 8, maxLength: 120 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { sessionId } = request.body as { sessionId: string };
      return service.heartbeat({
        authorizationHeader: request.headers.authorization,
        talkId,
        sessionId,
      });
    },
  );

  app.post(
    "/talks/:talkId/live/disconnect",
    {
      schema: {
        params: Params,
        body: Type.Object(
          { sessionId: Type.String({ minLength: 8, maxLength: 120 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { sessionId } = request.body as { sessionId: string };
      return service.disconnect({
        authorizationHeader: request.headers.authorization,
        talkId,
        sessionId,
      });
    },
  );

  app.get(
    "/talks/:talkId/live/state",
    { schema: { params: Params } },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return service.state({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );
}

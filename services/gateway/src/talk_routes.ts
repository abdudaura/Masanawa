import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkService } from "./talks/service.js";

export function registerTalkRoutes(app: FastifyInstance, talks: TalkService): void {
  app.get(
    "/talks",
    {
      schema: {
        querystring: Type.Object(
          {
            feed: Type.Optional(
              Type.Union([Type.Literal("explore"), Type.Literal("live")]),
            ),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as { feed?: "explore" | "live" };
      return talks.list({
        authorizationHeader: request.headers.authorization,
        feed: query.feed ?? "explore",
      });
    },
  );

  app.post(
    "/talks",
    {
      schema: {
        body: Type.Object(
          {
            topic: Type.String({ minLength: 1, maxLength: 240 }),
            title: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      const body = request.body as { topic: string; title?: string };
      const created = await talks.create({
        authorizationHeader: request.headers.authorization,
        topic: body.topic,
        ...(body.title === undefined ? {} : { title: body.title }),
      });
      reply.code(201);
      return created;
    },
  );

  app.get(
    "/talks/:talkId",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 8, maxLength: 128 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const params = request.params as { talkId: string };
      return talks.detail({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
      });
    },
  );

  app.patch(
    "/talks/:talkId",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 8, maxLength: 128 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            title: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
            topic: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
            summary: Type.Optional(Type.String({ maxLength: 1000 })),
          },
          { additionalProperties: false, minProperties: 1 },
        ),
      },
    },
    async (request) => {
      const params = request.params as { talkId: string };
      const body = request.body as {
        title?: string;
        topic?: string;
        summary?: string;
      };
      return talks.update({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        ...(body.title === undefined ? {} : { title: body.title }),
        ...(body.topic === undefined ? {} : { topic: body.topic }),
        ...(body.summary === undefined ? {} : { summary: body.summary }),
      });
    },
  );

  app.post(
    "/talks/:talkId/comments",
    {
      schema: {
        params: Type.Object(
          { talkId: Type.String({ minLength: 8, maxLength: 128 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          { body: Type.String({ minLength: 1, maxLength: 2000 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      const params = request.params as { talkId: string };
      const body = request.body as { body: string };
      const comment = await talks.comment({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        body: body.body,
      });
      reply.code(201);
      return comment;
    },
  );
}

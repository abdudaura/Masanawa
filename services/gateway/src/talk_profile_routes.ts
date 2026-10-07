import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkProfileService } from "./talk_profiles/service.js";

export function registerTalkProfileRoutes(
  app: FastifyInstance,
  service: TalkProfileService,
): void {
  app.get(
    "/profiles/:handle",
    {
      schema: {
        params: Type.Object(
          { handle: Type.String({ minLength: 2, maxLength: 40 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { handle } = request.params as { handle: string };
      return service.human({
        authorizationHeader: request.headers.authorization,
        handle,
      });
    },
  );

  app.post(
    "/profiles/:handle/follow",
    {
      schema: {
        params: Type.Object(
          { handle: Type.String({ minLength: 2, maxLength: 40 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          { following: Type.Boolean() },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { handle } = request.params as { handle: string };
      const { following } = request.body as { following: boolean };
      return service.follow({
        authorizationHeader: request.headers.authorization,
        handle,
        following,
      });
    },
  );

  app.get(
    "/profiles/by-user/:userId",
    {
      schema: {
        params: Type.Object(
          { userId: Type.String({ minLength: 3, maxLength: 256 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { userId } = request.params as { userId: string };
      return service.humanByUserId({
        authorizationHeader: request.headers.authorization,
        userId,
      });
    },
  );

  app.post(
    "/profiles/by-user/:userId/follow",
    {
      schema: {
        params: Type.Object(
          { userId: Type.String({ minLength: 3, maxLength: 256 }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          { following: Type.Boolean() },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const { following } = request.body as { following: boolean };
      return service.followUser({
        authorizationHeader: request.headers.authorization,
        userId,
        following,
      });
    },
  );

  app.get(
    "/personas/:publicId",
    {
      schema: {
        params: Type.Object(
          { publicId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { publicId } = request.params as { publicId: string };
      return service.persona({
        authorizationHeader: request.headers.authorization,
        publicId,
      });
    },
  );
}

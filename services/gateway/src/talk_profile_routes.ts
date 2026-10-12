import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkProfileService } from "./talk_profiles/service.js";

export function registerTalkProfileRoutes(
  app: FastifyInstance,
  service: TalkProfileService,
): void {
  app.get("/profiles/me", async (request) => {
    return service.self({
      authorizationHeader: request.headers.authorization,
    });
  });

  app.put(
    "/profiles/me",
    {
      preValidation: async (request, reply) => {
        // Reject unknown raw fields before Fastify's validator removes them.
        const body = request.body;
        if (body !== null && typeof body === "object" && !Array.isArray(body)) {
          const allowed = ["handle", "displayName", "bio"];
          if (Object.keys(body).some((key) => !allowed.includes(key))) {
            return reply.code(400).send({ message: "profiles.invalid_request" });
          }
        }
      },
      schema: {
        body: Type.Object(
          {
            handle: Type.String({ minLength: 2, maxLength: 40 }),
            displayName: Type.String({ minLength: 2, maxLength: 80 }),
            bio: Type.String({ maxLength: 300 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      const body = request.body as {
        handle: string;
        displayName: string;
        bio: string;
      };
      const created = await service.createSelf({
        authorizationHeader: request.headers.authorization,
        ...body,
      });
      reply.code(201);
      return created;
    },
  );

  app.patch(
    "/profiles/me",
    {
      preValidation: async (request, reply) => {
        // Reject unknown raw fields before Fastify's validator removes them.
        const body = request.body;
        if (body !== null && typeof body === "object" && !Array.isArray(body)) {
          const allowed = ["displayName", "bio", "removeAvatar"];
          if (Object.keys(body).some((key) => !allowed.includes(key))) {
            return reply.code(400).send({ message: "profiles.invalid_request" });
          }
        }
      },
      schema: {
        body: Type.Object(
          {
            displayName: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
            bio: Type.Optional(Type.String({ maxLength: 300 })),
            removeAvatar: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false, minProperties: 1 },
        ),
      },
    },
    async (request) => {
      const body = request.body as {
        displayName?: string;
        bio?: string;
        removeAvatar?: boolean;
      };
      return service.updateSelf({
        authorizationHeader: request.headers.authorization,
        ...body,
      });
    },
  );

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

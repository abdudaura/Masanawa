import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkLibraryService } from "./talk_library/service.js";

const TalkIdParams = Type.Object(
  { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);

export function registerTalkLibraryRoutes(
  app: FastifyInstance,
  library: TalkLibraryService,
): void {
  app.get("/me/talks", async (request) => {
    return library.myTalks({
      authorizationHeader: request.headers.authorization,
    });
  });

  app.get("/me/saved-talks", async (request) => {
    return library.savedTalks({
      authorizationHeader: request.headers.authorization,
    });
  });

  app.get(
    "/me/saved-talks/:talkId",
    { schema: { params: TalkIdParams } },
    async (request) => {
      const params = request.params as { talkId: string };
      return library.savedState({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
      });
    },
  );

  app.put(
    "/me/saved-talks/:talkId",
    { schema: { params: TalkIdParams } },
    async (request) => {
      const params = request.params as { talkId: string };
      return library.setSaved({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        saved: true,
      });
    },
  );

  app.delete(
    "/me/saved-talks/:talkId",
    { schema: { params: TalkIdParams } },
    async (request) => {
      const params = request.params as { talkId: string };
      return library.setSaved({
        authorizationHeader: request.headers.authorization,
        talkId: params.talkId,
        saved: false,
      });
    },
  );
}

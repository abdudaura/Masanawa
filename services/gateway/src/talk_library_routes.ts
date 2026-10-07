import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { TalkLibraryService } from "./talk_library/service.js";

const TalkParams = Type.Object(
  { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);

export function registerTalkLibraryRoutes(
  app: FastifyInstance,
  library: TalkLibraryService,
): void {
  app.get("/me/talks", async (request) =>
    library.mine({ authorizationHeader: request.headers.authorization }),
  );

  app.get("/me/saved-talks", async (request) =>
    library.saved({ authorizationHeader: request.headers.authorization }),
  );

  app.get(
    "/talks/:talkId/saved",
    { schema: { params: TalkParams } },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return library.savedState({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );

  app.post(
    "/talks/:talkId/saved",
    {
      schema: {
        params: TalkParams,
        body: Type.Object(
          { saved: Type.Boolean() },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { saved } = request.body as { saved: boolean };
      return library.setSaved({
        authorizationHeader: request.headers.authorization,
        talkId,
        saved,
      });
    },
  );
}

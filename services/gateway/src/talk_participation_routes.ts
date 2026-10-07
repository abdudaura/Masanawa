import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type {
  TalkHostParticipantAction,
  TalkHostRequestAction,
} from "./talk_participation/model.js";
import type { TalkParticipationService } from "./talk_participation/service.js";

const TalkParams = Type.Object(
  { talkId: Type.String({ minLength: 1, maxLength: 160 }) },
  { additionalProperties: false },
);

const RequestParams = Type.Object(
  {
    talkId: Type.String({ minLength: 1, maxLength: 160 }),
    requestId: Type.String({ minLength: 1, maxLength: 160 }),
  },
  { additionalProperties: false },
);

const ParticipantParams = Type.Object(
  {
    talkId: Type.String({ minLength: 1, maxLength: 160 }),
    participantId: Type.String({ minLength: 1, maxLength: 160 }),
  },
  { additionalProperties: false },
);

export function registerTalkParticipationRoutes(
  app: FastifyInstance,
  participation: TalkParticipationService,
): void {
  app.get(
    "/talks/:talkId/participation",
    { schema: { params: TalkParams } },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return participation.viewer({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );

  app.post(
    "/talks/:talkId/reactions",
    {
      schema: {
        params: TalkParams,
        body: Type.Object(
          {
            reaction: Type.Union([
              Type.Literal("❤️"),
              Type.Literal("👏"),
              Type.Literal("😂"),
              Type.Literal("💯"),
              Type.Literal("🤔"),
              Type.Literal("🔥"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { reaction } = request.body as { reaction: string };
      return participation.react({
        authorizationHeader: request.headers.authorization,
        talkId,
        reaction,
      });
    },
  );

  app.post(
    "/talks/:talkId/raise-hand",
    {
      schema: {
        params: TalkParams,
        body: Type.Object(
          { raised: Type.Boolean() },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      const { raised } = request.body as { raised: boolean };
      return participation.setHandRaised({
        authorizationHeader: request.headers.authorization,
        talkId,
        raised,
      });
    },
  );

  app.get(
    "/talks/:talkId/host-controls",
    { schema: { params: TalkParams } },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return participation.hostControls({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );

  app.post(
    "/talks/:talkId/host-requests/:requestId",
    {
      schema: {
        params: RequestParams,
        body: Type.Object(
          {
            action: Type.Union([
              Type.Literal("accept"),
              Type.Literal("decline"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId, requestId } = request.params as {
        talkId: string;
        requestId: string;
      };
      const { action } = request.body as { action: TalkHostRequestAction };
      return participation.actOnRequest({
        authorizationHeader: request.headers.authorization,
        talkId,
        requestId,
        action,
      });
    },
  );

  app.post(
    "/talks/:talkId/host-participants/:participantId",
    {
      schema: {
        params: ParticipantParams,
        body: Type.Object(
          {
            action: Type.Union([
              Type.Literal("mute"),
              Type.Literal("unmute"),
              Type.Literal("remove"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const { talkId, participantId } = request.params as {
        talkId: string;
        participantId: string;
      };
      const { action } = request.body as {
        action: TalkHostParticipantAction;
      };
      return participation.actOnParticipant({
        authorizationHeader: request.headers.authorization,
        talkId,
        participantId,
        action,
      });
    },
  );

  app.post(
    "/talks/:talkId/end",
    { schema: { params: TalkParams } },
    async (request) => {
      const { talkId } = request.params as { talkId: string };
      return participation.endTalk({
        authorizationHeader: request.headers.authorization,
        talkId,
      });
    },
  );
}

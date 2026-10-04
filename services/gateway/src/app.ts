import Fastify from "fastify";
import type { Instant } from "@masanawa/contracts";
import { nowInstant, parseCanonicalId } from "@masanawa/contracts";
import type { AgentDirectoryService } from "./agent_directory.js";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import type { CreatorCloneService } from "./creator_clone.js";
import {
  admitTelemetryCorrelation,
  injectCorrelationHeaders,
} from "@masanawa/telemetry";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Type from "typebox";

export interface ReadinessCheck {
  readonly name: string;
  check(): Promise<{ readonly ready: boolean; readonly reason?: string }>;
}

export interface GatewayAppOptions {
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly now?: () => Instant;
  readonly isDraining?: () => boolean;
  readonly agentDirectory?: AgentDirectoryService;
  readonly agentConversation?: AgentConversationService;
  readonly creatorClone?: CreatorCloneService;
}

const HealthResponseSchema = Type.Object(
  {
    service: Type.Literal("gateway"),
    status: Type.Literal("ok"),
    time: Type.String(),
  },
  { additionalProperties: false },
);

const ReadinessCheckSchema = Type.Object(
  {
    name: Type.String(),
    ready: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);


const AgentDirectoryEntrySchema = Type.Object(
  {
    characterId: Type.String(),
    characterVersionId: Type.String(),
    displayName: Type.String(),
    roleLabel: Type.String(),
    about: Type.String(),
    greeting: Type.Union([Type.String(), Type.Null()]),
    presence: Type.Literal("available"),
    activeWorkCount: Type.Literal(0),
    supportAgent: Type.Boolean(),
    defaultPlatformAgent: Type.Boolean(),
    voiceProvider: Type.Union([Type.String(), Type.Null()]),
    voiceName: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

const AgentDirectoryResponseSchema = Type.Object(
  {
    agents: Type.Array(AgentDirectoryEntrySchema),
  },
  { additionalProperties: false },
);


const AgentSessionOpenBodySchema = Type.Object(
  { characterId: Type.String() },
  { additionalProperties: false },
);

const AgentSessionOpenResponseSchema = Type.Object(
  { characterSessionId: Type.String() },
  { additionalProperties: false },
);

const AgentSessionParamsSchema = Type.Object(
  { characterSessionId: Type.String() },
  { additionalProperties: false },
);

const AgentTurnBodySchema = Type.Object(
  {
    characterId: Type.String(),
    text: Type.String({ minLength: 1, maxLength: 32000 }),
  },
  { additionalProperties: false },
);


const AgentMediaTurnBodySchema = Type.Object(
  {
    characterId: Type.String(),
    caption: Type.String({ maxLength: 32000 }),
    mimeType: Type.String({ minLength: 3, maxLength: 160 }),
    dataBase64: Type.String({ minLength: 1, maxLength: 12000000 }),
  },
  { additionalProperties: false },
);

const AgentTurnResponseSchema = Type.Object(
  {
    reply: Type.String(),
    agentRunId: Type.String(),
    parts: Type.Array(Type.Unknown()),
  },
  { additionalProperties: false },
);

const ReadinessResponseSchema = Type.Object(
  {
    service: Type.Literal("gateway"),
    status: Type.Union([Type.Literal("ready"), Type.Literal("not-ready")]),
    time: Type.String(),
    checks: Type.Array(ReadinessCheckSchema),
  },
  { additionalProperties: false },
);

export function createGatewayApp(options: GatewayAppOptions = {}) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576,
    requestTimeout: 30_000,
  }).withTypeProvider<TypeBoxTypeProvider>();

  const now = options.now ?? nowInstant;
  const checks = options.readinessChecks ?? [];

  app.addHook("onRequest", async (request, reply) => {
    const correlation = admitTelemetryCorrelation({
      carrier: {
        ...(request.headers.traceparent !== undefined
          ? { traceparent: request.headers.traceparent }
          : {}),
        ...(request.headers["x-request-id"] !== undefined
          ? { "x-request-id": request.headers["x-request-id"] }
          : {}),
        ...(request.headers["x-correlation-id"] !== undefined
          ? { "x-correlation-id": request.headers["x-correlation-id"] }
          : {}),
      },
    });
    const headers = injectCorrelationHeaders(correlation);

    request.headers.traceparent = headers.traceparent;
    request.headers["x-request-id"] = headers["x-request-id"];
    request.headers["x-correlation-id"] = headers["x-correlation-id"];
    reply.headers(headers);
  });


  if (options.agentDirectory) {
    const directory = options.agentDirectory;
    app.get(
      "/agent/directory",
      {
        schema: {
          response: { 200: AgentDirectoryResponseSchema },
        },
      },
      async (request) => ({
        agents: [
          ...(await directory.list({
            authorizationHeader: request.headers.authorization,
          })),
        ],
      }),
    );

    app.put(
      "/agent/preferences/default",
      {
        schema: {
          body: Type.Object(
            { characterId: Type.String() },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object(
              { characterId: Type.String() },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) =>
        directory.setDefaultPlatformAgent({
          authorizationHeader: request.headers.authorization,
          characterId: request.body.characterId,
        }),
    );
  }



  if (options.creatorClone) {
    const creatorClone = options.creatorClone;
    app.post(
      "/creator/clone",
      {
        schema: {
          body: Type.Object(
            {
              displayName: Type.String({ minLength: 1, maxLength: 120 }),
              biography: Type.String({ minLength: 1, maxLength: 1000 }),
              languages: Type.Array(
                Type.String({ minLength: 1, maxLength: 120 }),
                { minItems: 1, maxItems: 16 },
              ),
              personality: Type.Array(
                Type.String({ minLength: 1, maxLength: 120 }),
                { minItems: 1, maxItems: 24 },
              ),
              expertise: Type.Array(
                Type.String({ minLength: 1, maxLength: 120 }),
                { minItems: 1, maxItems: 32 },
              ),
            },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object(
              {
                created: Type.Boolean(),
                characterId: Type.String(),
                characterVersionId: Type.String(),
                relationshipId: Type.String(),
                displayName: Type.String(),
              },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) =>
        creatorClone.create({
          authorizationHeader: request.headers.authorization,
          ...request.body,
        }),
    );
  }

  if (options.agentConversation) {
    const conversation = options.agentConversation;

    app.post(
      "/agent/sessions/open",
      {
        schema: {
          body: AgentSessionOpenBodySchema,
          response: { 200: AgentSessionOpenResponseSchema },
        },
      },
      async (request) =>
        conversation.open({
          authorizationHeader: request.headers.authorization,
          characterId: request.body.characterId,
        }),
    );

    app.post(
      "/agent/sessions/:characterSessionId/turn",
      {
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentTurnBodySchema,
          response: { 200: AgentTurnResponseSchema },
        },
      },
      async (request) => {
        const result = await conversation.turn({
          authorizationHeader: request.headers.authorization,
          characterSessionId: request.params.characterSessionId,
          characterId: request.body.characterId,
          text: request.body.text,
          requestId: parseCanonicalId(
            "request",
            request.headers["x-request-id"] as string,
          ),
          correlationId: parseCanonicalId(
            "correlation",
            request.headers["x-correlation-id"] as string,
          ),
        });
        return {
          reply: result.reply,
          agentRunId: result.agentRunId,
          parts: [...result.parts],
        };
      },
    );


    app.post(
      "/agent/sessions/:characterSessionId/media-turn",
      {
        bodyLimit: 13_000_000,
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentMediaTurnBodySchema,
          response: { 200: AgentTurnResponseSchema },
        },
      },
      async (request) => {
        const result = await conversation.mediaTurn({
          authorizationHeader: request.headers.authorization,
          characterSessionId: request.params.characterSessionId,
          characterId: request.body.characterId,
          caption: request.body.caption,
          mimeType: request.body.mimeType,
          dataBase64: request.body.dataBase64,
          requestId: parseCanonicalId(
            "request",
            request.headers["x-request-id"] as string,
          ),
          correlationId: parseCanonicalId(
            "correlation",
            request.headers["x-correlation-id"] as string,
          ),
        });
        return {
          reply: result.reply,
          agentRunId: result.agentRunId,
          parts: [...result.parts],
        };
      },
    );

    app.post(
      "/agent/sessions/:characterSessionId/close",
      {
        schema: {
          params: AgentSessionParamsSchema,
          body: Type.Object(
            { characterId: Type.String() },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object(
              { closed: Type.Literal(true) },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) => {
        await conversation.close({
          authorizationHeader: request.headers.authorization,
          characterSessionId: request.params.characterSessionId,
          characterId: request.body.characterId,
        });
        return { closed: true as const };
      },
    );
  }

  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => ({
      service: "gateway" as const,
      status: "ok" as const,
      time: now(),
    }),
  );

  app.get(
    "/readyz",
    {
      schema: {
        response: {
          200: ReadinessResponseSchema,
          503: ReadinessResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const dependencyResults = await Promise.all(
        checks.map(async (check) => {
          try {
            const result = await check.check();
            return {
              name: check.name,
              ready: result.ready,
              ...(result.reason ? { reason: result.reason } : {}),
            };
          } catch {
            return {
              name: check.name,
              ready: false,
              reason: "readiness check failed",
            };
          }
        }),
      );

      const results = [
        ...(options.isDraining?.()
          ? [
              {
                name: "lifecycle",
                ready: false,
                reason: "service is shutting down",
              },
            ]
          : []),
        ...dependencyResults,
      ];

      const ready = results.every((result) => result.ready);
      if (!ready) {
        reply.code(503);
      }

      return {
        service: "gateway" as const,
        status: ready ? ("ready" as const) : ("not-ready" as const),
        time: now(),
        checks: results,
      };
    },
  );

  return app;
}

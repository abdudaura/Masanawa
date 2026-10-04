import Fastify from "fastify";
import type { Instant } from "@masanawa/contracts";
import { nowInstant, parseCanonicalId } from "@masanawa/contracts";
import type { AgentDirectoryService } from "./agent_directory.js";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import type { FinancialService } from "./financial_service.js";
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
  readonly financial?: FinancialService;
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

const AgentMediaSetTurnBodySchema = Type.Object(
  {
    characterId: Type.String(),
    caption: Type.String({ maxLength: 32000 }),
    media: Type.Array(
      Type.Object(
        {
          mimeType: Type.String({ minLength: 3, maxLength: 160 }),
          dataBase64: Type.String({ minLength: 1, maxLength: 12000000 }),
          name: Type.Optional(Type.String({ maxLength: 240 })),
        },
        { additionalProperties: false },
      ),
      { minItems: 2, maxItems: 8 },
    ),
  },
  { additionalProperties: false },
);

const AgentTurnResponseSchema = Type.Object(
  {
    reply: Type.String(),
    agentRunId: Type.String(),
    parts: Type.Array(Type.Unknown()),
    audioBase64: Type.Optional(Type.String()),
    audioMimeType: Type.Optional(Type.String()),
    audioDurationMs: Type.Optional(Type.Number()),
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
      "/v1/agent/directory",
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
  }


  if (options.agentConversation) {
    const conversation = options.agentConversation;

    app.post(
      "/v1/agent/sessions/open",
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
      "/v1/agent/sessions/:characterSessionId/turn",
      {
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentTurnBodySchema,
          response: { 200: AgentTurnResponseSchema },
        },
      },
      async (request, reply) => {
        const controller = new AbortController();
        let finished = false;
        const abort = () => {
          if (!finished) controller.abort();
        };
        reply.raw.once("close", abort);
        try {
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
            signal: controller.signal,
          });
          return {
            reply: result.reply,
            agentRunId: result.agentRunId,
            parts: [...result.parts],
            ...(result.audioBase64 ? { audioBase64: result.audioBase64 } : {}),
            ...(result.audioMimeType ? { audioMimeType: result.audioMimeType } : {}),
            ...(result.audioDurationMs !== undefined
              ? { audioDurationMs: result.audioDurationMs }
              : {}),
          };
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
      },
    );


    app.post(
      "/v1/agent/sessions/:characterSessionId/turn-stream",
      {
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentTurnBodySchema,
        },
      },
      async (request, reply) => {
        reply.hijack();
        reply.raw.statusCode = 200;
        reply.raw.setHeader("content-type", "application/x-ndjson; charset=utf-8");
        reply.raw.setHeader("cache-control", "no-cache, no-transform");
        reply.raw.setHeader("x-content-type-options", "nosniff");

        const controller = new AbortController();
        let finished = false;
        const abort = () => {
          if (!finished) controller.abort();
        };
        reply.raw.once("close", abort);

        const emit = (event: Record<string, unknown>) => {
          if (!reply.raw.destroyed && !reply.raw.writableEnded) {
            reply.raw.write(JSON.stringify(event) + "\n");
          }
        };

        try {
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
            onTextDelta: async (delta) => {
              if (delta) emit({ type: "delta", text: delta });
            },
            onAudioPcmChunk: async (dataBase64) => {
              if (dataBase64) {
                emit({
                  type: "audio",
                  mimeType: "audio/pcm;rate=24000",
                  sampleRate: 24000,
                  dataBase64,
                });
              }
            },
            signal: controller.signal,
          });
          emit({
            type: "done",
            reply: result.reply,
            agentRunId: result.agentRunId,
            parts: [...result.parts],
            ...(result.audioBase64 ? { audioBase64: result.audioBase64 } : {}),
            ...(result.audioMimeType ? { audioMimeType: result.audioMimeType } : {}),
            ...(result.audioDurationMs !== undefined
              ? { audioDurationMs: result.audioDurationMs }
              : {}),
          });
        } catch {
          emit({ type: "error", code: "turn_failed" });
        } finally {
          finished = true;
          reply.raw.off("close", abort);
          if (!reply.raw.writableEnded) reply.raw.end();
        }
      },
    );


    app.post(
      "/v1/agent/sessions/:characterSessionId/media-turn",
      {
        bodyLimit: 13_000_000,
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentMediaTurnBodySchema,
          response: { 200: AgentTurnResponseSchema },
        },
      },
      async (request, reply) => {
        const controller = new AbortController();
        let finished = false;
        const abort = () => {
          if (!finished) controller.abort();
        };
        reply.raw.once("close", abort);
        try {
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
            signal: controller.signal,
          });
          return {
            reply: result.reply,
            agentRunId: result.agentRunId,
            parts: [...result.parts],
            ...(result.audioBase64 ? { audioBase64: result.audioBase64 } : {}),
            ...(result.audioMimeType ? { audioMimeType: result.audioMimeType } : {}),
            ...(result.audioDurationMs !== undefined
              ? { audioDurationMs: result.audioDurationMs }
              : {}),
          };
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
      },
    );

    app.post(
      "/v1/agent/sessions/:characterSessionId/media-set-turn",
      {
        bodyLimit: 17_000_000,
        schema: {
          params: AgentSessionParamsSchema,
          body: AgentMediaSetTurnBodySchema,
          response: { 200: AgentTurnResponseSchema },
        },
      },
      async (request, reply) => {
        const controller = new AbortController();
        let finished = false;
        const abort = () => {
          if (!finished) controller.abort();
        };
        reply.raw.once("close", abort);
        try {
          const result = await conversation.mediaSetTurn({
            authorizationHeader: request.headers.authorization,
            characterSessionId: request.params.characterSessionId,
            characterId: request.body.characterId,
            caption: request.body.caption,
            media: request.body.media,
            requestId: parseCanonicalId(
              "request",
              request.headers["x-request-id"] as string,
            ),
            correlationId: parseCanonicalId(
              "correlation",
              request.headers["x-correlation-id"] as string,
            ),
            signal: controller.signal,
          });
          return {
            reply: result.reply,
            agentRunId: result.agentRunId,
            parts: [...result.parts],
            ...(result.audioBase64 ? { audioBase64: result.audioBase64 } : {}),
            ...(result.audioMimeType ? { audioMimeType: result.audioMimeType } : {}),
            ...(result.audioDurationMs !== undefined
              ? { audioDurationMs: result.audioDurationMs }
              : {}),
          };
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
      },
    );


    app.post(
      "/v1/agent/sessions/:characterSessionId/close",
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


  if (options.financial) {
    const financial = options.financial;

    app.get(
      "/v1/financial/crypto/routes",
      {
        schema: {
          response: {
            200: Type.Object(
              {
                routes: Type.Array(
                  Type.Object(
                    {
                      providerCode: Type.String(),
                      asset: Type.String(),
                      network: Type.Union([Type.String(), Type.Null()]),
                    },
                    { additionalProperties: true },
                  ),
                ),
              },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) => ({
        routes: (await financial.listDepositRoutes({
          authorizationHeader: request.headers.authorization,
        })).map((route) => ({
          providerCode: route.providerCode,
          asset: route.asset,
          network: route.network,
        })),
      }),
    );

    app.post(
      "/v1/financial/crypto/deposits",
      {
        schema: {
          body: Type.Object(
            {
              requestId: Type.String(),
              providerCode: Type.String({ minLength: 2, maxLength: 32 }),
              amount: Type.String({ minLength: 1, maxLength: 80 }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request) =>
        financial.createDeposit({
          authorizationHeader: request.headers.authorization,
          requestId: request.body.requestId,
          providerCode: request.body.providerCode,
          amount: request.body.amount,
        }),
    );

    app.get(
      "/v1/financial/crypto/balances/:providerCode",
      {
        schema: {
          params: Type.Object(
            { providerCode: Type.String({ minLength: 2, maxLength: 32 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request) =>
        financial.readBalance({
          authorizationHeader: request.headers.authorization,
          providerCode: request.params.providerCode,
        }),
    );

    app.get(
      "/v1/financial/crypto/history",
      {
        schema: {
          querystring: Type.Object(
            { limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) },
            { additionalProperties: false },
          ),
        },
      },
      async (request) => ({
        intents: await financial.listHistory({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        }),
      }),
    );

    app.get(
      "/v1/financial/crypto/intents/:requestId",
      {
        schema: {
          params: Type.Object(
            { requestId: Type.String() },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        const intent = await financial.readIntent({
          authorizationHeader: request.headers.authorization,
          requestId: request.params.requestId,
        });
        if (!intent) {
          reply.code(404);
          return { error: "intent_not_found" };
        }
        return intent;
      },
    );

    app.post(
      "/v1/financial/nowpayments/ipn",
      {
        bodyLimit: 256_000,
        schema: {
          headers: Type.Object(
            { "x-nowpayments-sig": Type.String({ minLength: 128, maxLength: 128 }) },
            { additionalProperties: true },
          ),
          body: Type.Unknown(),
        },
      },
      async (request, reply) => {
        await financial.handleNowPaymentsIpn({
          signature: request.headers["x-nowpayments-sig"],
          payload: request.body,
        });
        reply.code(202);
        return { accepted: true as const };
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

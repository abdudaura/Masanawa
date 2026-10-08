import Fastify from "fastify";
import type { Instant } from "@masanawa/contracts";
import { nowInstant, parseCanonicalId } from "@masanawa/contracts";
import type { AgentAdminService } from "./agent_admin.js";
import type { OperatorAgentControl } from "./operator_admin/agent_control.js";
import { registerOperatorAgentRoutes } from "./operator_admin/routes.js";
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

export interface OpsAppOptions {
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly now?: () => Instant;
  readonly isDraining?: () => boolean;
  readonly agentAdmin?: AgentAdminService;
  readonly operatorAgentControl?: OperatorAgentControl;
}

const HealthResponseSchema = Type.Object(
  {
    service: Type.Literal("ops"),
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


const AgentPresentationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    tenantId: Type.String(),
    characterId: Type.String(),
    characterVersionId: Type.String(),
    displayName: Type.String(),
    roleLabel: Type.String(),
    about: Type.String(),
    greeting: Type.Union([Type.String(), Type.Null()]),
    visibleInUserApp: Type.Boolean(),
    sortOrder: Type.Integer(),
    revision: Type.Integer(),
  },
  { additionalProperties: false },
);


const AgentAdminSkillOptionSchema = Type.Object(
  {
    skillVersionId: Type.String(),
    key: Type.String(),
    version: Type.String(),
    displayName: Type.String(),
    description: Type.String(),
    readiness: Type.Union([
      Type.Literal("ready"),
      Type.Literal("degraded"),
      Type.Literal("blocked"),
      Type.Literal("disabled"),
      Type.Literal("unknown"),
    ]),
    advertised: Type.Boolean(),
  },
  { additionalProperties: false },
);

const AgentSkillAssignmentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    tenantId: Type.String(),
    characterId: Type.String(),
    skillVersionIds: Type.Array(Type.String()),
    revision: Type.Integer(),
  },
  { additionalProperties: false },
);

const PutPresentationBodySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    characterVersionId: Type.String(),
    displayName: Type.String({ minLength: 1, maxLength: 120 }),
    roleLabel: Type.String({ minLength: 1, maxLength: 120 }),
    about: Type.String({ maxLength: 500 }),
    greeting: Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]),
    visibleInUserApp: Type.Boolean(),
    sortOrder: Type.Integer({ minimum: 0, maximum: 1000000 }),
    expectedRevision: Type.Union([
      Type.Integer({ minimum: 1 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const PutSkillsBodySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    skillVersionIds: Type.Array(Type.String(), { maxItems: 64 }),
    expectedRevision: Type.Union([
      Type.Integer({ minimum: 1 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const CharacterParamsSchema = Type.Object(
  { characterId: Type.String() },
  { additionalProperties: false },
);

const ReadinessResponseSchema = Type.Object(
  {
    service: Type.Literal("ops"),
    status: Type.Union([Type.Literal("ready"), Type.Literal("not-ready")]),
    time: Type.String(),
    checks: Type.Array(ReadinessCheckSchema),
  },
  { additionalProperties: false },
);

export function createOpsApp(options: OpsAppOptions = {}) {
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


  if (options.agentAdmin) {
    const agentAdmin = options.agentAdmin;

    app.get(
      "/v1/agents",
      {
        schema: {
          response: { 200: Type.Array(AgentPresentationSchema) },
        },
      },
      async (request) => [
        ...await agentAdmin.listPresentations({
          authorizationHeader: request.headers.authorization,
        }),
      ],
    );

    app.put(
      "/v1/agents/:characterId/presentation",
      {
        schema: {
          params: CharacterParamsSchema,
          body: PutPresentationBodySchema,
          response: { 200: AgentPresentationSchema },
        },
      },
      async (request) => {
        const body = request.body;
        return agentAdmin.putPresentation({
          authorizationHeader: request.headers.authorization,
          expectedRevision: body.expectedRevision,
          presentation: {
            schemaVersion: 1,
            characterId: parseCanonicalId(
              "character",
              request.params.characterId,
            ),
            characterVersionId: parseCanonicalId(
              "character-version",
              body.characterVersionId,
            ),
            displayName: body.displayName,
            roleLabel: body.roleLabel,
            about: body.about,
            greeting: body.greeting,
            visibleInUserApp: body.visibleInUserApp,
            sortOrder: body.sortOrder,
            revision: body.expectedRevision ?? 1,
          },
        });
      },
    );


    app.get(
      "/v1/skills",
      {
        schema: {
          response: { 200: Type.Array(AgentAdminSkillOptionSchema) },
        },
      },
      async (request) => [
        ...await agentAdmin.listSkills({
          authorizationHeader: request.headers.authorization,
        }),
      ],
    );

    app.get(
      "/v1/agents/:characterId/skills",
      {
        schema: {
          params: CharacterParamsSchema,
          response: {
            200: Type.Union([AgentSkillAssignmentSchema, Type.Null()]),
          },
        },
      },
      async (request) => {
        const assignment = await agentAdmin.readSkillAssignment({
          authorizationHeader: request.headers.authorization,
          characterId: parseCanonicalId(
            "character",
            request.params.characterId,
          ),
        });
        return assignment ? { ...assignment, skillVersionIds: [...assignment.skillVersionIds] } : null;
      },
    );

    app.put(
      "/v1/agents/:characterId/skills",
      {
        schema: {
          params: CharacterParamsSchema,
          body: PutSkillsBodySchema,
          response: { 200: AgentSkillAssignmentSchema },
        },
      },
      async (request) => {
        const body = request.body;
        const assignment = await agentAdmin.putSkillAssignment({
          authorizationHeader: request.headers.authorization,
          expectedRevision: body.expectedRevision,
          assignment: {
            schemaVersion: 1,
            characterId: parseCanonicalId(
              "character",
              request.params.characterId,
            ),
            skillVersionIds: body.skillVersionIds.map((id) =>
              parseCanonicalId("skill-version", id),
            ),
            revision: body.expectedRevision ?? 1,
          },
        });
        return { ...assignment, skillVersionIds: [...assignment.skillVersionIds] };
      },
    );
  }

  if (options.operatorAgentControl) {
    registerOperatorAgentRoutes(app, options.operatorAgentControl);
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
      service: "ops" as const,
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
        service: "ops" as const,
        status: ready ? ("ready" as const) : ("not-ready" as const),
        time: now(),
        checks: results,
      };
    },
  );

  return app;
}


import Fastify from "fastify";
import type { Instant } from "@masanawa/contracts";
import { nowInstant, parseCanonicalId } from "@masanawa/contracts";
import type { AgentAdminService } from "./agent_admin.js";
import type { PlatformAdminService } from "./platform_admin.js";
import type { SystemAdminService } from "./system_admin.js";
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
  readonly platformAdmin?: PlatformAdminService;
  readonly systemAdmin?: SystemAdminService;
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
    reasonCode: Type.Union([Type.String(), Type.Null()]),
    checkedAt: Type.Union([Type.String(), Type.Null()]),
    revision: Type.Union([Type.Integer(), Type.Null()]),
  },
  { additionalProperties: false },
);


const PutSkillReadinessBodySchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("ready"),
      Type.Literal("degraded"),
      Type.Literal("blocked"),
      Type.Literal("disabled"),
    ]),
    advertised: Type.Boolean(),
    reasonCode: Type.Union([Type.String({ maxLength: 200 }), Type.Null()]),
    expectedRevision: Type.Union([
      Type.Integer({ minimum: 1 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const SkillVersionParamsSchema = Type.Object(
  { skillVersionId: Type.String() },
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




const OperationParamsSchema = Type.Object(
  { operationId: Type.String() },
  { additionalProperties: false },
);

const CredentialParamsSchema = Type.Object(
  { credentialRefId: Type.String() },
  { additionalProperties: false },
);

const RevokeCredentialBodySchema = Type.Object(
  {
    providerId: Type.String(),
    slotKey: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

const WorldParamsSchema = Type.Object(
  { worldId: Type.String() },
  { additionalProperties: false },
);

const PutWorldStateBodySchema = Type.Object(
  { expectedRevision: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);

const OfferParamsSchema = Type.Object(
  { offerId: Type.String() },
  { additionalProperties: false },
);

const PutOfferRevisionBodySchema = Type.Object(
  {
    key: Type.String({
      minLength: 1,
      maxLength: 128,
      pattern: "^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$",
    }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ minLength: 1, maxLength: 4000 }),
    skillVersionId: Type.String(),
    priceCredits: Type.Integer({ minimum: 1 }),
    fulfillmentReserveCredits: Type.Integer({ minimum: 0 }),
    creatorCommissionCredits: Type.Integer({ minimum: 0 }),
    fallbackCommissionCredits: Type.Integer({ minimum: 0 }),
    platformMarginCredits: Type.Integer({ minimum: 0 }),
    regions: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
      maxItems: 64,
      uniqueItems: true,
    }),
    enabled: Type.Boolean(),
    expectedRevision: Type.Union([
      Type.Integer({ minimum: 1 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);

const PutOfferEnabledBodySchema = Type.Object(
  {
    enabled: Type.Boolean(),
    expectedRevision: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

const AdminLimitQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
  },
  { additionalProperties: false },
);

const AdminUserListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
    state: Type.Optional(Type.Union([
      Type.Literal("active"),
      Type.Literal("disabled"),
      Type.Literal("archived"),
    ])),
  },
  { additionalProperties: false },
);

const AdminAgentRunListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
    state: Type.Optional(Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ])),
  },
  { additionalProperties: false },
);

const AdminOperationListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
    state: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  },
  { additionalProperties: false },
);

const AdminReconciliationListQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
    status: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  },
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

    app.put(
      "/v1/skills/:skillVersionId/readiness",
      {
        schema: {
          params: SkillVersionParamsSchema,
          body: PutSkillReadinessBodySchema,
          response: { 200: AgentAdminSkillOptionSchema },
        },
      },
      async (request) =>
        agentAdmin.putSkillReadiness({
          authorizationHeader: request.headers.authorization,
          skillVersionId: request.params.skillVersionId,
          state: request.body.state,
          advertised: request.body.advertised,
          reasonCode: request.body.reasonCode,
          expectedRevision: request.body.expectedRevision,
        }),
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


  if (options.platformAdmin) {
    const platformAdmin = options.platformAdmin;

    app.get("/v1/admin/summary", async (request) =>
      platformAdmin.summary({
        authorizationHeader: request.headers.authorization,
      }),
    );

    app.get(
      "/v1/admin/characters",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listCharacters({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/users",
      { schema: { querystring: AdminUserListQuerySchema } },
      async (request) => [
        ...await platformAdmin.listUsers({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.state !== undefined ? { state: request.query.state } : {}),
        }),
      ],
    );


    app.get(
      "/v1/admin/agent-runs",
      { schema: { querystring: AdminAgentRunListQuerySchema } },
      async (request) => [
        ...await platformAdmin.listAgentRuns({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.state !== undefined ? { state: request.query.state } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/offers",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listOffers({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );

    app.post(
      "/v1/admin/offers",
      { schema: { body: PutOfferRevisionBodySchema } },
      async (request) =>
        platformAdmin.saveOfferRevision({
          authorizationHeader: request.headers.authorization,
          offerId: null,
          expectedRevision: null,
          key: request.body.key,
          title: request.body.title,
          description: request.body.description,
          skillVersionId: request.body.skillVersionId,
          priceCredits: request.body.priceCredits,
          fulfillmentReserveCredits: request.body.fulfillmentReserveCredits,
          creatorCommissionCredits: request.body.creatorCommissionCredits,
          fallbackCommissionCredits: request.body.fallbackCommissionCredits,
          platformMarginCredits: request.body.platformMarginCredits,
          regions: request.body.regions,
          enabled: request.body.enabled,
        }),
    );

    app.put(
      "/v1/admin/offers/:offerId",
      {
        schema: {
          params: OfferParamsSchema,
          body: PutOfferRevisionBodySchema,
        },
      },
      async (request) =>
        platformAdmin.saveOfferRevision({
          authorizationHeader: request.headers.authorization,
          offerId: request.params.offerId,
          expectedRevision: request.body.expectedRevision,
          key: request.body.key,
          title: request.body.title,
          description: request.body.description,
          skillVersionId: request.body.skillVersionId,
          priceCredits: request.body.priceCredits,
          fulfillmentReserveCredits: request.body.fulfillmentReserveCredits,
          creatorCommissionCredits: request.body.creatorCommissionCredits,
          fallbackCommissionCredits: request.body.fallbackCommissionCredits,
          platformMarginCredits: request.body.platformMarginCredits,
          regions: request.body.regions,
          enabled: request.body.enabled,
        }),
    );

    app.put(
      "/v1/admin/offers/:offerId/enabled",
      {
        schema: {
          params: OfferParamsSchema,
          body: PutOfferEnabledBodySchema,
        },
      },
      async (request) =>
        platformAdmin.setOfferEnabled({
          authorizationHeader: request.headers.authorization,
          offerId: request.params.offerId,
          expectedRevision: request.body.expectedRevision,
          enabled: request.body.enabled,
        }),
    );

    app.get(
      "/v1/admin/fulfillments",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listFulfillments({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/ledger",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listLedger({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/operations",
      { schema: { querystring: AdminOperationListQuerySchema } },
      async (request) => [
        ...await platformAdmin.listOperations({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.state !== undefined ? { state: request.query.state } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/operations/:operationId/receipts",
      { schema: { params: OperationParamsSchema } },
      async (request) => [
        ...await platformAdmin.listOperationReceipts({
          authorizationHeader: request.headers.authorization,
          operationId: parseCanonicalId("operation", request.params.operationId),
        }),
      ],
    );

    app.get(
      "/v1/admin/reconciliation",
      { schema: { querystring: AdminReconciliationListQuerySchema } },
      async (request) => [
        ...await platformAdmin.listReconciliation({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
          ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        }),
      ],
    );

    app.get(
      "/v1/admin/provider-credentials",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listCredentialRefs({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );

    app.post(
      "/v1/admin/provider-credentials/:credentialRefId/revoke",
      {
        schema: {
          params: CredentialParamsSchema,
          body: RevokeCredentialBodySchema,
        },
      },
      async (request) =>
        platformAdmin.revokeCredentialRef({
          authorizationHeader: request.headers.authorization,
          credentialRefId: request.params.credentialRefId,
          providerId: request.body.providerId,
          slotKey: request.body.slotKey,
        }),
    );

    app.get(
      "/v1/admin/audit",
      { schema: { querystring: AdminLimitQuerySchema } },
      async (request) => [
        ...await platformAdmin.listAuditEvents({
          authorizationHeader: request.headers.authorization,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        }),
      ],
    );
  }


  if (options.systemAdmin) {
    const systemAdmin = options.systemAdmin;

    app.get("/v1/admin/system", async (request) =>
      systemAdmin.snapshot({
        authorizationHeader: request.headers.authorization,
      }),
    );

    app.get("/v1/admin/memory-jobs", async (request) => [
      ...await systemAdmin.listMemoryJobs({
        authorizationHeader: request.headers.authorization,
      }),
    ]);

    app.get("/v1/admin/queue-issues", async (request) => [
      ...await systemAdmin.listQueueIssues({
        authorizationHeader: request.headers.authorization,
      }),
    ]);

    app.get("/v1/admin/worlds", async (request) => [
      ...await systemAdmin.listWorlds({
        authorizationHeader: request.headers.authorization,
      }),
    ]);

    app.put(
      "/v1/admin/worlds/:worldId/pause",
      {
        schema: {
          params: WorldParamsSchema,
          body: PutWorldStateBodySchema,
        },
      },
      async (request) =>
        systemAdmin.pauseWorld({
          authorizationHeader: request.headers.authorization,
          worldId: request.params.worldId,
          expectedRevision: request.body.expectedRevision,
        }),
    );

    app.put(
      "/v1/admin/worlds/:worldId/resume",
      {
        schema: {
          params: WorldParamsSchema,
          body: PutWorldStateBodySchema,
        },
      },
      async (request) =>
        systemAdmin.resumeWorld({
          authorizationHeader: request.headers.authorization,
          worldId: request.params.worldId,
          expectedRevision: request.body.expectedRevision,
        }),
    );

    app.get("/v1/admin/approvals", async (request) => [
      ...await systemAdmin.listApprovals({
        authorizationHeader: request.headers.authorization,
      }),
    ]);
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

import { registerIncomingCallRoutes } from "./incoming_calls/routes.js";
import { IncomingCallError, type IncomingCallService } from "./incoming_calls/service.js";
import { registerGroupCallRoutes } from "./group_calls/routes.js";
import { GroupCallError, type GroupCallService } from "./group_calls/service.js";
import Fastify from "fastify";
import type { Instant } from "@masanawa/contracts";
import { nowInstant, parseCanonicalId } from "@masanawa/contracts";
import type { AgentDirectoryService } from "./agent_directory.js";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import type { CreatorCloneService } from "./creator_clone.js";
import type { CreatorEconomyService } from "./creator_economy.js";
import type { CreatorSkillService } from "./creator_skills.js";
import type { CommerceCatalogService } from "./commerce_catalog.js";
import type { CommerceFulfillmentService } from "./commerce_fulfillment.js";
import type {
  AgentShellService,
  LiveVoiceTokenService,
} from "./agent_shell_contract.js";
import { registerAgentShellRoutes } from "./agent_shell_routes.js";
import { registerBillingRoutes } from "./billing_routes.js";
import { registerTalkRoutes } from "./talk_routes.js";
import { registerTalkReplayRoutes } from "./talk_replay_routes.js";
import type { TalkReplayService } from "./talk_replay/service.js";
import { registerTalkModerationRoutes } from "./talk_moderation_routes.js";
import type { TalkModerationService } from "./talk_moderation/service.js";
import { registerTalkAiSeatRoutes } from "./talk_ai_seat_routes.js";
import type { TalkAiSeatService } from "./talk_ai_seats/service.js";
import { registerTalkLiveRoutes } from "./talk_live_routes.js";
import type { TalkLiveService } from "./talk_live/service.js";
import { registerTalkProfileRoutes } from "./talk_profile_routes.js";
import type { TalkProfileService } from "./talk_profiles/service.js";
import { registerTalkActivityRoutes } from "./talk_activity_routes.js";
import type { TalkActivityService } from "./talk_activity/service.js";
import { registerTalkSearchRoutes } from "./talk_search_routes.js";
import type { TalkSearchService } from "./talk_search/service.js";
import { registerTalkLibraryRoutes } from "./talk_library_routes.js";
import type { TalkLibraryService } from "./talk_library/service.js";
import { registerTalkGiftRoutes } from "./talk_gift_routes.js";
import type { TalkGiftService } from "./talk_gifts/service.js";
import { registerTalkPollRoutes } from "./talk_poll_routes.js";
import type { TalkPollService } from "./talk_polls/service.js";
import { registerTalkSafetyRoutes } from "./talk_safety_routes.js";
import type { TalkSafetyService } from "./talk_safety/service.js";
import { registerDirectTwinRoutes } from "./talk_direct_twin_routes.js";
import type { DirectTwinService } from "./talk_direct_twin/service.js";
import type { TalkService } from "./talks/service.js";
import type { TwinProductionRuntime } from "./twin_production_runtime.js";
import { registerTwinProfileRoutes } from "./twin_profile_routes.js";
import { registerAccountDeletionRoutes } from "./account_deletion_routes.js";
import type { AccountDeletionService } from "./account_deletion.js";
import { registerTwinDirectoryRoutes } from "./twin_directory_routes.js";
import { registerMyTwinProjectionRoutes } from "./my_twin_projection_routes.js";
import { registerTwinActivityRoutes } from "./twin_activity_routes.js";
import { registerWalletProjectionRoutes } from "./wallet_projection_routes.js";
import { registerCreditTransferRoutes, registerGiftRoutes } from "./credit_transfer_routes.js";
import { registerTwinAttributionRoutes, registerCommissionPolicyAdminRoutes } from "./twin_attribution_routes.js";
import { registerProviderValuationAdminRoutes } from "./provider_valuation_admin_routes.js";
import { registerPaidVoiceRoutes, registerPaidVoiceSettlementRoutes } from "./paid_voice_routes.js";
import { registerPaidFeatureTrialAdminRoutes } from "./paid_feature_trial_admin_routes.js";
import {
  registerOwnerAccessRoutes,
  registerOwnerAccessDisputeAdminRoutes,
} from "./owner_access_routes.js";
import { registerOwnerAccessOfferingRoutes } from "./owner_access_offering_routes.js";
import { registerTwinSafetyRoutes } from "./twin_safety_routes.js";
import type { BillingCheckoutService } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import type { BillingWalletService } from "./billing_wallet.js";
import type { MobilePushRegistrationService } from "./mobile_push.js";
import type { FinancialService } from "./financial_service.js";
import {
  registerCustomerChannelRoutes,
  type CustomerChannelOptions,
} from "./customer_channel_routes.js";
import type { LinkedWhatsAppController } from "./whatsapp_linked_device.js";
import { registerLinkedWhatsAppAdminRoutes } from "./whatsapp_linked_device_routes.js";
import {
  CustomerAuthError,
  type CustomerAuthService,
} from "./customer_auth.js";
import {
  admitTelemetryCorrelation,
  injectCorrelationHeaders,
} from "@masanawa/telemetry";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Type from "typebox";
import { registerCallHistoryRoutes } from "./call_history/routes.js";
import { registerStatusRuntime, type StatusRuntime } from "./modules/home_feed/runtime.js";
import { registerRoomsRoutes, type RoomsRoutePorts } from "./modules/rooms/routes.js";
import { registerRoomDiscussionRoutes, type DiscussionRoutePorts } from "./modules/rooms/discussion_routes.js";
import { registerRoomBookmarkRoutes, type RoomBookmarkPorts } from "./modules/rooms/bookmark_routes.js";
import { registerRoomMembershipRoutes, type RoomMembershipRoutePorts } from "./modules/rooms/membership_routes.js";
import { registerMasanaInboxRoutes, type MasanaInboxRoutesDeps } from "./modules/masana_chat/inbox_routes.js";
import type { CallHistoryService } from "./call_history/service.js";

export interface ReadinessCheck {
  readonly name: string;
  check(): Promise<{ readonly ready: boolean; readonly reason?: string }>;
}

export interface GatewayAppOptions {
  /** Canonical session/PG-backed social modules; default-off pending qualification. */
  readonly status?: StatusRuntime;
  readonly masanaInbox?: MasanaInboxRoutesDeps;
  readonly rooms?: Readonly<{
    routes: RoomsRoutePorts;
    discussion: DiscussionRoutePorts;
    bookmarks: RoomBookmarkPorts;
    membership: RoomMembershipRoutePorts;
  }>;
  readonly callHistory?: CallHistoryService;
  readonly groupCalls?: GroupCallService;
  readonly incomingCalls?: IncomingCallService;
  readonly readinessChecks?: readonly ReadinessCheck[];
  readonly now?: () => Instant;
  readonly isDraining?: () => boolean;
  readonly agentDirectory?: AgentDirectoryService;
  readonly agentConversation?: AgentConversationService;
  readonly creatorClone?: CreatorCloneService;
  readonly creatorEconomy?: CreatorEconomyService;
  readonly creatorSkills?: CreatorSkillService;
  readonly commerceCatalog?: CommerceCatalogService;
  readonly commerceFulfillment?: CommerceFulfillmentService;
  readonly agentShell?: AgentShellService;
  readonly liveVoiceTokens?: LiveVoiceTokenService;
  readonly mobilePush?: MobilePushRegistrationService;
  readonly customerAuth?: CustomerAuthService;
  readonly accountDeletion?: AccountDeletionService;
  readonly talks?: TalkService;
  readonly talkReplay?: TalkReplayService;
  readonly talkModeration?: TalkModerationService;
  readonly talkAiSeats?: TalkAiSeatService;
  readonly talkLive?: TalkLiveService;
  readonly talkProfiles?: TalkProfileService;
  readonly talkActivity?: TalkActivityService;
  readonly talkSearch?: TalkSearchService;
  readonly talkLibrary?: TalkLibraryService;
  readonly talkGifts?: TalkGiftService;
  readonly talkPolls?: TalkPollService;
  readonly talkSafety?: TalkSafetyService;
  readonly directTwin?: DirectTwinService;
  readonly billingCheckout?: BillingCheckoutService;
  readonly billingFinancial?: BillingFinancialService;
  readonly billingWallet?: BillingWalletService;
  readonly financial?: FinancialService;
  readonly customerChannels?: CustomerChannelOptions;
  readonly linkedWhatsApp?: Readonly<{
    controller: LinkedWhatsAppController;
    adminToken?: string;
    authorizeSession?: (
      authorizationHeader: string | undefined,
    ) => Promise<boolean>;
  }>;
  readonly twinProduction?: TwinProductionRuntime;
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
    presence: Type.Union([
      Type.Literal("available"),
      Type.Literal("listening"),
      Type.Literal("working"),
      Type.Literal("on_call"),
      Type.Literal("offline"),
      Type.Literal("unknown"),
    ]),
    activeWorkCount: Type.Integer({ minimum: 0 }),
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


const HomeAssistantSchema = Type.Object(
  {
    role: Type.Union([Type.Literal("gwana"), Type.Literal("gwani")]),
    characterId: Type.String(),
    displayName: Type.String(),
    description: Type.String(),
    voiceLabel: Type.Union([Type.String(), Type.Null()]),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
    isAvailable: Type.Boolean(),
  },
  { additionalProperties: false },
);

const HomeRoomSchema = Type.Object(
  {
    roomId: Type.String(),
    title: Type.String(),
    description: Type.String(),
    iconKey: Type.String(),
    continuationLabel: Type.Union([Type.String(), Type.Null()]),
    isAvailable: Type.Boolean(),
  },
  { additionalProperties: false },
);

const HomeResponseSchema = Type.Object(
  {
    assistants: Type.Array(HomeAssistantSchema),
    rooms: Type.Array(HomeRoomSchema),
    continuations: Type.Array(Type.Unknown()),
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

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof IncomingCallError) {
      void reply.code(error.statusCode).send({ error: { code: error.code, message: "Incoming call request could not be completed" } });
      return;
    }
    if (error instanceof GroupCallError) {
      void reply.code(error.statusCode).send({
        error: { code: error.code, message: "Group call request could not be completed" },
      });
      return;
    }
    if (error instanceof Error && error.message === "financial.auth.unauthorized") {
      void reply.code(401).send({
        error: {
          code: "financial.auth.unauthorized",
          message: "Authentication required",
        },
      });
      return;
    }
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { readonly statusCode?: unknown }).statusCode === "number"
        ? (error as { readonly statusCode: number }).statusCode
        : 500;
    if (statusCode >= 400 && statusCode < 500) {
      void reply.code(statusCode).send({
        error: {
          code: statusCode === 400 ? "gateway.invalid_request" : "gateway.request_rejected",
          message: statusCode === 400 ? "Invalid request" : "Request rejected",
        },
      });
      return;
    }
    request.log.error(error);
    void reply.code(500).send({
      error: {
        code: "gateway.internal_error",
        message: "Internal server error",
      },
    });
  });

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


  if (options.accountDeletion) {
    registerAccountDeletionRoutes(app, options.accountDeletion);
  }

  if (options.customerAuth) {
    const auth = options.customerAuth;
    const authError = (
      error: unknown,
      reply: { code(statusCode: number): unknown },
    ) => {
      if (error instanceof CustomerAuthError) {
        reply.code(error.statusCode);
        return { code: error.code, message: error.code };
      }
      reply.code(503);
      return { code: "AUTH_UNAVAILABLE", message: "AUTH_UNAVAILABLE" };
    };

    app.get("/auth/capabilities", async () => auth.capabilities());

    app.post(
      "/auth/otp",
      {
        schema: {
          body: Type.Object(
            {
              phone: Type.Optional(Type.String({ minLength: 7, maxLength: 40 })),
              email: Type.Optional(Type.String({ minLength: 3, maxLength: 320 })),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.sendOtp({
            ...(request.body.phone === undefined
              ? {}
              : { phone: request.body.phone }),
            ...(request.body.email === undefined
              ? {}
              : { email: request.body.email }),
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post(
      "/auth/verify",
      {
        schema: {
          body: Type.Object(
            {
              phone: Type.Optional(Type.String({ minLength: 7, maxLength: 40 })),
              email: Type.Optional(Type.String({ minLength: 3, maxLength: 320 })),
              code: Type.String({ minLength: 6, maxLength: 6 }),
              name: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.verifyOtp({
            ...(request.body.phone === undefined
              ? {}
              : { phone: request.body.phone }),
            ...(request.body.email === undefined
              ? {}
              : { email: request.body.email }),
            code: request.body.code,
            ...(request.body.name === undefined
              ? {}
              : { name: request.body.name }),
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.get(
      "/v1/auth/account/status",
      {
        schema: {
          querystring: Type.Object(
            {
              phone: Type.String({ minLength: 7, maxLength: 40 }),
              deviceId: Type.String({ minLength: 32, maxLength: 32 }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.accountStatus({
            phone: request.query.phone,
            deviceId: request.query.deviceId,
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post(
      "/v1/auth/device/restore",
      {
        schema: {
          body: Type.Object(
            {
              phone: Type.String({ minLength: 7, maxLength: 40 }),
              deviceId: Type.String({ minLength: 32, maxLength: 32 }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.deviceRestore({
            phone: request.body.phone,
            deviceId: request.body.deviceId,
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post(
      "/v1/auth/password/verify",
      {
        schema: {
          body: Type.Object(
            {
              phone: Type.String({ minLength: 7, maxLength: 40 }),
              deviceId: Type.String({ minLength: 32, maxLength: 32 }),
              password: Type.String({ minLength: 6, maxLength: 6 }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.passwordVerify({
            phone: request.body.phone,
            deviceId: request.body.deviceId,
            password: request.body.password,
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post(
      "/v1/auth/password/setup",
      {
        schema: {
          body: Type.Object(
            {
              phone: Type.String({ minLength: 7, maxLength: 40 }),
              deviceId: Type.String({ minLength: 32, maxLength: 32 }),
              password: Type.String({ minLength: 6, maxLength: 6 }),
              name: Type.String({ minLength: 1, maxLength: 160 }),
              email: Type.Optional(Type.String({ minLength: 3, maxLength: 320 })),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.passwordSetup({
            phone: request.body.phone,
            deviceId: request.body.deviceId,
            password: request.body.password,
            name: request.body.name,
            ...(request.body.email === undefined
              ? {}
              : { email: request.body.email }),
          });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post(
      "/auth/refresh",
      {
        schema: {
          body: Type.Object(
            { refreshToken: Type.String({ minLength: 20, maxLength: 256 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          return await auth.refresh({ refreshToken: request.body.refreshToken });
        } catch (error) {
          return authError(error, reply);
        }
      },
    );

    app.post("/auth/logout", async (request) => {
      await auth.logout({
        authorizationHeader: request.headers.authorization,
      });
      return { success: true as const };
    });
  }

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

    app.get(
      "/home",
      {
        schema: {
          response: { 200: HomeResponseSchema },
        },
      },
      async (request) => {
        const agents = await directory.list({
          authorizationHeader: request.headers.authorization,
        });
        const support = agents.filter((agent) => agent.supportAgent);

        const byRole = (
          role: "gwana" | "gwani",
        ) => {
          const expectedName = role === "gwana" ? "gwana" : "gwani";
          const expectedVoice = role === "gwana" ? "sulafat" : "bodi";
          const agent =
            support.find(
              (item) => item.displayName.trim().toLowerCase() === expectedName,
            ) ??
            support.find(
              (item) => item.voiceName?.trim().toLowerCase() === expectedVoice,
            );
          if (!agent) return null;
          return {
            role,
            characterId: agent.characterId,
            displayName: agent.displayName,
            description: agent.about || agent.roleLabel,
            voiceLabel: agent.voiceName,
            avatarUrl: null,
            isAvailable: agent.presence !== "offline",
          } as const;
        };

        const assistants = [];
        const gwana = byRole("gwana");
        const gwani = byRole("gwani");
        if (gwana !== null) assistants.push(gwana);
        if (gwani !== null) assistants.push(gwani);

        return {
          assistants,
          rooms: [
            {
              roomId: "room.internet-cafe",
              title: "Internet Cafe",
              description: "Data, airtime, bills, applications and documents",
              iconKey: "internet_cafe",
              continuationLabel: null,
              isAvailable: true,
            },
            {
              roomId: "room.study-center",
              title: "Study Center",
              description: "Lessons, homework help and exam preparation",
              iconKey: "study",
              continuationLabel: null,
              isAvailable: true,
            },
            {
              roomId: "room.story-radio",
              title: "Story Radio",
              description: "Serialized audio stories",
              iconKey: "story_radio",
              continuationLabel: null,
              isAvailable: false,
            },
            {
              roomId: "room.work-business",
              title: "Work & Business",
              description: "Plans, proposals, reports and project work",
              iconKey: "work",
              continuationLabel: null,
              isAvailable: false,
            },
            {
              roomId: "room.research-answers",
              title: "Research & Answers",
              description: "Research, comparisons and sourced answers",
              iconKey: "research",
              continuationLabel: null,
              isAvailable: false,
            },
            {
              roomId: "room.news",
              title: "News",
              description: "Current sourced news and articles",
              iconKey: "news",
              continuationLabel: null,
              isAvailable: false,
            },
            {
              roomId: "room.groups",
              title: "Group Rooms",
              description: "Shared rooms with people and AI",
              iconKey: "groups",
              continuationLabel: null,
              isAvailable: false,
            },
          ],
          continuations: [],
        };
      },
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







  if (options.commerceFulfillment) {
    const commerceFulfillment = options.commerceFulfillment;
    app.post(
      "/fulfillments",
      {
        schema: {
          body: Type.Object(
            { quoteId: Type.String() },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object(
              {
                schemaVersion: Type.Literal(1),
                tenantId: Type.String(),
                fulfillmentId: Type.String(),
                quoteId: Type.String(),
                offerId: Type.String(),
                offerRevision: Type.Integer({ minimum: 1 }),
                skillVersionId: Type.String(),
                originatingCharacterId: Type.String(),
                executorCharacterId: Type.String(),
                creatorUserId: Type.Union([Type.String(), Type.Null()]),
                fundingSource: Type.Union([
                  Type.Literal("agent-float"),
                  Type.Literal("platform"),
                ]),
                reserveCredits: Type.Integer({ minimum: 0 }),
                creatorCommissionCredits: Type.Integer({ minimum: 0 }),
                platformRevenueCredits: Type.Integer({ minimum: 0 }),
                state: Type.Literal("admitted"),
                createdAt: Type.String(),
              },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) =>
        commerceFulfillment.admit({
          authorizationHeader: request.headers.authorization,
          quoteId: request.body.quoteId,
        }),
    );
  }

  if (options.commerceCatalog) {
    const commerceCatalog = options.commerceCatalog;
    const OfferViewSchema = Type.Object(
      {
        offerId: Type.String(),
        revision: Type.Integer({ minimum: 1 }),
        key: Type.String(),
        title: Type.String(),
        description: Type.String(),
        skillVersionId: Type.String(),
        priceCredits: Type.Integer({ minimum: 1 }),
        active: Type.Literal(true),
      },
      { additionalProperties: false },
    );

    app.get(
      "/offers",
      {
        schema: {
          response: {
            200: Type.Object(
              { offers: Type.Array(OfferViewSchema) },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) => ({
        offers: [
          ...(await commerceCatalog.list({
            authorizationHeader: request.headers.authorization,
          })),
        ],
      }),
    );

    app.post(
      "/quotes",
      {
        schema: {
          body: Type.Object(
            {
              offerId: Type.String(),
              originatingCharacterId: Type.String(),
            },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object(
              {
                schemaVersion: Type.Literal(1),
                tenantId: Type.String(),
                quoteId: Type.String(),
                offerId: Type.String(),
                offerRevision: Type.Integer({ minimum: 1 }),
                customerUserId: Type.String(),
                originatingCharacterId: Type.String(),
                creatorUserId: Type.Union([Type.String(), Type.Null()]),
                priceCredits: Type.Integer({ minimum: 1 }),
                creatorCommissionCredits: Type.Integer({ minimum: 0 }),
                fulfillmentReserveCredits: Type.Integer({ minimum: 0 }),
                platformMarginCredits: Type.Integer({ minimum: 0 }),
                expiresAt: Type.String(),
                createdAt: Type.String(),
              },
              { additionalProperties: false },
            ),
          },
        },
      },
      async (request) =>
        commerceCatalog.quote({
          authorizationHeader: request.headers.authorization,
          offerId: request.body.offerId,
          originatingCharacterId: request.body.originatingCharacterId,
        }),
    );
  }

  if (options.creatorSkills) {
    const creatorSkills = options.creatorSkills;
    const CreatorSkillSchema = Type.Object(
      {
        skillVersionId: Type.String(),
        key: Type.String(),
        displayName: Type.String(),
        description: Type.String(),
        triggerDescription: Type.String(),
        category: Type.String(),
        enabled: Type.Boolean(),
      },
      { additionalProperties: false },
    );
    const CreatorSkillResponse = Type.Object(
      { skills: Type.Array(CreatorSkillSchema) },
      { additionalProperties: false },
    );

    app.get(
      "/creator/skills",
      { schema: { response: { 200: CreatorSkillResponse } } },
      async (request) => ({
        skills: [
          ...(await creatorSkills.list({
            authorizationHeader: request.headers.authorization,
          })),
        ],
      }),
    );

    app.put(
      "/creator/skills",
      {
        schema: {
          body: Type.Object(
            {
              skillVersionId: Type.String(),
              enabled: Type.Boolean(),
            },
            { additionalProperties: false },
          ),
          response: { 200: CreatorSkillResponse },
        },
      },
      async (request) => ({
        skills: [
          ...(await creatorSkills.setEnabled({
            authorizationHeader: request.headers.authorization,
            skillVersionId: request.body.skillVersionId,
            enabled: request.body.enabled,
          })),
        ],
      }),
    );
  }

  if (options.creatorEconomy) {
    const creatorEconomy = options.creatorEconomy;
    const EconomyResponse = Type.Object(
      {
        hasClone: Type.Boolean(),
        characterId: Type.Union([Type.String(), Type.Null()]),
        customerCredits: Type.Integer({ minimum: 0 }),
        agentFloatCredits: Type.Integer({ minimum: 0 }),
        pendingEarningsCredits: Type.Integer({ minimum: 0 }),
        availableEarningsCredits: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    );

    app.get(
      "/creator/economy",
      { schema: { response: { 200: EconomyResponse } } },
      async (request) =>
        creatorEconomy.read({
          authorizationHeader: request.headers.authorization,
        }),
    );

    app.post(
      "/creator/float",
      {
        schema: {
          body: Type.Object(
            { amountCredits: Type.Integer({ minimum: 1, maximum: 1000000000 }) },
            { additionalProperties: false },
          ),
          response: { 200: EconomyResponse },
        },
      },
      async (request) =>
        creatorEconomy.allocateFloat({
          authorizationHeader: request.headers.authorization,
          amountCredits: request.body.amountCredits,
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

    const resultBody = (result: Awaited<ReturnType<AgentConversationService["turn"]>>) => ({
      reply: result.reply,
      agentRunId: result.agentRunId,
      parts: [...result.parts],
      ...(result.audioBase64 ? { audioBase64: result.audioBase64 } : {}),
      ...(result.audioMimeType ? { audioMimeType: result.audioMimeType } : {}),
      ...(result.audioDurationMs !== undefined
        ? { audioDurationMs: result.audioDurationMs }
        : {}),
    });

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
      async (request, reply) => {
        const controller = new AbortController();
        let finished = false;
        const abort = () => {
          if (!finished) controller.abort();
        };
        reply.raw.once("close", abort);
        try {
          return resultBody(await conversation.turn({
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
          }));
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
      },
    );

    app.post(
      "/agent/sessions/:characterSessionId/turn-stream",
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
          emit({ type: "done", ...resultBody(result) });
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
      "/agent/sessions/:characterSessionId/media-turn",
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
          return resultBody(await conversation.mediaTurn({
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
          }) as Awaited<ReturnType<AgentConversationService["turn"]>>);
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
      },
    );

    app.post(
      "/agent/sessions/:characterSessionId/media-set-turn",
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
          return resultBody(await conversation.mediaSetTurn({
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
          }) as Awaited<ReturnType<AgentConversationService["turn"]>>);
        } finally {
          finished = true;
          reply.raw.off("close", abort);
        }
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

  if (options.financial) {
    const financial = options.financial;
    const auth = (request: { headers: { authorization?: string | undefined } }) =>
      request.headers.authorization;

    app.get("/v1/financial/capabilities", async (request) =>
      financial.capabilities({ authorizationHeader: auth(request) }));

    app.get("/v1/financial/crypto/routes", async (request) => ({
      routes: (await financial.listDepositRoutes({
        authorizationHeader: auth(request),
      })).map((route) => ({
        providerCode: route.providerCode,
        asset: route.asset,
        network: route.network,
      })),
    }));

    app.get("/v1/financial/crypto/conversion-routes", async (request) => ({
      routes: (await financial.listConversionRoutes({
        authorizationHeader: auth(request),
      })).map((route) => ({
        providerCode: route.providerCode,
        asset: route.asset,
        network: route.network,
      })),
    }));

    app.get("/v1/financial/crypto/withdrawal-routes", async (request) => ({
      routes: (await financial.listWithdrawalRoutes({
        authorizationHeader: auth(request),
      })).map((route) => ({
        providerCode: route.providerCode,
        asset: route.asset,
        network: route.network,
      })),
    }));

    app.post(
      "/v1/financial/crypto/deposits",
      { schema: { body: Type.Object({
        requestId: Type.String(),
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
        amount: Type.String({ minLength: 1, maxLength: 80 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.createDeposit({
        authorizationHeader: auth(request),
        requestId: request.body.requestId,
        providerCode: request.body.providerCode,
        amount: request.body.amount,
      }),
    );

    app.post(
      "/v1/financial/crypto/purchases",
      { schema: { body: Type.Object({
        requestId: Type.String(),
        fiatAmount: Type.String({ minLength: 1, maxLength: 32 }),
        fiatCurrency: Type.String({ minLength: 2, maxLength: 32 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.createFiatPurchase({
        authorizationHeader: auth(request),
        requestId: request.body.requestId,
        fiatAmount: request.body.fiatAmount,
        fiatCurrency: request.body.fiatCurrency,
      }),
    );

    app.post(
      "/v1/financial/crypto/purchases/:requestId/refresh",
      { schema: { params: Type.Object({ requestId: Type.String() }, { additionalProperties: false }) } },
      async (request) => financial.refreshFiatPurchase({
        authorizationHeader: auth(request),
        requestId: request.params.requestId,
      }),
    );

    app.post(
      "/v1/financial/crypto/withdrawals/quote",
      { schema: { body: Type.Object({
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
        amount: Type.String({ minLength: 1, maxLength: 80 }),
        destinationAddress: Type.String({ minLength: 1, maxLength: 512 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.quoteWithdrawal({
        authorizationHeader: auth(request),
        providerCode: request.body.providerCode,
        amount: request.body.amount,
        destinationAddress: request.body.destinationAddress,
      }),
    );

    app.post(
      "/v1/financial/crypto/withdrawals",
      { schema: { body: Type.Object({
        requestId: Type.String(),
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
        amount: Type.String({ minLength: 1, maxLength: 80 }),
        destinationAddress: Type.String({ minLength: 1, maxLength: 512 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.createWithdrawal({
        authorizationHeader: auth(request),
        requestId: request.body.requestId,
        providerCode: request.body.providerCode,
        amount: request.body.amount,
        destinationAddress: request.body.destinationAddress,
      }),
    );

    app.post(
      "/v1/financial/crypto/withdrawals/:requestId/refresh",
      { schema: { params: Type.Object({ requestId: Type.String() }, { additionalProperties: false }) } },
      async (request) => financial.refreshWithdrawal({
        authorizationHeader: auth(request),
        requestId: request.params.requestId,
      }),
    );

    app.post(
      "/v1/financial/crypto/conversions/quote",
      { schema: { body: Type.Object({
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
        targetProviderCode: Type.String({ minLength: 2, maxLength: 32 }),
        amount: Type.String({ minLength: 1, maxLength: 80 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.quoteConversion({
        authorizationHeader: auth(request),
        providerCode: request.body.providerCode,
        targetProviderCode: request.body.targetProviderCode,
        amount: request.body.amount,
      }),
    );

    app.post(
      "/v1/financial/crypto/conversions",
      { schema: { body: Type.Object({
        requestId: Type.String(),
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
        targetProviderCode: Type.String({ minLength: 2, maxLength: 32 }),
        amount: Type.String({ minLength: 1, maxLength: 80 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.createConversion({
        authorizationHeader: auth(request),
        requestId: request.body.requestId,
        providerCode: request.body.providerCode,
        targetProviderCode: request.body.targetProviderCode,
        amount: request.body.amount,
      }),
    );

    app.post(
      "/v1/financial/crypto/conversions/:requestId/refresh",
      { schema: { params: Type.Object({ requestId: Type.String() }, { additionalProperties: false }) } },
      async (request) => financial.refreshConversion({
        authorizationHeader: auth(request),
        requestId: request.params.requestId,
      }),
    );

    app.get(
      "/v1/financial/crypto/balances/:providerCode",
      { schema: { params: Type.Object({
        providerCode: Type.String({ minLength: 2, maxLength: 32 }),
      }, { additionalProperties: false }) } },
      async (request) => financial.readBalance({
        authorizationHeader: auth(request),
        providerCode: request.params.providerCode,
      }),
    );

    app.get(
      "/v1/financial/crypto/history",
      { schema: { querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      }, { additionalProperties: false }) } },
      async (request) => ({
        intents: await financial.listHistory({
          authorizationHeader: auth(request),
          ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        }),
      }),
    );

    app.get(
      "/v1/financial/crypto/intents/:requestId",
      { schema: { params: Type.Object({ requestId: Type.String() }, { additionalProperties: false }) } },
      async (request, reply) => {
        const intent = await financial.readIntent({
          authorizationHeader: auth(request),
          requestId: request.params.requestId,
        });
        if (!intent) {
          reply.code(404);
          return { error: "intent_not_found" };
        }
        return intent;
      },
    );

    const nowPaymentsHeaders = Type.Object(
      { "x-nowpayments-sig": Type.String({ minLength: 128, maxLength: 128 }) },
      { additionalProperties: true },
    );
    app.post(
      "/v1/financial/nowpayments/ipn",
      { bodyLimit: 256_000, schema: { headers: nowPaymentsHeaders, body: Type.Unknown() } },
      async (request, reply) => {
        await financial.handleNowPaymentsIpn({
          signature: request.headers["x-nowpayments-sig"],
          payload: request.body,
        });
        reply.code(202);
        return { accepted: true as const };
      },
    );
    app.post(
      "/v1/financial/nowpayments/payout-ipn",
      { bodyLimit: 256_000, schema: { headers: nowPaymentsHeaders, body: Type.Unknown() } },
      async (request, reply) => {
        await financial.handleNowPaymentsPayoutIpn({
          signature: request.headers["x-nowpayments-sig"],
          payload: request.body,
        });
        reply.code(202);
        return { accepted: true as const };
      },
    );
  }

  // Additive composition: never replace Calls, financial or existing agent routes.
  const status = options.status;
  if (status) app.register(async (scope) => { await registerStatusRuntime(scope, status); });
  if (options.masanaInbox) registerMasanaInboxRoutes(app, options.masanaInbox);
  const rooms = options.rooms;
  if (rooms) {
    registerRoomsRoutes(app, rooms.routes);
    registerRoomDiscussionRoutes(app, rooms.discussion);
    registerRoomBookmarkRoutes(app, rooms.bookmarks);
    registerRoomMembershipRoutes(app, rooms.membership);
  }
  if (options.callHistory) registerCallHistoryRoutes(app, options.callHistory);
  if (options.groupCalls) registerGroupCallRoutes(app, options.groupCalls);
  if (options.incomingCalls) registerIncomingCallRoutes(app, options.incomingCalls);
  registerAgentShellRoutes(app, {
    ...(options.agentShell ? { agentShell: options.agentShell } : {}),
    ...(options.liveVoiceTokens
      ? { liveVoiceTokens: options.liveVoiceTokens }
      : {}),
    ...(options.mobilePush ? { mobilePush: options.mobilePush } : {}),
  });

  if (options.talks) {
    registerTalkRoutes(app, options.talks);
  }
  if (options.talkReplay) {
    registerTalkReplayRoutes(app, options.talkReplay, {
      includeMyTalks: !options.talkLibrary,
    });
  }
  if (options.talkModeration) {
    registerTalkModerationRoutes(app, options.talkModeration);
  }
  if (options.talkAiSeats) {
    registerTalkAiSeatRoutes(app, options.talkAiSeats);
  }
  if (options.talkLive) {
    registerTalkLiveRoutes(app, options.talkLive);
  }
  if (options.talkProfiles) {
    registerTalkProfileRoutes(app, options.talkProfiles);
  }
  if (options.talkActivity) {
    registerTalkActivityRoutes(app, options.talkActivity);
  }
  if (options.talkSearch) {
    registerTalkSearchRoutes(app, options.talkSearch);
  }
  if (options.talkLibrary) {
    registerTalkLibraryRoutes(app, options.talkLibrary);
  }
  if (options.talkGifts) {
    registerTalkGiftRoutes(app, options.talkGifts);
  }
  if (options.talkPolls) {
    registerTalkPollRoutes(app, options.talkPolls);
  }
  if (options.talkSafety) {
    registerTalkSafetyRoutes(app, options.talkSafety);
  }
  if (options.directTwin) {
    registerDirectTwinRoutes(app, options.directTwin);
  }

  registerBillingRoutes(app, {
    ...(options.billingCheckout ? { billingCheckout: options.billingCheckout } : {}),
    ...(options.billingFinancial ? { billingFinancial: options.billingFinancial } : {}),
    ...(options.billingWallet ? { billingWallet: options.billingWallet } : {}),
  });

  if (options.customerChannels) {
    registerCustomerChannelRoutes(app, options.customerChannels);
  }

  if (options.linkedWhatsApp) {
    registerLinkedWhatsAppAdminRoutes(app, options.linkedWhatsApp);
  }

  if (options.twinProduction) {
    const twin = options.twinProduction;
    registerTwinProfileRoutes(app, twin.twinProfile);
    registerTwinDirectoryRoutes(app, twin.twinDirectory);
    registerMyTwinProjectionRoutes(app, twin.myTwin);
    registerTwinActivityRoutes(app, twin.twinActivity);
    registerWalletProjectionRoutes(app, twin.wallet);
    registerCreditTransferRoutes(app, twin.creditTransfer);
    registerGiftRoutes(app, twin.gifts);
    registerTwinAttributionRoutes(app, twin.twinAttribution);
    registerCommissionPolicyAdminRoutes(app, twin.commissionAdmin);
    registerProviderValuationAdminRoutes(app, twin.providerValuationAdmin);
    registerPaidVoiceRoutes(app, twin.paidVoice);
    registerPaidVoiceSettlementRoutes(app, twin.voiceAdmissionGate);
    registerPaidFeatureTrialAdminRoutes(app, twin.paidFeatureTrialAdmin);
    registerOwnerAccessRoutes(app, twin.ownerAccess);
    registerOwnerAccessDisputeAdminRoutes(app, twin.ownerAccessDisputes);
    registerOwnerAccessOfferingRoutes(app, twin.ownerAccessOffering);
    registerTwinSafetyRoutes(app, twin.twinSafety);
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

import { pathToFileURL } from "node:url";
import type {
  AgentPresentationRepository,
  AgentRunRepository,
  AgentStrategy,
  CharacterSessionRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
  MobileShellRepository,
  MobilePushRepository,
  MobileAgentActivityRepository,
} from "@masanawa/agents";
import type {
  SkillDistributionRepository,
  SkillGuideRepository,
  SkillRepository,
} from "@masanawa/skills";
import type {
  CharacterOwnershipReader,
  PersonalCloneProvisioningRepository,
  UserRelationshipReader,
} from "@masanawa/identity";
import type { BillingQuoteRepository, CommerceRepository } from "@masanawa/commerce";
import { parseCanonicalId, readRequiredEnv } from "@masanawa/contracts";
import {
  FlutterwaveBillsClient,
  FlutterwaveFundingClient,
  FlutterwaveHttpTransport,
  type BillingFulfillmentStore,
} from "@masanawa/providers";
import {
  createDrainState,
  readNodeServiceRuntimeConfig,
  startNodeService,
  type ManagedNodeServer,
  type NodeServiceRuntimeConfig,
  type NodeSignalSource,
  type ServiceLifecycleLogger,
} from "@masanawa/node-runtime";
import {
  platformProductMigrationRoots,
  createPostgresAgentPresentationRepository,
  createPostgresAgentRunRepository,
  createPostgresCharacterSessionRepository,
  createPostgresCharacterOwnershipReader,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresCommerceRepository,
  createPostgresPlatformAgentProfileRepository,
  createPostgresSkillGuideRepository,
  createPostgresSkillDistributionRepository,
  createPostgresSkillRepository,
  createPostgresUserAgentPreferenceRepository,
  createPostgresPersonalCloneProvisioningRepository,
  createPostgresUserRelationshipReader,
  createPostgresServiceDependency,
  createPostgresMobileShellRepository,
  createPostgresMobilePushRepository,
  createPostgresMobileAgentActivityRepository,
  createPostgresProductionUserIdentityRepository,
  createPostgresBillingQuoteRepository,
  createPostgresBillingFulfillmentStore,
  createPostgresBillingWebhookRepository,
  type ProductionUserIdentityRepository,
} from "@masanawa/postgres";
import {
  createAgentDirectoryService,
  type AgentDirectoryAuthorizer,
} from "./agent_directory.js";
import { createAgentConversationService } from "./agent_conversation.js";
import {
  createCreatorCloneService,
  type CreatorCloneAuthorizer,
} from "./creator_clone.js";
import { createCreatorEconomyService } from "./creator_economy.js";
import { createCreatorSkillService } from "./creator_skills.js";
import {
  createCommerceCatalogService,
  type CommerceUserAuthorizer,
} from "./commerce_catalog.js";
import { createCommerceFulfillmentService } from "./commerce_fulfillment.js";
import type {
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import {
  createAlphaDevAuthorizer,
  createAlphaDirectoryAuthorizer,
  createAlphaCreatorAuthorizer,
  createAlphaCommerceAuthorizer,
  parseAlphaDevIds,
  parseAlphaRelationshipMap,
} from "./alpha_dev.js";
import { createGeminiAlphaInferenceProvider } from "./alpha_executor.js";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";
import { createGeminiLiveAudioRenderer } from "./native_audio.js";
import { createAgentShellService } from "./agent_shell.js";
import type {
  AgentShellActionExecutor,
  LiveVoiceTokenService,
} from "./agent_shell_contract.js";
import { createGeminiLiveTokenService } from "./live_voice_token.js";
import {
  createMobilePushRegistrationService,
  createFcmPushSender,
  type MobilePushSender,
} from "./mobile_push.js";
import {
  createGatewayApp,
  type GatewayAppOptions,
  type ReadinessCheck,
} from "./app.js";
import {
  createProductionAuthService,
  createProductionAuthorizers,
  type ProductionAuthService,
} from "./production_auth.js";
import {
  createBillingFinancialService,
  type BillingFinancialService,
} from "./financial_billing.js";
import {
  createBillingCheckoutService,
  type BillingCheckoutService,
} from "./billing_checkout.js";

export type ServiceSignal = "SIGINT" | "SIGTERM";

export interface ServiceProcess extends NodeSignalSource {
  exitCode: number | undefined;
  exit(code: number): never;
}

export interface ServiceDatabaseDependency {
  readonly readinessCheck: ReadinessCheck;
  readonly agentPresentations?: AgentPresentationRepository;
  readonly characterSkillAssignments?: CharacterSkillAssignmentRepository;
  readonly characterSessions?: CharacterSessionRepository;
  readonly agentRuns?: AgentRunRepository;
  readonly platformAgentProfiles?: PlatformAgentProfileRepository;
  readonly userAgentPreferences?: UserAgentPreferenceRepository;
  readonly skills?: SkillRepository;
  readonly skillGuides?: SkillGuideRepository;
  readonly skillDistribution?: SkillDistributionRepository;
  readonly personalClones?: PersonalCloneProvisioningRepository;
  readonly relationships?: UserRelationshipReader;
  readonly commerce?: CommerceRepository;
  readonly ownerships?: CharacterOwnershipReader;
  readonly mobileShell?: MobileShellRepository;
  readonly mobilePush?: MobilePushRepository;
  readonly mobileActivity?: MobileAgentActivityRepository;
  readonly productionUsers?: ProductionUserIdentityRepository;
  readonly billingQuotes?: BillingQuoteRepository;
  readonly billingStore?: (
    identity: Readonly<{ tenantId: string; userId: string }>,
  ) => BillingFulfillmentStore;
  readonly billingWebhooks?: ReturnType<typeof createPostgresBillingWebhookRepository>;
  close(): Promise<void>;
}

export type ServiceDatabaseFactory = (
  env: Readonly<Record<string, string | undefined>>,
) => ServiceDatabaseDependency;

export type GatewayServiceConfig = NodeServiceRuntimeConfig;

export interface StartGatewayServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: ServiceProcess;
  readonly logger?: ServiceLifecycleLogger;
  readonly databaseFactory?: ServiceDatabaseFactory;
  readonly appFactory?: (options: GatewayAppOptions) => ManagedNodeServer;
  readonly appOptions?: Omit<GatewayAppOptions, "isDraining">;
  readonly agentDirectoryAuthorizer?: AgentDirectoryAuthorizer;
  readonly agentConversationAuthorizer?: AgentConversationAuthorizer;
  readonly creatorCloneAuthorizer?: CreatorCloneAuthorizer;
  readonly commerceAuthorizer?: CommerceUserAuthorizer;
  readonly agentStrategy?: AgentStrategy;
  readonly agentShellActionExecutor?: AgentShellActionExecutor;
}

export interface GatewayServiceRuntime {
  readonly config: GatewayServiceConfig;
  readonly address: string;
  readonly app: ManagedNodeServer;
  readonly pushSender?: MobilePushSender;
  isDraining(): boolean;
  drain(): void;
  shutdown(reason?: ServiceSignal | "manual"): Promise<void>;
  disposeSignals(): void;
}

export function parseGatewayServiceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GatewayServiceConfig {
  return readNodeServiceRuntimeConfig(
    {
      ...env,
      HOST: env.MASANAWA_GATEWAY_HOST ?? env.HOST,
      PORT: env.MASANAWA_GATEWAY_PORT ?? env.PORT,
    },
    {
      port: 3000,
      shutdownTimeoutMs: 10_000,
    },
  );
}

function createDefaultDatabaseDependency(
  env: Readonly<Record<string, string | undefined>>,
): ServiceDatabaseDependency {
  const connectionString = readRequiredEnv(
    {
      DATABASE_URL: env.MASANAWA_DATABASE_URL ?? env.DATABASE_URL,
    },
    "DATABASE_URL",
  );

  const database = createPostgresServiceDependency({
    connectionString,
    applicationName: "masanawa-gateway",
    migrationRoots: platformProductMigrationRoots(),
  });
  return Object.freeze({
    readinessCheck: database.readinessCheck,
    agentPresentations: createPostgresAgentPresentationRepository(database.pool),
    characterSkillAssignments:
      createPostgresCharacterSkillAssignmentRepository(database.pool),
    characterSessions: createPostgresCharacterSessionRepository(database.pool, {
      maxDurationMs: 7 * 24 * 60 * 60 * 1000,
    }),
    agentRuns: createPostgresAgentRunRepository(database.pool),
    platformAgentProfiles: createPostgresPlatformAgentProfileRepository(database.pool),
    userAgentPreferences: createPostgresUserAgentPreferenceRepository(database.pool),
    skills: createPostgresSkillRepository(database.pool),
    skillGuides: createPostgresSkillGuideRepository(database.pool),
    skillDistribution: createPostgresSkillDistributionRepository(database.pool),
    personalClones: createPostgresPersonalCloneProvisioningRepository(database.pool),
    relationships: createPostgresUserRelationshipReader(database.pool),
    commerce: createPostgresCommerceRepository(database.pool),
    ownerships: createPostgresCharacterOwnershipReader(database.pool),
    mobileShell: createPostgresMobileShellRepository(database.pool),
    mobilePush: createPostgresMobilePushRepository(database.pool),
    mobileActivity: createPostgresMobileAgentActivityRepository(database.pool),
    productionUsers: createPostgresProductionUserIdentityRepository(database.pool),
    billingQuotes: createPostgresBillingQuoteRepository(database.pool),
    billingStore: (identity) =>
      createPostgresBillingFulfillmentStore(database.pool, identity),
    billingWebhooks: createPostgresBillingWebhookRepository(database.pool),
    close: database.close,
  });
}

function alphaEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.MASANAWA_ALPHA_ENABLED === "true";
}

function requiredAlphaEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new TypeError(`${key} is required when Alpha mode is enabled`);
  return value;
}

function productionAuthEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.MASANAWA_PRODUCTION_AUTH_ENABLED === "true";
}

function requiredProductionEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new TypeError(`${key} is required when production auth is enabled`);
  return value;
}

function productionGeminiApiKey(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const direct =
    env.MASANAWA_GEMINI_API_KEY?.trim() ||
    env.MASANAWA_ALPHA_GEMINI_API_KEY?.trim();
  if (direct) return direct;
  const raw =
    env.MASANAWA_GEMINI_API_KEYS_JSON?.trim() ??
    env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        );
        if (first) return first.trim();
      }
    } catch {
      // Fail below with one stable configuration error.
    }
  }
  throw new TypeError("A Gemini API key is required for the production Agent runtime");
}

export async function startGatewayService(
  options: StartGatewayServiceOptions = {},
): Promise<GatewayServiceRuntime> {
  const env = options.env ?? process.env;
  const config = parseGatewayServiceConfig(env);
  const processRef = options.processRef ?? (process as ServiceProcess);
  const drain = createDrainState();
  const databaseFactory =
    options.databaseFactory ?? createDefaultDatabaseDependency;
  const database = databaseFactory(env);
  const appFactory = options.appFactory ?? createGatewayApp;

  let directoryAuthorizer = options.agentDirectoryAuthorizer;
  let conversationAuthorizer = options.agentConversationAuthorizer;
  let creatorCloneAuthorizer = options.creatorCloneAuthorizer;
  let commerceAuthorizer = options.commerceAuthorizer;
  let strategy = options.agentStrategy;
  let nativeAudio;
  let liveVoiceTokens: LiveVoiceTokenService | undefined;
  let pushSender: MobilePushSender | undefined;
  let productionAuth: ProductionAuthService | undefined;

  if (alphaEnabled(env)) {
    if (
      !database.agentPresentations ||
      !database.characterSkillAssignments ||
      !database.characterSessions ||
      !database.agentRuns ||
      !database.skills ||
      !database.skillGuides
    ) {
      await database.close().catch(() => undefined);
      throw new Error("Alpha mode requires canonical agent PostgreSQL repositories");
    }

    const ids = parseAlphaDevIds({
      tenantId: requiredAlphaEnv(env, "MASANAWA_ALPHA_TENANT_ID"),
      userId: requiredAlphaEnv(env, "MASANAWA_ALPHA_USER_ID"),
    });
    const token = requiredAlphaEnv(env, "MASANAWA_ALPHA_DEV_TOKEN");
    const policyRevision = requiredAlphaEnv(
      env,
      "MASANAWA_ALPHA_POLICY_REVISION",
    );
    const relationshipIds = parseAlphaRelationshipMap(
      requiredAlphaEnv(env, "MASANAWA_ALPHA_RELATIONSHIPS_JSON"),
    );

    directoryAuthorizer ??= createAlphaDirectoryAuthorizer({
      token,
      tenantId: ids.tenantId,
      userId: ids.userId,
      relationshipIds,
      ...(database.relationships ? { relationships: database.relationships } : {}),
    });
    creatorCloneAuthorizer ??= createAlphaCreatorAuthorizer({
      token,
      tenantId: ids.tenantId,
      userId: ids.userId,
    });
    commerceAuthorizer ??= createAlphaCommerceAuthorizer({
      token,
      tenantId: ids.tenantId,
      userId: ids.userId,
    });
    conversationAuthorizer ??= createAlphaDevAuthorizer({
      config: {
        token,
        tenantId: ids.tenantId,
        userId: ids.userId,
        policyRevision,
        relationshipIds,
      },
      presentations: database.agentPresentations,
      skillAssignments: database.characterSkillAssignments,
      ...(database.relationships ? { relationships: database.relationships } : {}),
    });
    const alphaGeminiApiKey = requiredAlphaEnv(
      env,
      "MASANAWA_ALPHA_GEMINI_API_KEY",
    );
    strategy ??= createAlphaInferenceStrategy({
      inference: createGeminiAlphaInferenceProvider({
        apiKey: alphaGeminiApiKey,
        model: requiredAlphaEnv(env, "MASANAWA_ALPHA_GEMINI_MODEL"),
      }),
      skills: database.skills,
      guides: database.skillGuides,
    });
    nativeAudio = createGeminiLiveAudioRenderer({
      apiKey: alphaGeminiApiKey,
      model: env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
      voiceName: env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE ?? "Kore",
    });
    liveVoiceTokens = createGeminiLiveTokenService({
      apiKey: alphaGeminiApiKey,
      authorizer: conversationAuthorizer!,
      model: env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
      voiceName: env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE ?? "Kore",
    });
  }

  if (productionAuthEnabled(env)) {
    if (
      !database.productionUsers ||
      !database.agentPresentations ||
      !database.characterSkillAssignments ||
      !database.relationships ||
      !database.platformAgentProfiles ||
      !database.skills ||
      !database.skillGuides
    ) {
      await database.close().catch(() => undefined);
      throw new Error("Production auth requires canonical identity and Agent repositories");
    }

    const tenantId = parseCanonicalId(
      "tenant",
      requiredProductionEnv(env, "MASANAWA_PLATFORM_TENANT_ID"),
    );
    productionAuth = createProductionAuthService({
      supabaseUrl: requiredProductionEnv(env, "SUPABASE_URL"),
      publishableKey: requiredProductionEnv(env, "SUPABASE_PUBLISHABLE_KEY"),
      tenantId,
      identities: database.productionUsers,
    });
    const productionAuthorizers = createProductionAuthorizers({
      auth: productionAuth,
      identities: database.productionUsers,
      presentations: database.agentPresentations,
      skillAssignments: database.characterSkillAssignments,
      relationships: database.relationships,
      platformProfiles: database.platformAgentProfiles,
      policyRevision:
        env.MASANAWA_PLATFORM_POLICY_REVISION?.trim() ||
        "production-mobile-v1",
    });
    directoryAuthorizer = productionAuthorizers.directory;
    conversationAuthorizer = productionAuthorizers.conversation;
    creatorCloneAuthorizer = productionAuthorizers.creator;
    commerceAuthorizer = productionAuthorizers.commerce;

    const apiKey = productionGeminiApiKey(env);
    const model =
      env.MASANAWA_GEMINI_MODEL?.trim() ||
      env.MASANAWA_ALPHA_GEMINI_MODEL?.trim() ||
      "gemini-3.8-flash";
    strategy ??= createAlphaInferenceStrategy({
      inference: createGeminiAlphaInferenceProvider({
        apiKey,
        model,
      }),
      skills: database.skills,
      guides: database.skillGuides,
    });
    nativeAudio ??= createGeminiLiveAudioRenderer({
      apiKey,
      model:
        env.MASANAWA_GEMINI_LIVE_MODEL?.trim() ||
        env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL?.trim() ||
        "gemini-3.8-live",
      voiceName:
        env.MASANAWA_GEMINI_LIVE_VOICE?.trim() ||
        env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE?.trim() ||
        "Kore",
    });
    liveVoiceTokens = createGeminiLiveTokenService({
      apiKey,
      authorizer: conversationAuthorizer,
      model:
        env.MASANAWA_GEMINI_LIVE_MODEL?.trim() ||
        env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL?.trim() ||
        "gemini-3.8-live",
      voiceName:
        env.MASANAWA_GEMINI_LIVE_VOICE?.trim() ||
        env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE?.trim() ||
        "Kore",
    });
  }

  const billingEnabled = env.FLUTTERWAVE_BILLS_ENABLED === "true";
  const flutterwaveSecretKey = env.FLUTTERWAVE_SECRET_KEY?.trim();
  const flutterwaveRelayUrl = env.FLUTTERWAVE_RELAY_URL?.trim();
  const flutterwaveRelayToken =
    env.MASANAWA_FLUTTERWAVE_RELAY_TOKEN?.trim();
  const flutterwaveRelayProtocol =
    env.FLUTTERWAVE_RELAY_PROTOCOL === "dual-header"
      ? ("dual-header" as const)
      : ("bearer" as const);

  if (
    billingEnabled &&
    Boolean(flutterwaveRelayUrl) !== Boolean(flutterwaveRelayToken)
  ) {
    await database.close().catch(() => undefined);
    throw new TypeError(
      "Flutterwave relay URL and relay token must be configured together",
    );
  }

  const flutterwaveTransport =
    billingEnabled && flutterwaveSecretKey
      ? new FlutterwaveHttpTransport(
          flutterwaveRelayUrl && flutterwaveRelayToken
            ? {
                baseUrl: flutterwaveRelayUrl,
                relayToken: flutterwaveRelayToken,
                relayProtocol: flutterwaveRelayProtocol,
              }
            : {},
        )
      : undefined;
  const flutterwaveBills =
    billingEnabled && flutterwaveSecretKey && flutterwaveTransport
      ? new FlutterwaveBillsClient({
          secretKey: flutterwaveSecretKey,
          transport: flutterwaveTransport,
          country: "NG",
        })
      : undefined;
  const flutterwaveFunding =
    billingEnabled && flutterwaveSecretKey && flutterwaveTransport
      ? new FlutterwaveFundingClient({
          secretKey: flutterwaveSecretKey,
          transport: flutterwaveTransport,
        })
      : undefined;

  const billingAuthorizer =
    billingEnabled && productionAuth
      ? Object.freeze({
          async authorize(request: Readonly<{
            authorizationHeader: string | undefined;
          }>) {
            const authority = await productionAuth.authenticate(
              request.authorizationHeader,
            );
            return Object.freeze({
              tenantId: authority.tenantId,
              userId: authority.userId,
            });
          },
        })
      : undefined;

  const billingCustomerAuthorizer =
    billingEnabled && productionAuth
      ? Object.freeze({
          async authorize(request: Readonly<{
            authorizationHeader: string | undefined;
          }>) {
            const authority = await productionAuth.authenticate(
              request.authorizationHeader,
            );
            return Object.freeze({
              tenantId: authority.tenantId,
              userId: authority.userId,
            });
          },
        })
      : undefined;

  let composedBillingFinancial: BillingFinancialService | undefined =
    options.appOptions?.billingFinancial;
  let composedBillingCheckout: BillingCheckoutService | undefined =
    options.appOptions?.billingCheckout;

  if (
    billingEnabled &&
    (!composedBillingFinancial || !composedBillingCheckout)
  ) {
    const webhookHash = env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim();
    const webhookUrl = env.FLUTTERWAVE_WEBHOOK_URL?.trim();
    const actionSecret = env.MASANAWA_BILLING_ACTION_SECRET?.trim();
    const redirectUrl =
      env.MASANAWA_BILLING_REDIRECT_URL?.trim() ||
      (env.MASANAWA_PUBLIC_BASE_URL?.trim()
        ? `${env.MASANAWA_PUBLIC_BASE_URL.trim().replace(/\/$/u, "")}/billing/return`
        : "");
    const feeBasisPoints = Number(env.MASANAWA_BILLING_FEE_BPS ?? "0");
    const feeFixedKobo = Number(
      env.MASANAWA_BILLING_FEE_FIXED_KOBO ?? "0",
    );

    if (
      !productionAuth ||
      !billingAuthorizer ||
      !billingCustomerAuthorizer ||
      !database.billingStore ||
      !database.billingQuotes ||
      !database.billingWebhooks ||
      !flutterwaveSecretKey ||
      !flutterwaveBills ||
      !flutterwaveFunding ||
      !webhookHash ||
      !webhookUrl ||
      !actionSecret ||
      !redirectUrl ||
      !Number.isSafeInteger(feeBasisPoints) ||
      feeBasisPoints < 0 ||
      feeBasisPoints > 10_000 ||
      !Number.isSafeInteger(feeFixedKobo) ||
      feeFixedKobo < 0
    ) {
      await database.close().catch(() => undefined);
      throw new TypeError(
        "Billing is enabled but production auth or Flutterwave billing configuration is incomplete",
      );
    }

    composedBillingFinancial ??= createBillingFinancialService({
      billingStore: database.billingStore,
      webhookRepository: database.billingWebhooks,
      authorizer: billingAuthorizer,
      flutterwaveSecretKey,
      flutterwaveWebhookHash: webhookHash,
      flutterwaveWebhookUrl: webhookUrl,
      providerClient: flutterwaveBills,
      billingFunding: database.billingQuotes,
      ...(flutterwaveRelayUrl ? { flutterwaveRelayUrl } : {}),
      ...(flutterwaveRelayToken ? { flutterwaveRelayToken } : {}),
      ...(flutterwaveRelayProtocol === "dual-header"
        ? { flutterwaveRelayProtocol: "dual-header" as const }
        : {}),
    });

    composedBillingCheckout ??= createBillingCheckoutService({
      sessions: billingCustomerAuthorizer,
      quotes: database.billingQuotes,
      catalog: flutterwaveBills,
      funding: flutterwaveFunding,
      billing: composedBillingFinancial,
      actionSecret,
      redirectUrl,
      feeBasisPoints,
      feeFixedKobo,
    });
  }

  const composedDirectory =
    options.appOptions?.agentDirectory ??
    (directoryAuthorizer && database.agentPresentations
      ? createAgentDirectoryService({
          presentations: database.agentPresentations,
          authorizer: directoryAuthorizer,
          ...(database.platformAgentProfiles
            ? { platformProfiles: database.platformAgentProfiles }
            : {}),
          ...(database.userAgentPreferences
            ? { userPreferences: database.userAgentPreferences }
            : {}),
          ...(database.mobileActivity
            ? { activity: database.mobileActivity }
            : {}),
        })
      : undefined);

  const composedCommerceFulfillment =
    options.appOptions?.commerceFulfillment ??
    (commerceAuthorizer &&
    database.commerce &&
    database.ownerships &&
    database.characterSkillAssignments &&
    database.platformAgentProfiles &&
    database.skills
      ? createCommerceFulfillmentService({
          authorizer: commerceAuthorizer,
          commerce: database.commerce,
          ownerships: database.ownerships,
          assignments: database.characterSkillAssignments,
          platformProfiles: database.platformAgentProfiles,
          skills: database.skills,
        })
      : undefined);

  const composedCommerceCatalog =
    options.appOptions?.commerceCatalog ??
    (commerceAuthorizer &&
    database.commerce &&
    database.relationships &&
    database.ownerships &&
    database.skills
      ? createCommerceCatalogService({
          authorizer: commerceAuthorizer,
          commerce: database.commerce,
          relationships: database.relationships,
          ownerships: database.ownerships,
          skills: database.skills,
        })
      : undefined);

  const composedCreatorSkills =
    options.appOptions?.creatorSkills ??
    (creatorCloneAuthorizer &&
    database.personalClones &&
    database.characterSkillAssignments &&
    database.skills &&
    database.skillGuides &&
    database.skillDistribution
      ? createCreatorSkillService({
          authorizer: creatorCloneAuthorizer,
          personalClones: database.personalClones,
          assignments: database.characterSkillAssignments,
          skills: database.skills,
          guides: database.skillGuides,
          distribution: database.skillDistribution,
        })
      : undefined);

  const composedCreatorEconomy =
    options.appOptions?.creatorEconomy ??
    (creatorCloneAuthorizer &&
    database.personalClones &&
    database.commerce
      ? createCreatorEconomyService({
          authorizer: creatorCloneAuthorizer,
          personalClones: database.personalClones,
          commerce: database.commerce,
        })
      : undefined);

  const composedCreatorClone =
    options.appOptions?.creatorClone ??
    (creatorCloneAuthorizer &&
    database.personalClones &&
    database.agentPresentations &&
    database.characterSkillAssignments
      ? createCreatorCloneService({
          authorizer: creatorCloneAuthorizer,
          personalClones: database.personalClones,
          presentations: database.agentPresentations,
          skillAssignments: database.characterSkillAssignments,
        })
      : undefined);

  const composedConversation =
    options.appOptions?.agentConversation ??
    (conversationAuthorizer &&
    strategy &&
    database.characterSessions &&
    database.agentRuns
      ? createAgentConversationService({
          sessions: database.characterSessions,
          runs: database.agentRuns,
          authorizer: conversationAuthorizer,
          strategy,
          ...(nativeAudio ? { nativeAudio } : {}),
          ...(database.mobileShell ? { mobileShell: database.mobileShell } : {}),
          sessionDurationMs: 24 * 60 * 60 * 1000,
        })
      : undefined);

  const composedPush =
    options.appOptions?.mobilePush ??
    (conversationAuthorizer && database.mobilePush
      ? createMobilePushRegistrationService({
          authorizer: conversationAuthorizer,
          repository: database.mobilePush,
        })
      : undefined);

  if (
    database.mobilePush &&
    env.MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  ) {
    pushSender = createFcmPushSender({
      serviceAccountJson: env.MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON,
      repository: database.mobilePush,
    });
  }

  const composedShell =
    options.appOptions?.agentShell ??
    (conversationAuthorizer &&
    database.characterSessions &&
    database.mobileShell
      ? createAgentShellService({
          authorizer: conversationAuthorizer,
          sessions: database.characterSessions,
          repository: database.mobileShell,
          ...(database.mobileActivity
            ? { activity: database.mobileActivity }
            : {}),
          ...(options.agentShellActionExecutor
            ? { actionExecutor: options.agentShellActionExecutor }
            : {}),
          minimumAppVersion: env.MASANAWA_MOBILE_MIN_VERSION ?? "1.0.0",
          recommendedAppVersion:
            env.MASANAWA_MOBILE_RECOMMENDED_VERSION ??
            env.MASANAWA_MOBILE_MIN_VERSION ??
            "1.0.0",
        })
      : undefined);

  let app: ManagedNodeServer;
  try {
    app = appFactory({
      ...(options.appOptions ?? {}),
      ...(productionAuth ? { productionAuth } : {}),
      ...(composedBillingFinancial
        ? { billingFinancial: composedBillingFinancial }
        : {}),
      ...(composedBillingCheckout
        ? { billingCheckout: composedBillingCheckout }
        : {}),
      ...(composedDirectory ? { agentDirectory: composedDirectory } : {}),
      ...(composedConversation
        ? { agentConversation: composedConversation }
        : {}),
      ...(composedShell ? { agentShell: composedShell } : {}),
      ...(liveVoiceTokens ? { liveVoiceTokens } : {}),
      ...(composedPush ? { mobilePush: composedPush } : {}),
      ...(composedCreatorClone ? { creatorClone: composedCreatorClone } : {}),
      ...(composedCreatorEconomy
        ? { creatorEconomy: composedCreatorEconomy }
        : {}),
      ...(composedCreatorSkills ? { creatorSkills: composedCreatorSkills } : {}),
      ...(composedCommerceCatalog
        ? { commerceCatalog: composedCommerceCatalog }
        : {}),
      ...(composedCommerceFulfillment
        ? { commerceFulfillment: composedCommerceFulfillment }
        : {}),
      readinessChecks: [
        ...(options.appOptions?.readinessChecks ?? []),
        database.readinessCheck,
      ],
      isDraining: drain.isDraining,
    });
  } catch (error) {
    await database.close().catch(() => undefined);
    throw error;
  }

  const lifecycle = await startNodeService({
    serviceName: "gateway",
    server: app,
    config,
    signals: processRef,
    ...(options.logger ? { logger: options.logger } : {}),
    onDraining: drain.beginDraining,
    onAfterClose: database.close,
    onFatalShutdown: () => {
      processRef.exitCode = 1;
    },
  });

  return Object.freeze({
    config,
    address: lifecycle.address,
    app,
    ...(pushSender ? { pushSender } : {}),
    isDraining: drain.isDraining,
    drain: drain.beginDraining,
    shutdown: (reason: ServiceSignal | "manual" = "manual") =>
      lifecycle.stop(reason),
    disposeSignals: lifecycle.disposeSignals,
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectExecution()) {
  void startGatewayService().catch(() => {
    process.exitCode = 1;
  });
}

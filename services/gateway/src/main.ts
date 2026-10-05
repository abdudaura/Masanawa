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
  UserRelationshipProvisioner,
  UserRelationshipReader,
} from "@masanawa/identity";
import type { CommerceRepository, CryptoRepository } from "@masanawa/commerce";
import { parseCanonicalId, readRequiredEnv } from "@masanawa/contracts";
import type { PlatformSessionRepository } from "@masanawa/security";
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
  createPostgresCryptoRepository,
  createPostgresPlatformAgentProfileRepository,
  createPostgresSkillGuideRepository,
  createPostgresSkillDistributionRepository,
  createPostgresSkillRepository,
  createPostgresUserAgentPreferenceRepository,
  createPostgresPersonalCloneProvisioningRepository,
  createPostgresUserRelationshipReader,
  createPostgresUserRelationshipProvisioner,
  createPostgresPlatformSessionRepository,
  createPostgresServiceDependency,
  createPostgresMobileShellRepository,
  createPostgresMobilePushRepository,
  createPostgresMobileAgentActivityRepository,
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
import {
  NowPaymentsClient,
  NowPaymentsCustodyClient,
  NowPaymentsPayoutClient,
  collectNowPaymentsRuntimeEvidence,
} from "@masanawa/nowpayments";
import { createGeminiAlphaInferenceProvider } from "./alpha_executor.js";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";
import {
  createFinancialService,
  type FinancialAuthorizer,
} from "./financial_service.js";
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
  createCustomerAuthService,
  createHttpSmsOtpDelivery,
  createPlatformCustomerAuthorizers,
  createPlatformCustomerSessionAuthorizer,
  createPlatformSessionFinancialAuthorizer,
  createResendOtpDelivery,
  type CustomerAuthService,
} from "./customer_auth.js";

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
  readonly relationshipProvisioner?: UserRelationshipProvisioner;
  readonly platformSessions?: PlatformSessionRepository;
  readonly commerce?: CommerceRepository;
  readonly crypto?: CryptoRepository;
  readonly ownerships?: CharacterOwnershipReader;
  readonly mobileShell?: MobileShellRepository;
  readonly mobilePush?: MobilePushRepository;
  readonly mobileActivity?: MobileAgentActivityRepository;
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
  readonly financialAuthorizer?: FinancialAuthorizer;
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
    relationshipProvisioner:
      createPostgresUserRelationshipProvisioner(database.pool),
    platformSessions: createPostgresPlatformSessionRepository(database.pool),
    commerce: createPostgresCommerceRepository(database.pool),
    crypto: createPostgresCryptoRepository(database.pool),
    ownerships: createPostgresCharacterOwnershipReader(database.pool),
    mobileShell: createPostgresMobileShellRepository(database.pool),
    mobilePush: createPostgresMobilePushRepository(database.pool),
    mobileActivity: createPostgresMobileAgentActivityRepository(database.pool),
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

function productionGeminiApiKey(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const direct =
    env.MASANAWA_GEMINI_API_KEY?.trim() ||
    env.MASANAWA_ALPHA_GEMINI_API_KEY?.trim();
  if (direct) return direct;
  const raw =
    env.MASANAWA_GEMINI_API_KEYS_JSON?.trim() ||
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

function readCsvEnv(value: string | undefined): readonly string[] {
  if (!value?.trim()) return Object.freeze([]);
  return Object.freeze([
    ...new Set(
      value.split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean),
    ),
  ]);
}

function readWithdrawalAllowlist(value: string | undefined): ReadonlySet<string> {
  if (!value?.trim()) return new Set();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("NOWPAYMENTS_WITHDRAWAL_ALLOWLIST_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError("NOWPAYMENTS_WITHDRAWAL_ALLOWLIST_JSON must be an array");
  }
  const keys = new Set<string>();
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("NOWPAYMENTS_WITHDRAWAL_ALLOWLIST_JSON entry is invalid");
    }
    const row = item as Record<string, unknown>;
    const userId = typeof row.userId === "string" ? row.userId.trim() : "";
    const providerCode =
      typeof row.providerCode === "string" ? row.providerCode.trim().toUpperCase() : "";
    const address = typeof row.address === "string" ? row.address.trim() : "";
    if (!userId || !providerCode || !address) {
      throw new TypeError("NOWPAYMENTS_WITHDRAWAL_ALLOWLIST_JSON entry is incomplete");
    }
    keys.add(`${userId}|${providerCode}|${address}`);
  }
  return keys;
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
  let financialAuthorizer = options.financialAuthorizer;
  let strategy = options.agentStrategy;
  let nativeAudio;
  let liveVoiceTokens: LiveVoiceTokenService | undefined;
  let pushSender: MobilePushSender | undefined;
  let customerAuth: CustomerAuthService | undefined =
    options.appOptions?.customerAuth;

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

  const platformTenantRaw = env.MASANAWA_PLATFORM_TENANT_ID?.trim();
  const otpPepper = env.MASANAWA_AUTH_OTP_PEPPER?.trim();
  if (
    platformTenantRaw &&
    otpPepper &&
    database.platformSessions &&
    database.agentPresentations &&
    database.characterSkillAssignments &&
    database.relationships &&
    database.relationshipProvisioner &&
    database.platformAgentProfiles
  ) {
    const platformTenantId = parseCanonicalId("tenant", platformTenantRaw);
    const customerSessions = createPlatformCustomerSessionAuthorizer({
      repository: database.platformSessions,
    });
    financialAuthorizer ??= createPlatformSessionFinancialAuthorizer({
      repository: database.platformSessions,
    });

    if (!customerAuth) {
      const resendApiKey = env.RESEND_API_KEY?.trim();
      const resendFrom = env.MASANAWA_AUTH_EMAIL_FROM?.trim();
      const smsEndpoint = env.MASANAWA_AUTH_SMS_ENDPOINT?.trim();
      const smsToken = env.MASANAWA_AUTH_SMS_TOKEN?.trim();
      customerAuth = createCustomerAuthService({
        repository: database.platformSessions,
        tenantId: platformTenantId,
        otpPepper,
        ...(resendApiKey && resendFrom
          ? {
              emailDelivery: createResendOtpDelivery({
                apiKey: resendApiKey,
                from: resendFrom,
              }),
            }
          : {}),
        ...(smsEndpoint && smsToken
          ? {
              smsDelivery: createHttpSmsOtpDelivery({
                endpoint: smsEndpoint,
                bearerToken: smsToken,
              }),
            }
          : {}),
      });
    }

    const customerAuthorizers = createPlatformCustomerAuthorizers({
      sessions: customerSessions,
      presentations: database.agentPresentations,
      skillAssignments: database.characterSkillAssignments,
      relationships: database.relationships,
      relationshipProvisioner: database.relationshipProvisioner,
      platformProfiles: database.platformAgentProfiles,
      policyRevision:
        env.MASANAWA_PLATFORM_POLICY_REVISION?.trim() ||
        "production-mobile-v1",
    });
    if (!options.agentDirectoryAuthorizer) {
      directoryAuthorizer = customerAuthorizers.directory;
    }
    if (!options.agentConversationAuthorizer) {
      conversationAuthorizer = customerAuthorizers.conversation;
    }
    if (!options.creatorCloneAuthorizer) {
      creatorCloneAuthorizer = customerAuthorizers.creator;
    }
    if (!options.commerceAuthorizer) {
      commerceAuthorizer = customerAuthorizers.commerce;
    }

    if (!strategy) {
      if (!database.skills || !database.skillGuides) {
        await database.close().catch(() => undefined);
        throw new Error(
          "Production Agent runtime requires canonical Skill repositories",
        );
      }
      const apiKey = productionGeminiApiKey(env);
      strategy = createAlphaInferenceStrategy({
        inference: createGeminiAlphaInferenceProvider({
          apiKey,
          model:
            env.MASANAWA_GEMINI_MODEL?.trim() ||
            env.MASANAWA_ALPHA_GEMINI_MODEL?.trim() ||
            "gemini-3.8-flash",
        }),
        skills: database.skills,
        guides: database.skillGuides,
      });
    }

    const apiKey = productionGeminiApiKey(env);
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
    if (conversationAuthorizer) {
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
  }

  const nowPaymentsApiKey = env.NOWPAYMENTS_API_KEY?.trim();
  const nowPaymentsIpnSecret = env.NOWPAYMENTS_IPN_SECRET?.trim();
  const nowPaymentsEmail = env.NOWPAYMENTS_PAYOUT_EMAIL?.trim();
  const nowPaymentsPassword = env.NOWPAYMENTS_PAYOUT_PASSWORD?.trim();
  const nowPaymentsRelayToken = env.MASANAWA_NOWPAYMENTS_RELAY_TOKEN?.trim();
  const nowPaymentsRelayBaseUrl =
    env.NOWPAYMENTS_RELAY_URL?.trim() ||
    "https://209-38-107-173.sslip.io/v1";
  const rawPublicBaseUrl =
    env.MASANAWA_PUBLIC_BASE_URL?.trim() ||
    env.RAILWAY_STATIC_URL?.trim() ||
    env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const publicBaseUrl = rawPublicBaseUrl
    ? (/^https?:\/\//iu.test(rawPublicBaseUrl)
        ? rawPublicBaseUrl
        : `https://${rawPublicBaseUrl}`)
    : undefined;

  const conversionProviderCodes = readCsvEnv(
    env.NOWPAYMENTS_CONVERSION_PROVIDER_CODES,
  );
  const withdrawalProviderCodes = readCsvEnv(
    env.NOWPAYMENTS_WITHDRAWAL_PROVIDER_CODES,
  );
  const withdrawalAllowlist = readWithdrawalAllowlist(
    env.NOWPAYMENTS_WITHDRAWAL_ALLOWLIST_JSON,
  );
  const payoutFeeMode =
    env.NOWPAYMENTS_PAYOUT_FEE_MODE === "sender" ||
    env.NOWPAYMENTS_PAYOUT_FEE_MODE === "receiver"
      ? env.NOWPAYMENTS_PAYOUT_FEE_MODE
      : undefined;

  let composedFinancial = options.appOptions?.financial;
  if (
    !composedFinancial &&
    financialAuthorizer &&
    database.crypto &&
    nowPaymentsApiKey &&
    nowPaymentsIpnSecret &&
    nowPaymentsEmail &&
    nowPaymentsPassword &&
    nowPaymentsRelayToken &&
    publicBaseUrl
  ) {
    const sharedProviderOptions = {
      apiKey: nowPaymentsApiKey,
      baseUrl: nowPaymentsRelayBaseUrl,
      relayToken: nowPaymentsRelayToken,
    };
    const payments = new NowPaymentsClient(sharedProviderOptions);
    const custody = new NowPaymentsCustodyClient({
      ...sharedProviderOptions,
      email: nowPaymentsEmail,
      password: nowPaymentsPassword,
    });
    const payout = new NowPaymentsPayoutClient({
      ...sharedProviderOptions,
      email: nowPaymentsEmail,
      password: nowPaymentsPassword,
    });

    const runtimeEvidence = () =>
      collectNowPaymentsRuntimeEvidence({
        payments,
        custody,
        payout,
        config: {
          conversionEnabled:
            env.NOWPAYMENTS_CONVERSIONS_ENABLED === "true",
          payoutEnabled:
            env.NOWPAYMENTS_PAYOUTS_ENABLED === "true" &&
            env.NOWPAYMENTS_PAYOUT_2FA_READY === "true",
          ipWhitelistSatisfied:
            env.NOWPAYMENTS_FIXED_EGRESS_CONFIRMED === "true",
          payoutDestinationWhitelistSatisfied:
            env.NOWPAYMENTS_DESTINATION_WHITELIST_CONFIRMED === "true",
          conversionProviderCodes,
          withdrawalProviderCodes,
        },
        signal: AbortSignal.timeout(15_000),
      });

    const fiatCurrencies = readCsvEnv(env.NOWPAYMENTS_FIAT_CURRENCIES);
    const settlementProviderCode =
      env.NOWPAYMENTS_FIAT_SETTLEMENT_PROVIDER_CODE?.trim().toUpperCase();

    composedFinancial = createFinancialService({
      authorizer: financialAuthorizer,
      crypto: database.crypto,
      nowPayments: payments,
      nowPaymentsCustody: custody,
      nowPaymentsPayout: payout,
      withdrawalEvidence:
        env.NOWPAYMENTS_PAYOUTS_ENABLED === "true" &&
        env.NOWPAYMENTS_PAYOUT_2FA_READY === "true" &&
        payoutFeeMode !== undefined
          ? runtimeEvidence
          : undefined,
      conversionEvidence:
        env.NOWPAYMENTS_CONVERSIONS_ENABLED === "true"
          ? runtimeEvidence
          : undefined,
      ...(payoutFeeMode === undefined
        ? {}
        : { withdrawalNetworkFeeMode: payoutFeeMode }),
      withdrawalDestinationApproved: async (request) =>
        withdrawalAllowlist.has(
          `${request.userId}|${request.providerCode}|${request.destinationAddress}`,
        ),
      ...(env.NOWPAYMENTS_PAYOUT_VERIFICATION_CODE?.trim()
        ? {
            payoutVerificationCodeProvider: async () =>
              env.NOWPAYMENTS_PAYOUT_VERIFICATION_CODE!.trim(),
          }
        : {}),
      ...(env.NOWPAYMENTS_FIAT_ONRAMP_ENABLED === "true" &&
      fiatCurrencies.length > 0 &&
      settlementProviderCode
        ? {
            fiatOnRamp: {
              enabled: true as const,
              fiatCurrencies,
              settlementProviderCode,
            },
          }
        : {}),
      nowPaymentsIpnSecret,
      publicBaseUrl,
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
      ...(customerAuth ? { customerAuth } : {}),
      ...(composedFinancial ? { financial: composedFinancial } : {}),
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

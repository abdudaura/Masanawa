import { pathToFileURL } from "node:url";
import type {
  AgentPresentationRepository,
  AgentRunRepository,
  AgentStrategy,
  CharacterContextCompiler,
  CharacterSessionRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import { parseCanonicalId, readRequiredEnv } from "@masanawa/contracts";
import type { BillingQuoteRepository, CryptoRepository } from "@masanawa/commerce";
import {
  NowPaymentsClient,
  NowPaymentsCustodyClient,
  NowPaymentsPayoutClient,
  withRouteEvidence,
} from "@masanawa/nowpayments";
import { FlutterwaveBillsClient, FlutterwaveFundingClient, FlutterwaveHttpTransport } from "@masanawa/providers";
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
  financialMigrationRoots,
  createPostgresAgentPresentationRepository,
  createPostgresAgentRunRepository,
  createPostgresCharacterSessionRepository,
  createPostgresCharacterContextCompiler,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresCryptoRepository,
  createPostgresServiceDependency,
  createPostgresBillingFulfillmentStore,
  createPostgresBillingQuoteRepository,
  createPostgresPlatformSessionRepository,
  createPostgresProviderWebhookRepository,
  createPostgresChannelAdmission,
} from "@masanawa/postgres";
import {
  createWhatsAppIngress,
  createTelegramIngress,
} from "@masanawa/messaging-channels";
import {
  createAgentDirectoryService,
  type AgentDirectoryAuthorizer,
} from "./agent_directory.js";
import { createAgentConversationService } from "./agent_conversation.js";
import type {
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import {
  createAlphaDevAuthorizer,
  createAlphaDirectoryAuthorizer,
  parseAlphaDevIds,
  parseAlphaRelationshipMap,
} from "./alpha_dev.js";
import { createGeminiAlphaInferencePool, parseAlphaGeminiKeys } from "./alpha_executor.js";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";
import { createGeminiLiveAudioRenderer } from "./native_audio.js";
import {
  createFinancialService,
  createFixedFinancialAuthorizer,
  type FinancialAuthorizer,
} from "./financial_service.js";
import {
  createGatewayApp,
  type GatewayAppOptions,
  type ReadinessCheck,
} from "./app.js";
import { createBillingFinancialService } from "./financial_billing.js";
import {
  createCustomerAuthService,
  createHttpSmsOtpDelivery,
  createPlatformCustomerSessionAuthorizer,
  createPlatformSessionFinancialAuthorizer,
  createResendOtpDelivery,
  type CustomerAuthService,
  type PlatformCustomerSessionAuthorizer,
} from "./customer_auth.js";
import { createBillingCheckoutService, type BillingCheckoutService } from "./billing_checkout.js";

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
  readonly characterContextCompiler?: CharacterContextCompiler;
  readonly crypto?: CryptoRepository;
  readonly billingStore?: (
    identity: Readonly<{ tenantId: string; userId: string }>,
  ) => ReturnType<typeof createPostgresBillingFulfillmentStore>;
  readonly providerWebhooks?: ReturnType<typeof createPostgresProviderWebhookRepository>;
  readonly billingQuotes?: BillingQuoteRepository;
  readonly platformSessions?: PlatformSessionRepository;
  readonly channelAdmission?: ReturnType<typeof createPostgresChannelAdmission>;
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
  readonly financialAuthorizer?: FinancialAuthorizer;
  readonly agentStrategy?: AgentStrategy;
  readonly characterContextCompiler?: CharacterContextCompiler;
}

export interface GatewayServiceRuntime {
  readonly config: GatewayServiceConfig;
  readonly address: string;
  readonly app: ManagedNodeServer;
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
    migrationRoots: financialMigrationRoots(),
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
    characterContextCompiler: createPostgresCharacterContextCompiler(database.pool),
    crypto: createPostgresCryptoRepository(database.pool),
    billingStore: (identity: Readonly<{ tenantId: string; userId: string }>) =>
      createPostgresBillingFulfillmentStore(database.pool, identity),
    providerWebhooks: createPostgresProviderWebhookRepository(database.pool),
    billingQuotes: createPostgresBillingQuoteRepository(database.pool),
    platformSessions: createPostgresPlatformSessionRepository(database.pool),
    channelAdmission: createPostgresChannelAdmission(database.pool),
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
  let financialAuthorizer = options.financialAuthorizer;
  let strategy = options.agentStrategy;
  let nativeAudio;

  if (alphaEnabled(env)) {
    if (
      !database.agentPresentations ||
      !database.characterSkillAssignments ||
      !database.characterSessions ||
      !database.agentRuns ||
      !(options.characterContextCompiler ?? database.characterContextCompiler)
    ) {
      await database.close().catch(() => undefined);
      throw new Error("Alpha mode requires canonical agent PostgreSQL repositories and a Character context compiler");
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
      relationshipIds,
    });
    financialAuthorizer ??= createFixedFinancialAuthorizer({
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
    });
    const alphaGeminiKeys = parseAlphaGeminiKeys({
      apiKey: env.MASANAWA_ALPHA_GEMINI_API_KEY,
      apiKeysJson: env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON,
    });
    strategy ??= createAlphaInferenceStrategy({
      inference: createGeminiAlphaInferencePool({
        apiKeys: alphaGeminiKeys,
        model: requiredAlphaEnv(env, "MASANAWA_ALPHA_GEMINI_MODEL"),
      }),
    });
    nativeAudio = createGeminiLiveAudioRenderer({
      apiKey: alphaGeminiKeys[0]!,
      model: env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
      voiceName: env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE ?? "Kore",
    });

  }

  const nowPaymentsApiKey = env.NOWPAYMENTS_API_KEY?.trim();
  const nowPaymentsIpnSecret = env.NOWPAYMENTS_IPN_SECRET?.trim();
  const payoutEmail = env.NOWPAYMENTS_PAYOUT_EMAIL?.trim();
  const payoutPassword = env.NOWPAYMENTS_PAYOUT_PASSWORD?.trim();
  const custodyEnabled = env.NOWPAYMENTS_CUSTODY_ENABLED === "true";
  const conversionEnabled = env.NOWPAYMENTS_CONVERSION_ENABLED === "true";
  const payoutEnabled = env.NOWPAYMENTS_PAYOUT_ENABLED === "true";
  const destinationAllowlist = (() => {
    const raw = env.NOWPAYMENTS_PAYOUT_DESTINATION_ALLOWLIST_JSON?.trim();
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new TypeError("NOWPAYMENTS_PAYOUT_DESTINATION_ALLOWLIST_JSON must be a JSON array");
    }
    const values = new Set<string>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new TypeError("NOWPAYMENTS_PAYOUT_DESTINATION_ALLOWLIST_JSON entry invalid");
      }
      const row = entry as { providerCode?: unknown; address?: unknown };
      const providerCode =
        typeof row.providerCode === "string" ? row.providerCode.trim().toUpperCase() : "";
      const address = typeof row.address === "string" ? row.address.trim() : "";
      if (!/^[A-Z0-9_-]{2,32}$/u.test(providerCode) || !address || address.length > 512) {
        throw new TypeError("NOWPAYMENTS_PAYOUT_DESTINATION_ALLOWLIST_JSON entry invalid");
      }
      values.add(`${providerCode}\u0000${address}`);
    }
    return values;
  })();
  const rawPublicBaseUrl =
    env.MASANAWA_PUBLIC_BASE_URL?.trim() ||
    env.RAILWAY_STATIC_URL?.trim() ||
    env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const publicBaseUrl = rawPublicBaseUrl
    ? (/^https?:\/\//iu.test(rawPublicBaseUrl)
        ? rawPublicBaseUrl
        : `https://${rawPublicBaseUrl}`)
    : undefined;

  let customerAuth: CustomerAuthService | undefined = options.appOptions?.customerAuth;
  let customerSessionAuthorizer: PlatformCustomerSessionAuthorizer | undefined;
  const platformTenantRaw = env["MASANAWA_PLATFORM_TENANT_ID"]?.trim();
  const otpPepper = env["MASANAWA_AUTH_OTP_PEPPER"]?.trim();
  if (platformTenantRaw && otpPepper && database.platformSessions) {
    const platformTenantId = parseCanonicalId("tenant", platformTenantRaw);
    customerSessionAuthorizer = createPlatformCustomerSessionAuthorizer({
      repository: database.platformSessions,
    });
    // A caller-injected authorizer wins in tests/controlled embedding. Otherwise
    // public platform sessions supersede the Alpha shared token for money routes.
    if (!options.financialAuthorizer) {
      financialAuthorizer = createPlatformSessionFinancialAuthorizer({
        repository: database.platformSessions,
      });
    }

    if (!customerAuth) {
      const resendApiKey = env["RESEND_API_KEY"]?.trim();
      const resendFrom = env["MASANAWA_AUTH_EMAIL_FROM"]?.trim();
      const smsEndpoint = env["MASANAWA_AUTH_SMS_ENDPOINT"]?.trim();
      const smsToken = env["MASANAWA_AUTH_SMS_TOKEN"]?.trim();
      customerAuth = createCustomerAuthService({
        repository: database.platformSessions,
        tenantId: platformTenantId,
        otpPepper,
        ...(resendApiKey && resendFrom
          ? { emailDelivery: createResendOtpDelivery({ apiKey: resendApiKey, from: resendFrom }) }
          : {}),
        ...(smsEndpoint && smsToken
          ? { smsDelivery: createHttpSmsOtpDelivery({ endpoint: smsEndpoint, bearerToken: smsToken }) }
          : {}),
      });
    }
  }

  const nowPayments =
    nowPaymentsApiKey ? new NowPaymentsClient({ apiKey: nowPaymentsApiKey }) : undefined;
  const nowPaymentsCustody =
    nowPaymentsApiKey && payoutEmail && payoutPassword && custodyEnabled
      ? new NowPaymentsCustodyClient({
          apiKey: nowPaymentsApiKey,
          email: payoutEmail,
          password: payoutPassword,
        })
      : undefined;
  const nowPaymentsPayout =
    nowPaymentsApiKey && payoutEmail && payoutPassword && payoutEnabled
      ? new NowPaymentsPayoutClient({
          apiKey: nowPaymentsApiKey,
          email: payoutEmail,
          password: payoutPassword,
        })
      : undefined;

  const freshNowPaymentsEvidence =
    nowPayments && nowPaymentsCustody
      ? async (operation: "convert" | "withdraw") => {
          const signal = AbortSignal.timeout(15_000);
          // A successful authenticated custody read is fresh evidence that the
          // configured merchant credentials and this runtime's current source IP
          // are accepted for the custody account. Consequential operations still
          // perform their own quote/address/fee checks immediately before reserve.
          await nowPaymentsCustody.authenticate(signal);
          await nowPaymentsCustody.readBalances(signal);
          const routes = await nowPayments.listPaymentCurrencies(signal);
          const operationAvailable =
            operation === "convert" ? conversionEnabled : payoutEnabled;
          return Object.freeze({
            account: Object.freeze({
              custodyEnabled: true,
              customerManagementEnabled: null,
              conversionEnabled: conversionEnabled ? true : false,
              payoutEnabled: payoutEnabled ? true : false,
              ipWhitelistSatisfied: true,
              payoutDestinationWhitelistSatisfied:
                destinationAllowlist.size > 0 ? true : false,
              observedAt: new Date().toISOString(),
            }),
            routes: Object.freeze(
              routes.map((route) =>
                withRouteEvidence(route, {
                  operation,
                  operationAvailable,
                }),
              ),
            ),
          });
        }
      : undefined;

  const composedFinancial =
    options.appOptions?.financial ??
    (financialAuthorizer &&
    database.crypto &&
    nowPayments &&
    nowPaymentsIpnSecret &&
    publicBaseUrl
      ? createFinancialService({
          authorizer: financialAuthorizer,
          crypto: database.crypto,
          nowPayments,
          ...(nowPaymentsCustody ? { nowPaymentsCustody } : {}),
          ...(nowPaymentsPayout ? { nowPaymentsPayout } : {}),
          ...(freshNowPaymentsEvidence && conversionEnabled
            ? {
                conversionEvidence: () => freshNowPaymentsEvidence("convert"),
              }
            : {}),
          ...(freshNowPaymentsEvidence && payoutEnabled
            ? {
                withdrawalEvidence: () => freshNowPaymentsEvidence("withdraw"),
              }
            : {}),
          ...(payoutEnabled
            ? {
                withdrawalDestinationApproved: async (candidate: {
                  readonly providerCode: string;
                  readonly destinationAddress: string;
                }) =>
                  destinationAllowlist.has(
                    `${candidate.providerCode.trim().toUpperCase()}\u0000${candidate.destinationAddress.trim()}`,
                  ),
              }
            : {}),
          nowPaymentsIpnSecret,
          publicBaseUrl,
        })
      : undefined);

  const composedDirectory =
    options.appOptions?.agentDirectory ??
    (directoryAuthorizer && database.agentPresentations
      ? createAgentDirectoryService({
          presentations: database.agentPresentations,
          authorizer: directoryAuthorizer,
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
          ...((options.characterContextCompiler ?? database.characterContextCompiler)
            ? { contextCompiler: options.characterContextCompiler ?? database.characterContextCompiler } : {}),
          sessionDurationMs: 24 * 60 * 60 * 1000,
        })
      : undefined);


  const flutterwaveSecretKey = env["FLUTTERWAVE_SECRET_KEY"]?.trim();
  const flutterwaveRelayUrl = env["FLUTTERWAVE_RELAY_URL"]?.trim();
  const flutterwaveRelayToken = env["MASANAWA_FLUTTERWAVE_RELAY_TOKEN"]?.trim();
  const flutterwaveRelayProtocol =
    env["FLUTTERWAVE_RELAY_PROTOCOL"] === "dual-header" ? "dual-header" as const : "bearer" as const;
  const flutterwaveTransport =
    flutterwaveSecretKey &&
    (Boolean(flutterwaveRelayUrl) === Boolean(flutterwaveRelayToken))
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
    flutterwaveSecretKey && flutterwaveTransport
      ? new FlutterwaveBillsClient({
          secretKey: flutterwaveSecretKey,
          transport: flutterwaveTransport,
          country: "NG",
        })
      : undefined;
  const flutterwaveFunding =
    flutterwaveSecretKey && flutterwaveTransport
      ? new FlutterwaveFundingClient({
          secretKey: flutterwaveSecretKey,
          transport: flutterwaveTransport,
        })
      : undefined;

  const composedBilling =
    options.appOptions?.billingFinancial ??
    (env["FLUTTERWAVE_BILLS_ENABLED"] === "true" &&
    financialAuthorizer &&
    database.billingStore &&
    database.billingQuotes &&
    database.providerWebhooks &&
    flutterwaveSecretKey &&
    flutterwaveBills &&
    env["FLUTTERWAVE_WEBHOOK_SECRET_HASH"]?.trim() &&
    env["FLUTTERWAVE_WEBHOOK_URL"]?.trim()
      ? createBillingFinancialService({
          billingStore: database.billingStore,
          webhookRepository: database.providerWebhooks,
          authorizer: financialAuthorizer,
          flutterwaveSecretKey,
          flutterwaveWebhookHash: env["FLUTTERWAVE_WEBHOOK_SECRET_HASH"],
          flutterwaveWebhookUrl: env["FLUTTERWAVE_WEBHOOK_URL"],
          providerClient: flutterwaveBills,
          billingFunding: database.billingQuotes,
          ...(flutterwaveRelayUrl ? { flutterwaveRelayUrl } : {}),
          ...(flutterwaveRelayProtocol === "dual-header"
            ? { flutterwaveRelayProtocol: "dual-header" as const }
            : {}),
          ...(flutterwaveRelayToken ? { flutterwaveRelayToken } : {}),
        })
      : undefined);

  const feeBasisPoints = Number(env["MASANAWA_BILLING_FEE_BPS"] ?? "0");
  const feeFixedKobo = Number(env["MASANAWA_BILLING_FEE_FIXED_KOBO"] ?? "0");
  const billingActionSecret = env["MASANAWA_BILLING_ACTION_SECRET"]?.trim();
  const billingRedirectUrl =
    env["MASANAWA_BILLING_REDIRECT_URL"]?.trim() ??
    (publicBaseUrl ? `${publicBaseUrl.replace(/\/$/u, "")}/billing/return` : undefined);
  const composedBillingCheckout: BillingCheckoutService | undefined =
    options.appOptions?.billingCheckout ??
    (env["FLUTTERWAVE_BILLS_ENABLED"] === "true" &&
    customerSessionAuthorizer &&
    database.billingQuotes &&
    flutterwaveBills &&
    flutterwaveFunding &&
    composedBilling &&
    billingActionSecret &&
    billingRedirectUrl &&
    Number.isSafeInteger(feeBasisPoints) &&
    feeBasisPoints >= 0 &&
    feeBasisPoints <= 10_000 &&
    Number.isSafeInteger(feeFixedKobo) &&
    feeFixedKobo >= 0
      ? createBillingCheckoutService({
          sessions: customerSessionAuthorizer,
          quotes: database.billingQuotes,
          catalog: flutterwaveBills,
          funding: flutterwaveFunding,
          billing: composedBilling,
          actionSecret: billingActionSecret,
          redirectUrl: billingRedirectUrl,
          feeBasisPoints,
          feeFixedKobo,
        })
      : undefined);

  const composedWhatsAppIngress =
    options.appOptions?.whatsAppIngress ??
    (database.channelAdmission &&
    env["WHATSAPP_CHANNEL_ACCOUNT_ID"]?.trim() &&
    env["WHATSAPP_BUSINESS_ACCOUNT_ID"]?.trim() &&
    env["WHATSAPP_PHONE_NUMBER_ID"]?.trim() &&
    env["WHATSAPP_APP_SECRET"]?.trim() &&
    env["WHATSAPP_VERIFY_TOKEN"]?.trim()
      ? createWhatsAppIngress({
          accountId: env["WHATSAPP_CHANNEL_ACCOUNT_ID"] as never,
          businessAccountId: env["WHATSAPP_BUSINESS_ACCOUNT_ID"],
          phoneNumberId: env["WHATSAPP_PHONE_NUMBER_ID"],
          appSecret: env["WHATSAPP_APP_SECRET"],
          verifyToken: env["WHATSAPP_VERIFY_TOKEN"],
          admission: database.channelAdmission,
        })
      : undefined);

  const composedTelegramIngress =
    options.appOptions?.telegramIngress ??
    (database.channelAdmission &&
    env["TELEGRAM_CHANNEL_ACCOUNT_ID"]?.trim() &&
    env["TELEGRAM_BOT_ID"]?.trim() &&
    env["TELEGRAM_WEBHOOK_SECRET"]?.trim()
      ? createTelegramIngress({
          accountId: env["TELEGRAM_CHANNEL_ACCOUNT_ID"] as never,
          botId: env["TELEGRAM_BOT_ID"],
          webhookSecret: env["TELEGRAM_WEBHOOK_SECRET"],
          admission: database.channelAdmission,
        })
      : undefined);

  let app: ManagedNodeServer;
  try {
    app = appFactory({
      ...(options.appOptions ?? {}),
      ...(composedDirectory ? { agentDirectory: composedDirectory } : {}),
      ...(composedConversation
        ? { agentConversation: composedConversation }
        : {}),
      ...(composedFinancial ? { financial: composedFinancial } : {}),
      ...(composedBilling ? { billingFinancial: composedBilling } : {}),
      ...(customerAuth ? { customerAuth } : {}),
      ...(composedBillingCheckout ? { billingCheckout: composedBillingCheckout } : {}),
      ...(composedWhatsAppIngress ? { whatsAppIngress: composedWhatsAppIngress } : {}),
      ...(composedTelegramIngress ? { telegramIngress: composedTelegramIngress } : {}),
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


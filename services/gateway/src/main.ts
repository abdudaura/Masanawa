import { pathToFileURL } from "node:url";
import type {
  AgentPresentationRepository,
  AgentRunRepository,
  AgentStrategy,
  CharacterContextCompiler,
  CharacterSessionRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import { readRequiredEnv } from "@masanawa/contracts";
import type { CryptoRepository } from "@masanawa/commerce";
import { NowPaymentsClient, NowPaymentsPayoutClient } from "@masanawa/nowpayments";
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
  createPostgresProviderWebhookRepository,
} from "@masanawa/postgres";
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
    billingStore: (identity) =>
      createPostgresBillingFulfillmentStore(database.pool, identity),
    providerWebhooks: createPostgresProviderWebhookRepository(database.pool),
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
  const publicBaseUrl =
    env.MASANAWA_PUBLIC_BASE_URL?.trim() ||
    env.RAILWAY_STATIC_URL?.trim() ||
    (env.RAILWAY_PUBLIC_DOMAIN?.trim()
      ? `https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`
      : undefined);

  const composedFinancial =
    options.appOptions?.financial ??
    (financialAuthorizer &&
    database.crypto &&
    nowPaymentsApiKey &&
    nowPaymentsIpnSecret &&
    publicBaseUrl
      ? createFinancialService({
          authorizer: financialAuthorizer,
          crypto: database.crypto,
          nowPayments: new NowPaymentsClient({ apiKey: nowPaymentsApiKey }),
          ...(payoutEmail && payoutPassword
            ? {
                nowPaymentsPayout: new NowPaymentsPayoutClient({
                  apiKey: nowPaymentsApiKey,
                  email: payoutEmail,
                  password: payoutPassword,
                }),
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


  let financialAuthorizer: FinancialAuthorizer | undefined;
  if (
    env.MASANAWA_ALPHA_DEV_TOKEN?.trim() &&
    env.MASANAWA_ALPHA_TENANT_ID?.trim() &&
    env.MASANAWA_ALPHA_USER_ID?.trim()
  ) {
    financialAuthorizer = createStaticFinancialAuthorizer({
      token: env.MASANAWA_ALPHA_DEV_TOKEN,
      tenantId: env.MASANAWA_ALPHA_TENANT_ID,
      userId: env.MASANAWA_ALPHA_USER_ID,
    });
  }

  const rawPublicBaseUrl =
    env.MASANAWA_PUBLIC_BASE_URL?.trim() ||
    env.RAILWAY_STATIC_URL?.trim() ||
    env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const publicBaseUrl = rawPublicBaseUrl
    ? (/^https:\/\//u.test(rawPublicBaseUrl) ? rawPublicBaseUrl : `https://${rawPublicBaseUrl}`)
    : undefined;

  const composedCrypto =
    options.appOptions?.cryptoFinancial ??
    (financialAuthorizer &&
    database.financialOperations &&
    env.NOWPAYMENTS_API_KEY?.trim() &&
    env.NOWPAYMENTS_IPN_SECRET?.trim() &&
    publicBaseUrl
      ? createCryptoFinancialService({
          client: new NowPaymentsClient({ apiKey: env.NOWPAYMENTS_API_KEY }),
          repository: database.financialOperations,
          authorizer: financialAuthorizer,
          ipnSecret: env.NOWPAYMENTS_IPN_SECRET,
          publicBaseUrl,
        })
      : undefined);

  const composedBilling =
    options.appOptions?.billingFinancial ??
    (financialAuthorizer &&
    database.financialOperations &&
    database.billingStore &&
    env.FLUTTERWAVE_SECRET_KEY?.trim() &&
    env.FLUTTERWAVE_WEBHOOK_HASH?.trim() &&
    publicBaseUrl
      ? createBillingFinancialService({
          billingStore: database.billingStore,
          repository: database.financialOperations,
          authorizer: financialAuthorizer,
          flutterwaveSecretKey: env.FLUTTERWAVE_SECRET_KEY,
          flutterwaveWebhookHash: env.FLUTTERWAVE_WEBHOOK_HASH,
          publicBaseUrl,
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

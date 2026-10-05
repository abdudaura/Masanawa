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
import type { CommerceRepository } from "@masanawa/commerce";
import { parseCanonicalId, readRequiredEnv } from "@masanawa/contracts";
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
  createPostgresPlatformIdentityBridge,
  type PostgresPlatformIdentityBridge,
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
import { createPlatformSessionVerifier, createProductionAuthorizers } from "./production_auth.js";
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
  readonly platformIdentity?: PostgresPlatformIdentityBridge;
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
    platformIdentity: createPostgresPlatformIdentityBridge(database.pool),
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

function platformAuthEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return Boolean(env.MASANAWA_PLATFORM_AUTH_BASE_URL?.trim());
}

function requiredPlatformEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new TypeError(`${key} is required when platform auth is enabled`);
  return value;
}

function fallbackAuthorizer<T extends { authorize(input: any): Promise<any> }>(
  primary: T,
  fallback: T | undefined,
): T {
  if (!fallback) return primary;
  return Object.freeze({
    async authorize(input: any) {
      try {
        return await primary.authorize(input);
      } catch {
        return fallback.authorize(input);
      }
    },
  }) as T;
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
  let liveVoiceApiKey: string | undefined;
  let liveVoiceModel: string | undefined;
  let liveVoiceName: string | undefined;
  let pushSender: MobilePushSender | undefined;

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
    liveVoiceModel = env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
    liveVoiceName = env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE ?? "Kore";
    liveVoiceApiKey = alphaGeminiApiKey;
    nativeAudio = createGeminiLiveAudioRenderer({
      apiKey: alphaGeminiApiKey,
      model: liveVoiceModel,
      voiceName: liveVoiceName,
    });
  }

  if (platformAuthEnabled(env)) {
    if (
      !database.agentPresentations ||
      !database.characterSkillAssignments ||
      !database.platformIdentity ||
      !database.platformAgentProfiles
    ) {
      await database.close().catch(() => undefined);
      throw new Error("Platform auth requires canonical identity and agent repositories");
    }
    const configuredTenantId = env.MASANAWA_PLATFORM_TENANT_ID?.trim();
    const tenantId = configuredTenantId
      ? parseCanonicalId("tenant", configuredTenantId)
      : await database.platformIdentity.resolveSingleActiveTenant();
    const production = createProductionAuthorizers({
      verifier: createPlatformSessionVerifier({
        baseUrl: requiredPlatformEnv(env, "MASANAWA_PLATFORM_AUTH_BASE_URL"),
      }),
      identities: database.platformIdentity,
      tenantId,
      policyRevision:
        env.MASANAWA_PLATFORM_AUTH_POLICY_REVISION?.trim() ||
        "mobile-platform-session-v1",
      presentations: database.agentPresentations,
      skillAssignments: database.characterSkillAssignments,
      platformProfiles: database.platformAgentProfiles,
    });
    directoryAuthorizer = fallbackAuthorizer(production.directory, directoryAuthorizer);
    conversationAuthorizer = fallbackAuthorizer(production.conversation, conversationAuthorizer);
    creatorCloneAuthorizer = fallbackAuthorizer(production.creator, creatorCloneAuthorizer);
    commerceAuthorizer = fallbackAuthorizer(production.commerce, commerceAuthorizer);
  }

  if (liveVoiceApiKey && liveVoiceModel && liveVoiceName && conversationAuthorizer) {
    liveVoiceTokens = createGeminiLiveTokenService({
      apiKey: liveVoiceApiKey,
      authorizer: conversationAuthorizer,
      model: liveVoiceModel,
      voiceName: liveVoiceName,
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

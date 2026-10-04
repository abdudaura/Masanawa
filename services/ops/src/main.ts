import { pathToFileURL } from "node:url";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type { CharacterVersionReferenceReader } from "@masanawa/identity";
import type { SkillRepository } from "@masanawa/skills";
import {
  createCanonicalId,
  nowInstant,
  parseCanonicalId,
  readRequiredEnv,
} from "@masanawa/contracts";
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
  createPostgresAgentPresentationRepository,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresCharacterVersionReferenceReader,
  createPostgresCommerceRepository,
  createPostgresServiceDependency,
  createPostgresWorldRepository,
  createPostgresSkillRepository,
} from "@masanawa/postgres";
import {
  createAgentAdminService,
  type AgentAdminAuthorizer,
} from "./agent_admin.js";
import {
  createBootstrapAdminAuthorizer,
  readBootstrapAdminAuthConfig,
} from "./admin_auth.js";
import {
  createPlatformAdminService,
  type PlatformAdminOfferCommands,
  type PlatformAdminQuery,
} from "./platform_admin.js";
import {
  createSystemAdminService,
  type SystemAdminWorldCommands,
} from "./system_admin.js";
import {
  createOpsApp,
  type OpsAppOptions,
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
  readonly characterVersions?: CharacterVersionReferenceReader;
  readonly skills?: SkillRepository;
  readonly offerCommands?: PlatformAdminOfferCommands;
  readonly worldCommands?: SystemAdminWorldCommands;
  readonly platformAdminDatabase?: PlatformAdminQuery;
  close(): Promise<void>;
}

export type ServiceDatabaseFactory = (
  env: Readonly<Record<string, string | undefined>>,
) => ServiceDatabaseDependency;

export type OpsServiceConfig = NodeServiceRuntimeConfig;

export interface StartOpsServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: ServiceProcess;
  readonly logger?: ServiceLifecycleLogger;
  readonly databaseFactory?: ServiceDatabaseFactory;
  readonly appFactory?: (options: OpsAppOptions) => ManagedNodeServer;
  readonly appOptions?: Omit<OpsAppOptions, "isDraining">;
  readonly agentAdminAuthorizer?: AgentAdminAuthorizer;
}

export interface OpsServiceRuntime {
  readonly config: OpsServiceConfig;
  readonly address: string;
  readonly app: ManagedNodeServer;
  isDraining(): boolean;
  drain(): void;
  shutdown(reason?: ServiceSignal | "manual"): Promise<void>;
  disposeSignals(): void;
}

export function parseOpsServiceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): OpsServiceConfig {
  return readNodeServiceRuntimeConfig(
    {
      ...env,
      HOST: env.MASANAWA_OPS_HOST ?? env.HOST,
      PORT: env.MASANAWA_OPS_PORT ?? env.PORT,
    },
    {
      port: 3002,
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
    applicationName: "masanawa-ops",
  });
  const commerce = createPostgresCommerceRepository(database.pool);
  const worlds = createPostgresWorldRepository(database.pool);

  const offerCommands: PlatformAdminOfferCommands = Object.freeze({
    async setEnabled(input) {
      const offerId = parseCanonicalId("offer", input.offerId);
      const current = await commerce.readOfferRevision({
        tenantId: input.tenantId,
        offerId,
        revision: input.expectedRevision,
      });
      if (!current) {
        const error = new Error("Offer revision changed or was not found") as Error & {
          statusCode: number;
        };
        error.statusCode = 409;
        throw error;
      }
      const next = await commerce.registerOfferRevision({
        ...current,
        revision: current.revision + 1,
        active: input.enabled,
        createdAt: nowInstant(),
      });
      return {
        offerId: next.offerId,
        key: next.key,
        revision: next.revision,
        enabled: next.active,
        updatedAt: next.createdAt,
      };
    },
  });

  const worldCommands: SystemAdminWorldCommands = Object.freeze({
    async pause(input) {
      const world = await worlds.pauseWorld({
        tenantId: input.tenantId,
        worldId: parseCanonicalId("world", input.worldId),
        expectedRevision: input.expectedRevision,
        pausedAt: nowInstant(),
      });
      return {
        worldId: world.worldId,
        status: world.status,
        policyRevision: world.policyRevision,
        currentGenerationNumber: world.currentGenerationNumber,
        simulationTime: world.simulationTime,
        revision: world.revision,
        updatedAt: world.updatedAt,
      };
    },
    async resume(input) {
      const worldId = parseCanonicalId("world", input.worldId);
      const result = await worlds.recoverPausedWorld({
        tenantId: input.tenantId,
        worldId,
        expectedRevision: input.expectedRevision,
        nextGenerationId: createCanonicalId("world-generation"),
        resumeTo: nowInstant(),
        requestedAt: nowInstant(),
      });
      return {
        worldId: result.world.worldId,
        status: result.world.status,
        policyRevision: result.world.policyRevision,
        currentGenerationNumber: result.world.currentGenerationNumber,
        simulationTime: result.world.simulationTime,
        revision: result.world.revision,
        updatedAt: result.world.updatedAt,
      };
    },
  });

  return Object.freeze({
    readinessCheck: database.readinessCheck,
    agentPresentations: createPostgresAgentPresentationRepository(database.pool),
    characterSkillAssignments:
      createPostgresCharacterSkillAssignmentRepository(database.pool),
    characterVersions:
      createPostgresCharacterVersionReferenceReader(database.pool),
    skills: createPostgresSkillRepository(database.pool),
    offerCommands,
    worldCommands,
    platformAdminDatabase: database.pool as unknown as PlatformAdminQuery,
    close: database.close,
  });
}

export async function startOpsService(
  options: StartOpsServiceOptions = {},
): Promise<OpsServiceRuntime> {
  const env = options.env ?? process.env;
  const config = parseOpsServiceConfig(env);
  const processRef = options.processRef ?? (process as ServiceProcess);
  const drain = createDrainState();
  const databaseFactory =
    options.databaseFactory ?? createDefaultDatabaseDependency;
  const database = databaseFactory(env);
  const appFactory = options.appFactory ?? createOpsApp;
  const bootstrapAdminConfig = readBootstrapAdminAuthConfig(env);
  const adminAuthorizer =
    options.agentAdminAuthorizer ??
    (bootstrapAdminConfig
      ? createBootstrapAdminAuthorizer(bootstrapAdminConfig)
      : undefined);

  const composedAgentAdmin =
    options.appOptions?.agentAdmin ??
    (adminAuthorizer &&
    database.agentPresentations &&
    database.characterSkillAssignments &&
    database.characterVersions &&
    database.skills
      ? createAgentAdminService({
          presentations: database.agentPresentations,
          skillAssignments: database.characterSkillAssignments,
          characterVersions: database.characterVersions,
          skills: database.skills,
          authorizer: adminAuthorizer,
        })
      : undefined);

  const composedSystemAdmin =
    options.appOptions?.systemAdmin ??
    (adminAuthorizer && database.platformAdminDatabase
      ? createSystemAdminService({
          database: database.platformAdminDatabase,
          authorizer: adminAuthorizer,
          ...(database.worldCommands ? { worldCommands: database.worldCommands } : {}),
        })
      : undefined);

  const composedPlatformAdmin =
    options.appOptions?.platformAdmin ??
    (adminAuthorizer && database.platformAdminDatabase
      ? createPlatformAdminService({
          database: database.platformAdminDatabase,
          authorizer: adminAuthorizer,
          ...(database.offerCommands ? { offerCommands: database.offerCommands } : {}),
        })
      : undefined);

  let app: ManagedNodeServer;
  try {
    app = appFactory({
      ...(options.appOptions ?? {}),
      ...(composedAgentAdmin ? { agentAdmin: composedAgentAdmin } : {}),
      ...(composedPlatformAdmin ? { platformAdmin: composedPlatformAdmin } : {}),
      ...(composedSystemAdmin ? { systemAdmin: composedSystemAdmin } : {}),
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
    serviceName: "ops",
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
  void startOpsService().catch(() => {
    process.exitCode = 1;
  });
}

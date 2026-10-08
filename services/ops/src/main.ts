import { pathToFileURL } from "node:url";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type { CharacterVersionReferenceReader } from "@masanawa/identity";
import type { SkillRepository } from "@masanawa/skills";
import { readRequiredEnv } from "@masanawa/contracts";
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
  createPostgresServiceDependency,
  createPostgresSkillRepository,
} from "@masanawa/postgres";
import {
  createAgentAdminService,
  type AgentAdminAuthorizer,
} from "./agent_admin.js";
import { createOperatorAgentControl } from "./operator_admin/agent_control.js";
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
  return Object.freeze({
    readinessCheck: database.readinessCheck,
    agentPresentations: createPostgresAgentPresentationRepository(database.pool),
    characterSkillAssignments:
      createPostgresCharacterSkillAssignmentRepository(database.pool),
    characterVersions:
      createPostgresCharacterVersionReferenceReader(database.pool),
    skills: createPostgresSkillRepository(database.pool),
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

  const composedAgentAdmin =
    options.appOptions?.agentAdmin ??
    (options.agentAdminAuthorizer &&
    database.agentPresentations &&
    database.characterSkillAssignments &&
    database.characterVersions &&
    database.skills
      ? createAgentAdminService({
          presentations: database.agentPresentations,
          skillAssignments: database.characterSkillAssignments,
          characterVersions: database.characterVersions,
          skills: database.skills,
          authorizer: options.agentAdminAuthorizer,
        })
      : undefined);

  // U27 is disabled by default. A verified Ops admin authorizer is mandatory;
  // a consumer session, model or unconfigured deployment cannot install routes.
  const composedOperatorControl = options.appOptions?.operatorAgentControl ??
    (composedAgentAdmin && options.agentAdminAuthorizer
      ? createOperatorAgentControl({
          admin: composedAgentAdmin,
          authorizer: options.agentAdminAuthorizer,
        })
      : undefined);

  let app: ManagedNodeServer;
  try {
    app = appFactory({
      ...(options.appOptions ?? {}),
      ...(composedAgentAdmin ? { agentAdmin: composedAgentAdmin } : {}),
      ...(composedOperatorControl ? { operatorAgentControl: composedOperatorControl } : {}),
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


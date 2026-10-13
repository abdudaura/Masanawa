import { pathToFileURL } from "node:url";
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
import { createPostgresServiceDependency, createPgTeacherQueue, platformProductMigrationRoots, type Pool } from "@masanawa/postgres";
import { createRoomTeacherRuntime } from "./jobs/rooms/runtime.js";
import { createGeminiRoomAnswerModel } from "./jobs/rooms/gemini_room_model.js";
import {
  createWorkerApp,
  type WorkerAppOptions,
  type ReadinessCheck,
} from "./app.js";

export type ServiceSignal = "SIGINT" | "SIGTERM";

export interface ServiceProcess extends NodeSignalSource {
  exitCode: number | undefined;
  exit(code: number): never;
}

export interface ServiceDatabaseDependency {
  readonly readinessCheck: ReadinessCheck;
  readonly pool?: Pool;
  close(): Promise<void>;
}

export type ServiceDatabaseFactory = (
  env: Readonly<Record<string, string | undefined>>,
) => ServiceDatabaseDependency;

export type WorkerServiceConfig = NodeServiceRuntimeConfig;

export interface StartWorkerServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: ServiceProcess;
  readonly logger?: ServiceLifecycleLogger;
  readonly databaseFactory?: ServiceDatabaseFactory;
  readonly appFactory?: (options: WorkerAppOptions) => ManagedNodeServer;
  readonly appOptions?: Omit<WorkerAppOptions, "isDraining">;
}

export interface WorkerServiceRuntime {
  readonly config: WorkerServiceConfig;
  readonly address: string;
  readonly app: ManagedNodeServer;
  isDraining(): boolean;
  drain(): void;
  shutdown(reason?: ServiceSignal | "manual"): Promise<void>;
  disposeSignals(): void;
}

export function parseWorkerServiceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WorkerServiceConfig {
  return readNodeServiceRuntimeConfig(
    {
      ...env,
      HOST: env.MASANAWA_WORKER_HOST ?? env.HOST,
      PORT: env.MASANAWA_WORKER_PORT ?? env.PORT,
    },
    {
      port: 3001,
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

  return createPostgresServiceDependency({
    connectionString,
    applicationName: "masanawa-worker",
    migrationRoots:platformProductMigrationRoots(),
  });
}

export async function startWorkerService(
  options: StartWorkerServiceOptions = {},
): Promise<WorkerServiceRuntime> {
  const env = options.env ?? process.env;
  const config = parseWorkerServiceConfig(env);
  const processRef = options.processRef ?? (process as ServiceProcess);
  const drain = createDrainState();
  const databaseFactory =
    options.databaseFactory ?? createDefaultDatabaseDependency;
  const database = databaseFactory(env);
  const appFactory = options.appFactory ?? createWorkerApp;
  // The Rooms question worker is part of the product, not a hidden opt-in.
  // Lack of a pool or Gemini configuration is a startup error, not a silent
  // "disabled" customer feature that can accept questions without answers.
  let roomReview: ReturnType<typeof createRoomTeacherRuntime> | undefined;

  let app: ManagedNodeServer;
  try {
    if (!database.pool) throw new Error("rooms_teacher_postgres_pool_required");
    roomReview = createRoomTeacherRuntime({
      queue: createPgTeacherQueue(database.pool),
      model: createGeminiRoomAnswerModel({
        ...(env.MASANAWA_GEMINI_CREDENTIALS_JSON === undefined
          ? {} : {credentialsJson:env.MASANAWA_GEMINI_CREDENTIALS_JSON}),
        ...(env.MASANAWA_GEMINI_API_KEY === undefined && env.GEMINI_API_KEY === undefined
          ? {} : {apiKey:env.MASANAWA_GEMINI_API_KEY ?? env.GEMINI_API_KEY}),
        ...(env.MASANAWA_GEMINI_REPLY_MODELS === undefined
          ? {} : {models:env.MASANAWA_GEMINI_REPLY_MODELS}),
      }),
      workerId: env.MASANAWA_ROOMS_TEACHER_WORKER_ID ?? "rooms-ai-" + process.pid,
      enabled: () => !drain.isDraining(),
    });
    app = appFactory({
      ...(options.appOptions ?? {}),
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

  let lifecycle: Awaited<ReturnType<typeof startNodeService>>;
  try {
    lifecycle = await startNodeService({
      serviceName: "worker",
      server: app,
      config,
      signals: processRef,
      ...(options.logger ? { logger: options.logger } : {}),
      onDraining: drain.beginDraining,
      // Cancel the timer and await the current fenced outbox job before the
      // shared PostgreSQL pool shuts down; do not abandon in-flight claims.
      onAfterClose: async () => {
        await roomReview?.stop();
        await database.close();
      },
      onFatalShutdown: () => {
        processRef.exitCode = 1;
      },
    });
    roomReview?.start();
  } catch (error) {
    await roomReview?.stop();
    await database.close().catch(() => undefined);
    throw error;
  }

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
  void startWorkerService().catch(() => {
    process.exitCode = 1;
  });
}

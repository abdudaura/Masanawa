import { pathToFileURL } from "node:url";
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
  createWorkerApp,
  type WorkerAppOptions,
} from "./app.js";

export type ServiceSignal = "SIGINT" | "SIGTERM";

export interface ServiceProcess extends NodeSignalSource {
  exitCode: number | undefined;
  exit(code: number): never;
}

export type WorkerServiceConfig = NodeServiceRuntimeConfig;

export interface StartWorkerServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: ServiceProcess;
  readonly logger?: ServiceLifecycleLogger;
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

export async function startWorkerService(
  options: StartWorkerServiceOptions = {},
): Promise<WorkerServiceRuntime> {
  const config = parseWorkerServiceConfig(options.env);
  const processRef = options.processRef ?? (process as ServiceProcess);
  const drain = createDrainState();
  const appFactory = options.appFactory ?? createWorkerApp;
  const app = appFactory({
    ...(options.appOptions ?? {}),
    isDraining: drain.isDraining,
  });

  const lifecycle = await startNodeService({
    serviceName: "worker",
    server: app,
    config,
    signals: processRef,
    ...(options.logger ? { logger: options.logger } : {}),
    onDraining: drain.beginDraining,
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
  void startWorkerService().catch(() => {
    process.exitCode = 1;
  });
}

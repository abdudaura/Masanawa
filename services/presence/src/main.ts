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
  createPresenceApp,
  type PresenceAppOptions,
} from "./app.js";

export type PresenceServiceSignal = "SIGINT" | "SIGTERM";

export interface PresenceServiceProcess extends NodeSignalSource {
  exitCode: number | undefined;
  exit(code: number): never;
}

export type PresenceServiceConfig = NodeServiceRuntimeConfig;

export interface StartPresenceServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: PresenceServiceProcess;
  readonly logger?: ServiceLifecycleLogger;
  readonly appFactory?: (options: PresenceAppOptions) => ManagedNodeServer;
  readonly appOptions?: Omit<PresenceAppOptions, "isDraining">;
}

export interface PresenceServiceRuntime {
  readonly config: PresenceServiceConfig;
  readonly address: string;
  readonly app: ManagedNodeServer;
  isDraining(): boolean;
  drain(): void;
  shutdown(reason?: PresenceServiceSignal | "manual"): Promise<void>;
  disposeSignals(): void;
}

export function parsePresenceServiceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PresenceServiceConfig {
  return readNodeServiceRuntimeConfig(
    {
      ...env,
      HOST: env.MASANAWA_PRESENCE_HOST ?? env.HOST,
      PORT: env.MASANAWA_PRESENCE_PORT ?? env.PORT,
    },
    { port: 3002, shutdownTimeoutMs: 10_000 },
  );
}

export async function startPresenceService(
  options: StartPresenceServiceOptions = {},
): Promise<PresenceServiceRuntime> {
  const env = options.env ?? process.env;
  const config = parsePresenceServiceConfig(env);
  const processRef = options.processRef ?? (process as PresenceServiceProcess);
  const drain = createDrainState();
  const appFactory = options.appFactory ?? createPresenceApp;
  const app = appFactory({
    ...(options.appOptions ?? {}),
    isDraining: drain.isDraining,
  });
  const lifecycle = await startNodeService({
    serviceName: "presence",
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
    shutdown: (reason: PresenceServiceSignal | "manual" = "manual") =>
      lifecycle.stop(reason),
    disposeSignals: lifecycle.disposeSignals,
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectExecution()) {
  void startPresenceService().catch(() => {
    process.exitCode = 1;
  });
}

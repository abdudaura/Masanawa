import { pathToFileURL } from "node:url";
import {
  parseRuntimeEnvironment,
  readIntegerEnv,
  readOptionalEnv,
  type RuntimeEnvironment,
} from "@masanawa/contracts";
import {
  createGatewayApp,
  type GatewayAppOptions,
} from "./app.js";

export type ServiceSignal = "SIGINT" | "SIGTERM";

export interface ServiceProcess {
  exitCode: number | undefined;
  on(signal: ServiceSignal, listener: () => void): unknown;
  off(signal: ServiceSignal, listener: () => void): unknown;
  exit(code: number): never;
}

export interface LifecycleApp {
  listen(options: { readonly host: string; readonly port: number }): Promise<string>;
  close(): Promise<void>;
}

export interface ServiceLogEvent {
  readonly level: "info" | "error";
  readonly service: "gateway";
  readonly code:
    | "service_started"
    | "service_stopping"
    | "service_stopped"
    | "service_start_failed"
    | "service_stop_failed";
  readonly signal?: ServiceSignal | "manual";
  readonly errorType?: string;
}

export interface GatewayServiceConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly shutdownTimeoutMs: number;
}

export interface StartGatewayServiceOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly processRef?: ServiceProcess;
  readonly log?: (event: ServiceLogEvent) => void;
  readonly appFactory?: (options: GatewayAppOptions) => LifecycleApp;
  readonly appOptions?: Omit<GatewayAppOptions, "isDraining">;
}

export interface GatewayServiceRuntime {
  readonly config: GatewayServiceConfig;
  readonly address: string;
  readonly app: LifecycleApp;
  isDraining(): boolean;
  drain(): void;
  shutdown(reason?: ServiceSignal | "manual"): Promise<void>;
  disposeSignals(): void;
}

function defaultLog(event: ServiceLogEvent): void {
  const line = `${JSON.stringify(event)}\n`;
  if (event.level === "error") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

function safeErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function closeWithinTimeout(app: LifecycleApp, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("service shutdown timed out"));
    }, timeoutMs);
    timer.unref();

    void app.close().then(
      () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function parseGatewayServiceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GatewayServiceConfig {
  const host = readOptionalEnv(
    { HOST: env.MASANAWA_GATEWAY_HOST ?? env.HOST },
    "HOST",
    "0.0.0.0",
  );
  const port = readIntegerEnv(
    { PORT: env.MASANAWA_GATEWAY_PORT ?? env.PORT },
    "PORT",
    { defaultValue: 3000, min: 1, max: 65_535 },
  );
  const shutdownTimeoutMs = readIntegerEnv(
    { SHUTDOWN_TIMEOUT_MS: env.MASANAWA_SHUTDOWN_TIMEOUT_MS },
    "SHUTDOWN_TIMEOUT_MS",
    { defaultValue: 10_000, min: 100, max: 120_000 },
  );

  return Object.freeze({
    environment: parseRuntimeEnvironment(env.NODE_ENV),
    host,
    port,
    shutdownTimeoutMs,
  });
}

export async function startGatewayService(
  options: StartGatewayServiceOptions = {},
): Promise<GatewayServiceRuntime> {
  const config = parseGatewayServiceConfig(options.env);
  const processRef = options.processRef ?? (process as ServiceProcess);
  const log = options.log ?? defaultLog;
  let draining = false;

  const appFactory = options.appFactory ?? createGatewayApp;
  const app = appFactory({
    ...(options.appOptions ?? {}),
    isDraining: () => draining,
  });

  let address: string;
  try {
    address = await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    processRef.exitCode = 1;
    log({
      level: "error",
      service: "gateway",
      code: "service_start_failed",
      errorType: safeErrorType(error),
    });
    try {
      await app.close();
    } catch {
      // Startup failure is already authoritative; cleanup failure stays sanitized.
    }
    throw error;
  }

  let signalsDisposed = false;
  let shutdownPromise: Promise<void> | null = null;

  const drain = (): void => {
    draining = true;
  };

  const disposeSignals = (): void => {
    if (signalsDisposed) {
      return;
    }
    signalsDisposed = true;
    processRef.off("SIGTERM", onSigterm);
    processRef.off("SIGINT", onSigint);
  };

  const shutdown = (
    reason: ServiceSignal | "manual" = "manual",
  ): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    drain();
    log({
      level: "info",
      service: "gateway",
      code: "service_stopping",
      signal: reason,
    });

    shutdownPromise = (async () => {
      try {
        await closeWithinTimeout(app, config.shutdownTimeoutMs);
        log({
          level: "info",
          service: "gateway",
          code: "service_stopped",
          signal: reason,
        });
      } catch (error) {
        processRef.exitCode = 1;
        log({
          level: "error",
          service: "gateway",
          code: "service_stop_failed",
          signal: reason,
          errorType: safeErrorType(error),
        });
        throw error;
      } finally {
        disposeSignals();
      }
    })();
    return shutdownPromise;
  };

  const onSigterm = (): void => {
    void shutdown("SIGTERM").catch(() => {
      processRef.exit(1);
    });
  };
  const onSigint = (): void => {
    void shutdown("SIGINT").catch(() => {
      processRef.exit(1);
    });
  };

  processRef.on("SIGTERM", onSigterm);
  processRef.on("SIGINT", onSigint);

  log({
    level: "info",
    service: "gateway",
    code: "service_started",
  });

  return Object.freeze({
    config,
    address,
    app,
    isDraining: () => draining,
    drain,
    shutdown,
    disposeSignals,
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

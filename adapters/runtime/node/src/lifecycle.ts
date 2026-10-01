import { PlatformError } from "@masanawa/contracts";
import type { NodeServiceRuntimeConfig } from "./config.js";

export type ShutdownSignal = "SIGINT" | "SIGTERM";

export interface NodeSignalSource {
  once(signal: ShutdownSignal, listener: () => void): unknown;
  off(signal: ShutdownSignal, listener: () => void): unknown;
}

export interface ManagedNodeServer {
  listen(options: {
    readonly host: string;
    readonly port: number;
  }): Promise<string>;
  close(): Promise<void>;
  readonly server?: {
    closeAllConnections?(): void;
    closeIdleConnections?(): void;
  };
}

export interface ServiceLifecycleLogger {
  info(event: {
    readonly event: string;
    readonly service: string;
    readonly address?: string;
    readonly reason?: string;
  }): void;
  error(event: {
    readonly event: string;
    readonly service: string;
    readonly reason?: string;
  }): void;
}

export interface StartedNodeService {
  readonly address: string;
  stop(reason?: string): Promise<void>;
}

export interface StartNodeServiceInput {
  readonly serviceName: string;
  readonly server: ManagedNodeServer;
  readonly config: NodeServiceRuntimeConfig;
  readonly signals?: NodeSignalSource;
  readonly logger?: ServiceLifecycleLogger;
  readonly onDraining?: () => void;
  readonly onFatalShutdown?: () => void;
}

export interface DrainState {
  isDraining(): boolean;
  beginDraining(): void;
}

export function createDrainState(): DrainState {
  let draining = false;
  return Object.freeze({
    isDraining: () => draining,
    beginDraining: () => {
      draining = true;
    },
  });
}

function safeConsoleLogger(): ServiceLifecycleLogger {
  return {
    info(event) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    },
    error(event) {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    },
  };
}

function lifecycleError(
  code: string,
  message: string,
  serviceName: string,
): PlatformError {
  return new PlatformError({
    code,
    category: "unavailable",
    message,
    retryable: false,
    details: { service: serviceName },
  });
}

export async function startNodeService(
  input: StartNodeServiceInput,
): Promise<StartedNodeService> {
  const serviceName = input.serviceName.trim();
  if (!serviceName) {
    throw new TypeError("serviceName is required");
  }

  const logger = input.logger ?? safeConsoleLogger();
  const signals = input.signals ?? process;
  const onFatalShutdown =
    input.onFatalShutdown ??
    (() => {
      process.exitCode = 1;
    });

  let address: string;
  try {
    address = await input.server.listen({
      host: input.config.host,
      port: input.config.port,
    });
  } catch {
    throw lifecycleError(
      "service.start_failed",
      "Service failed to start",
      serviceName,
    );
  }

  let stopPromise: Promise<void> | undefined;

  const stopFromSignal = (signal: ShutdownSignal) => {
    void stop(`signal:${signal}`).catch(() => {
      logger.error({
        event: "service.shutdown_failed",
        service: serviceName,
        reason: `signal:${signal}`,
      });
      onFatalShutdown();
    });
  };
  const onSigint = () => stopFromSignal("SIGINT");
  const onSigterm = () => stopFromSignal("SIGTERM");

  const detachSignals = () => {
    signals.off("SIGINT", onSigint);
    signals.off("SIGTERM", onSigterm);
  };

  const stop = (reason = "requested"): Promise<void> => {
    if (stopPromise) {
      return stopPromise;
    }

    stopPromise = (async () => {
      detachSignals();
      try {
        input.onDraining?.();
      } catch {
        logger.error({
          event: "service.drain_hook_failed",
          service: serviceName,
          reason,
        });
      }

      logger.info({
        event: "service.shutdown_started",
        service: serviceName,
        reason,
      });

      let forced = false;
      const timeoutHandle = setTimeout(() => {
        forced = true;
        input.server.server?.closeIdleConnections?.();
        input.server.server?.closeAllConnections?.();
      }, input.config.shutdownTimeoutMs);
      timeoutHandle.unref?.();

      try {
        await input.server.close();
      } catch {
        throw lifecycleError(
          "service.shutdown_failed",
          "Service failed to shut down cleanly",
          serviceName,
        );
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (forced) {
        throw lifecycleError(
          "service.shutdown_timeout",
          "Service exceeded its graceful shutdown deadline",
          serviceName,
        );
      }

      logger.info({
        event: "service.shutdown_completed",
        service: serviceName,
        reason,
      });
    })();

    return stopPromise;
  };

  signals.once("SIGINT", onSigint);
  signals.once("SIGTERM", onSigterm);

  logger.info({
    event: "service.started",
    service: serviceName,
    address,
  });

  return Object.freeze({ address, stop });
}

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  createDrainState,
  readNodeServiceRuntimeConfig,
  startNodeService,
  type ManagedNodeServer,
  type ServiceLifecycleLogger,
} from "./index.js";

function logger(): ServiceLifecycleLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("Node service runtime", () => {
  it("parses bounded runtime configuration and rejects invalid deployment values", () => {
    expect(
      readNodeServiceRuntimeConfig(
        {
          NODE_ENV: "production",
          HOST: "127.0.0.1",
          PORT: "4100",
          MASANAWA_SHUTDOWN_TIMEOUT_MS: "2500",
        },
        { port: 3000 },
      ),
    ).toEqual({
      environment: "production",
      host: "127.0.0.1",
      port: 4100,
      shutdownTimeoutMs: 2500,
    });

    expect(() =>
      readNodeServiceRuntimeConfig({ PORT: "0" }, { port: 3000 }),
    ).toThrow(/PORT must be >= 1/);
    expect(() =>
      readNodeServiceRuntimeConfig(
        { MASANAWA_SHUTDOWN_TIMEOUT_MS: "secret" },
        { port: 3000 },
      ),
    ).toThrow(/Invalid integer environment variable/);
  });

  it("marks draining before closing and closes exactly once under racing stops", async () => {
    const signals = new EventEmitter();
    const drain = createDrainState();
    const close = vi.fn(async () => {
      expect(drain.isDraining()).toBe(true);
    });
    const server: ManagedNodeServer = {
      listen: vi.fn(async () => "http://127.0.0.1:3100"),
      close,
    };
    const runtime = await startNodeService({
      serviceName: "gateway",
      server,
      config: readNodeServiceRuntimeConfig({}, { port: 3100 }),
      signals,
      logger: logger(),
      onDraining: drain.beginDraining,
    });

    await Promise.all([runtime.stop("test-a"), runtime.stop("test-b")]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("handles process signals without exposing underlying shutdown errors", async () => {
    const signals = new EventEmitter();
    const fatal = vi.fn();
    const log = logger();
    const server: ManagedNodeServer = {
      listen: vi.fn(async () => "http://127.0.0.1:3200"),
      close: vi.fn(async () => {
        throw new Error("postgres://user:password@secret-host/db");
      }),
    };

    await startNodeService({
      serviceName: "worker",
      server,
      config: readNodeServiceRuntimeConfig({}, { port: 3200 }),
      signals,
      logger: log,
      onFatalShutdown: fatal,
    });
    signals.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));

    expect(fatal).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith({
      event: "service.shutdown_failed",
      service: "worker",
      reason: "signal:SIGTERM",
    });
    expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain(
      "secret-host",
    );
  });

  it("wraps startup failures in a stable safe error", async () => {
    const close = vi.fn(async () => undefined);
    const server: ManagedNodeServer = {
      listen: vi.fn(async () => {
        throw new Error("api-key=super-secret");
      }),
      close,
    };

    await expect(
      startNodeService({
        serviceName: "ops",
        server,
        config: readNodeServiceRuntimeConfig({}, { port: 3300 }),
        signals: new EventEmitter(),
        logger: logger(),
      }),
    ).rejects.toMatchObject({
      code: "service.start_failed",
      message: "Service failed to start",
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("forces lingering connections at the graceful shutdown deadline", async () => {
    vi.useFakeTimers();
    try {
      const signals = new EventEmitter();
      let releaseClose: (() => void) | undefined;
      const close = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseClose = resolve;
          }),
      );
      const closeAllConnections = vi.fn(() => {
        releaseClose?.();
      });
      const server: ManagedNodeServer = {
        listen: vi.fn(async () => "http://127.0.0.1:3400"),
        close,
        server: {
          closeAllConnections,
          closeIdleConnections: vi.fn(),
        },
      };
      const runtime = await startNodeService({
        serviceName: "gateway",
        server,
        config: readNodeServiceRuntimeConfig(
          { MASANAWA_SHUTDOWN_TIMEOUT_MS: "100" },
          { port: 3400 },
        ),
        signals,
        logger: logger(),
      });

      const stopping = runtime.stop("deadline-test");
      const rejection = expect(stopping).rejects.toMatchObject({
        code: "service.shutdown_timeout",
      });
      await vi.advanceTimersByTimeAsync(100);

      await rejection;
      expect(closeAllConnections).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

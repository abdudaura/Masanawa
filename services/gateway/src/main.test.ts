import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type {
  ManagedNodeServer,
  ServiceLifecycleLogger,
} from "@masanawa/node-runtime";
import {
  startGatewayService,
  type ServiceProcess,
} from "./main.js";

function processRef(): ServiceProcess {
  const emitter = new EventEmitter() as EventEmitter & {
    exitCode: number | undefined;
    exit(code: number): never;
  };
  emitter.exitCode = undefined;
  emitter.exit = (code: number): never => {
    emitter.exitCode = code;
    throw new Error(`unexpected forced exit ${code}`);
  };
  return emitter;
}

describe("gateway production lifecycle", () => {
  it("maps deployment config, exposes draining before close, and shuts down idempotently", async () => {
    let isDraining: (() => boolean) | undefined;
    const close = vi.fn(async () => {
      expect(isDraining?.()).toBe(true);
    });
    const app: ManagedNodeServer = {
      listen: vi.fn(async ({ host, port }) => `http://${host}:${port}`),
      close,
    };
    const log: ServiceLifecycleLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const runtime = await startGatewayService({
      env: {
        NODE_ENV: "production",
        HOST: "ignored.example",
        PORT: "9999",
        MASANAWA_GATEWAY_HOST: "127.0.0.1",
        MASANAWA_GATEWAY_PORT: "4100",
        MASANAWA_SHUTDOWN_TIMEOUT_MS: "1000",
      },
      processRef: processRef(),
      logger: log,
      appFactory: (options) => {
        isDraining = options.isDraining;
        return app;
      },
    });

    expect(runtime.config).toEqual({
      environment: "production",
      host: "127.0.0.1",
      port: 4100,
      shutdownTimeoutMs: 1000,
    });
    expect(runtime.isDraining()).toBe(false);

    await Promise.all([runtime.shutdown(), runtime.shutdown()]);
    expect(runtime.isDraining()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

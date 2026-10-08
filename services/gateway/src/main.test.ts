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
  it("composes schema readiness, drains before close, and releases the database once", async () => {
    let isDraining: (() => boolean) | undefined;
    let readinessChecks:
      | readonly {
          readonly name: string;
          check(): Promise<{ readonly ready: boolean; readonly reason?: string }>;
        }[]
      | undefined;

    const appClose = vi.fn(async () => {
      expect(isDraining?.()).toBe(true);
    });
    const databaseClose = vi.fn(async () => undefined);
    const databaseReadiness = {
      name: "database-schema",
      check: vi.fn(async () => ({ ready: true as const })),
    };
    const existingReadiness = {
      name: "runtime-registry",
      check: vi.fn(async () => ({ ready: true as const })),
    };
    const app: ManagedNodeServer = {
      listen: vi.fn(async ({ host, port }) => `http://${host}:${port}`),
      close: appClose,
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
      databaseFactory: () => ({
        readinessCheck: databaseReadiness,
        close: databaseClose,
      }),
      appOptions: {
        readinessChecks: [existingReadiness],
      },
      appFactory: (options) => {
        isDraining = options.isDraining;
        readinessChecks = options.readinessChecks;
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
    expect(readinessChecks?.map((check) => check.name)).toEqual([
      "runtime-registry",
      "database-schema",
    ]);

    await Promise.all([runtime.shutdown(), runtime.shutdown()]);

    expect(runtime.isDraining()).toBe(true);
    expect(appClose).toHaveBeenCalledTimes(1);
    expect(databaseClose).toHaveBeenCalledTimes(1);
    expect(appClose.mock.invocationCallOrder[0]).toBeLessThan(
      databaseClose.mock.invocationCallOrder[0]!,
    );
  });

  it("fails closed when billing is enabled without canonical auth and Flutterwave evidence", async () => {
    const databaseClose = vi.fn(async () => undefined);
    const appFactory = vi.fn(() => {
      throw new Error("app must not start");
    });

    await expect(startGatewayService({
      env: { FLUTTERWAVE_BILLS_ENABLED: "true" },
      processRef: processRef(),
      logger: { info: vi.fn(), error: vi.fn() },
      databaseFactory: () => ({
        readinessCheck: {
          name: "database-schema",
          check: async () => ({ ready: true }),
        },
        close: databaseClose,
      }),
      appFactory,
    })).rejects.toThrow(
      "Billing is enabled but canonical customer auth, NGN wallet, or Flutterwave configuration is incomplete",
    );

    expect(appFactory).not.toHaveBeenCalled();
    expect(databaseClose).toHaveBeenCalledTimes(1);
  });

  it("does not require or expose a database URL when an injected dependency is used", async () => {
    const app: ManagedNodeServer = {
      listen: vi.fn(async () => "http://127.0.0.1:3000"),
      close: vi.fn(async () => undefined),
    };

    const runtime = await startGatewayService({
      env: {},
      processRef: processRef(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      databaseFactory: () => ({
        readinessCheck: {
          name: "database-schema",
          check: async () => ({ ready: true }),
        },
        close: async () => undefined,
      }),
      appFactory: () => app,
    });

    expect(runtime.config).not.toHaveProperty("databaseUrl");
    expect(runtime.config).not.toHaveProperty("connectionString");
    await runtime.shutdown();
  });
});

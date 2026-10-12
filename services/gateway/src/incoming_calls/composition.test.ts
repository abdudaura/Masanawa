import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { startGatewayService, type ServiceProcess } from "../main.js";
import type { IncomingCallService } from "./service.js";
it("drains incoming recovery before closing its database", async () => {
  let finish!: () => void;
  const recover = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const incomingCalls = { recover } as unknown as IncomingCallService;
  const close = vi.fn(async () => undefined);
  const processRef = new EventEmitter() as EventEmitter & ServiceProcess;
  processRef.exit = (() => {
    throw new Error("forced exit");
  }) as ServiceProcess["exit"];
  let composed: IncomingCallService | undefined;
  const runtime = await startGatewayService({
    env: { NODE_ENV: "test", MASANAWA_GATEWAY_PORT: "4100" },
    processRef,
    databaseFactory: () => ({
      readinessCheck: { name: "db", check: async () => ({ ready: true }) },
      close,
    }),
    appOptions: { incomingCalls },
    appFactory: (options) => {
      composed = options.incomingCalls;
      return {
        listen: async () => "http://127.0.0.1:4100",
        close: async () => undefined,
      };
    },
  });
  expect(composed).toBe(incomingCalls);
  expect(recover).toHaveBeenCalledTimes(1);
  const shutdown = runtime.shutdown();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(close).not.toHaveBeenCalled();
  finish();
  await shutdown;
  expect(close).toHaveBeenCalledTimes(1);
});

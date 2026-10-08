import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startHumanVoiceGarbageCollector, installHumanVoiceModule } from "./runtime.js";
import Fastify from "fastify";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("C04 lifecycle-bound private voice reconciliation", () => {
  it("sweeps on startup and on schedule, then stops without retaining timers", async () => {
    const collectGarbage = vi.fn(async (_batch: number) => ({ deleted: 0, failed: 0 }));
    const task = startHumanVoiceGarbageCollector({ collectGarbage }, {
      intervalMs: 10_000, batchSize: 7,
    });
    await task.sweep();
    expect(collectGarbage).toHaveBeenCalledTimes(1);
    expect(collectGarbage).toHaveBeenCalledWith(7);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(collectGarbage).toHaveBeenCalledTimes(3);
    await task.stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(collectGarbage).toHaveBeenCalledTimes(3);
  });

  it("does not overlap an in-flight S3/SQL GC sweep across timer ticks", async () => {
    let finish!: () => void;
    const blocked = new Promise<void>(resolve => { finish = resolve; });
    const collectGarbage = vi.fn(async () => { await blocked; return {deleted: 0, failed: 0}; });
    const task = startHumanVoiceGarbageCollector({collectGarbage}, {intervalMs:10_000});
    await Promise.resolve();
    expect(collectGarbage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(collectGarbage).toHaveBeenCalledTimes(1);
    const stopping = task.stop();
    finish();
    await stopping;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(collectGarbage).toHaveBeenCalledTimes(1);
  });

  it("recovers from cleanup failure without exposing internal key/error details", async () => {
    const onFailure = vi.fn();
    let attempts = 0;
    const collectGarbage = vi.fn(async () => {
      if (++attempts === 1) throw Error("private-bucket/object-key-secret");
      return {deleted:0,failed:0};
    });
    const task = startHumanVoiceGarbageCollector({collectGarbage}, {
      intervalMs:10_000,onFailure,
    });
    await task.sweep();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(collectGarbage).toHaveBeenCalledTimes(2);
    await task.stop();
  });

  it("rejects unsafe reconciliation cadence/batch and partial private bucket settings", async () => {
    expect(() => startHumanVoiceGarbageCollector({collectGarbage:vi.fn()}, {
      intervalMs:100,batchSize:200,
    })).toThrow(RangeError);
    const app = Fastify();
    expect(() => installHumanVoiceModule(app,{
      pool: {} as never,
      authorizer: {authorize:vi.fn()} as never,
      privateS3: {
        endpoint:"https://storage.example.invalid/",region:"us-east-1",
        bucket:"private-audio",accessKey:"",secretKey:"missing",
      },
    })).toThrow("Complete private human voice S3 configuration");
    await app.close();
  });
});

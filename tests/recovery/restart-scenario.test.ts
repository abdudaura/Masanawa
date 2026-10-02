import { describe, expect, it } from "vitest";
import {
  InjectedCrash,
  createFaultInjector,
  runRestartScenario,
} from "../../test/support/fault-injection.js";

describe("restart scenarios", () => {
  it("replays a durable receipt after a crash without duplicating the side effect", async () => {
    const faults = createFaultInjector({ "after-side-effect-before-ack": 1 });
    const durable = {
      receipt: null as string | null,
      sideEffectCount: 0,
    };
    const generations: number[] = [];

    const result = await runRestartScenario({
      maxRestarts: 2,
      createRuntime(generation) {
        generations.push(generation);
        return { generation };
      },
      run(runtime) {
        if (durable.receipt !== null) {
          return {
            generation: runtime.generation,
            receipt: durable.receipt,
            replayed: true,
          };
        }

        durable.sideEffectCount += 1;
        durable.receipt = "external-receipt-1";
        faults.checkpoint("after-side-effect-before-ack");

        return {
          generation: runtime.generation,
          receipt: durable.receipt,
          replayed: false,
        };
      },
      dispose() {},
    });

    expect(result).toEqual({
      generation: 1,
      receipt: "external-receipt-1",
      replayed: true,
    });
    expect(generations).toEqual([0, 1]);
    expect(durable.sideEffectCount).toBe(1);
    expect(faults.hits("after-side-effect-before-ack")).toBe(1);
  });

  it("does not restart ordinary permanent failures", async () => {
    let starts = 0;

    await expect(
      runRestartScenario({
        maxRestarts: 3,
        createRuntime() {
          starts += 1;
          return {};
        },
        run() {
          throw new Error("permanent");
        },
        dispose() {},
      }),
    ).rejects.toThrow("permanent");

    expect(starts).toBe(1);
  });

  it("bounds an injected crash loop", async () => {
    const faults = createFaultInjector({ crash: 3 });
    const generations: number[] = [];

    await expect(
      runRestartScenario({
        maxRestarts: 1,
        createRuntime(generation) {
          generations.push(generation);
          return {};
        },
        run() {
          faults.checkpoint("crash");
          return "unreachable";
        },
        dispose() {},
      }),
    ).rejects.toMatchObject({
      name: "InjectedCrash",
      faultPoint: "crash",
    });

    expect(generations).toEqual([0, 1]);
    expect(faults.hits("crash")).toBe(2);
    expect(faults.remaining("crash")).toBe(1);
  });

  it("preserves both runtime and cleanup failures", async () => {
    const failure = new InjectedCrash("after-write");
    const cleanupFailure = new Error("cleanup failed");

    await expect(
      runRestartScenario({
        maxRestarts: 1,
        createRuntime: () => ({}),
        run() {
          throw failure;
        },
        dispose() {
          throw cleanupFailure;
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "AggregateError",
        errors: [failure, cleanupFailure],
      }),
    );
  });
});

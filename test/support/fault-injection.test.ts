import { describe, expect, it } from "vitest";
import {
  InjectedCrash,
  createFaultInjector,
  runRestartScenario,
} from "./fault-injection.js";

describe("deterministic fault injection", () => {
  it("preserves the established count-based checkpoint contract", () => {
    const faults = createFaultInjector({
      "after-commit": 2,
      "before-ack": 1,
    });

    expect(() => faults.checkpoint("after-commit")).toThrowError(InjectedCrash);
    expect(() => faults.checkpoint("after-commit")).toThrowError(InjectedCrash);
    faults.checkpoint("after-commit");

    expect(faults.hits("after-commit")).toBe(3);
    expect(faults.remaining("after-commit")).toBe(0);

    expect(() => faults.checkpoint("before-ack")).toThrowError(InjectedCrash);
    expect(faults.hits("before-ack")).toBe(1);
  });

  it("rejects invalid and normalized-duplicate plans", () => {
    expect(() => createFaultInjector({ "": 1 })).toThrow(/required/u);
    expect(() => createFaultInjector({ crash: -1 })).toThrow(
      /non-negative safe integer/u,
    );
    expect(() =>
      createFaultInjector({ crash: 1, " crash ": 1 }),
    ).toThrow(/duplicated/u);
  });
});

describe("restart scenarios", () => {
  it("recreates ephemeral runtime while caller-owned durable state survives", async () => {
    const faults = createFaultInjector({ "after-durable-write": 1 });
    const durable = { writes: 0 };
    const created: number[] = [];
    const disposed: number[] = [];

    const result = await runRestartScenario({
      maxRestarts: 2,
      createRuntime(generation) {
        created.push(generation);
        return { generation };
      },
      run(runtime) {
        durable.writes += 1;
        faults.checkpoint("after-durable-write");
        return { generation: runtime.generation, writes: durable.writes };
      },
      dispose(runtime) {
        disposed.push(runtime.generation);
      },
    });

    expect(result).toEqual({ generation: 1, writes: 2 });
    expect(created).toEqual([0, 1]);
    expect(disposed).toEqual([0, 1]);
    expect(durable.writes).toBe(2);
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

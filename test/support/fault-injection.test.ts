import { describe, expect, it } from "vitest";
import {
  FaultInjectionError,
  createFaultInjector,
  runRestartScenario,
} from "./fault-injection.js";

describe("deterministic fault injection", () => {
  it("fires exactly on configured occurrences and consumes each fault once", () => {
    const injector = createFaultInjector([
      { checkpoint: "after-commit", occurrences: [2, 4] },
    ]);

    injector.hit("after-commit");

    expect(() => injector.hit("after-commit")).toThrowError(
      new FaultInjectionError("after-commit", 2),
    );
    expect(injector.count("after-commit")).toBe(2);
    expect(injector.remaining("after-commit")).toEqual([4]);

    injector.hit("after-commit");

    expect(() => injector.hit("after-commit")).toThrowError(
      new FaultInjectionError("after-commit", 4),
    );
    expect(injector.remaining("after-commit")).toEqual([]);

    injector.hit("after-commit");
    expect(injector.count("after-commit")).toBe(5);
  });

  it("keeps independent occurrence counters per checkpoint", () => {
    const injector = createFaultInjector([
      { checkpoint: "after-write", occurrences: [1] },
      { checkpoint: "before-ack", occurrences: [2] },
    ]);

    expect(() => injector.hit("after-write")).toThrow(FaultInjectionError);
    injector.hit("before-ack");
    expect(() => injector.hit("before-ack")).toThrow(FaultInjectionError);

    expect(injector.count("after-write")).toBe(1);
    expect(injector.count("before-ack")).toBe(2);
  });

  it("rejects ambiguous or invalid fault plans", () => {
    expect(() =>
      createFaultInjector([
        { checkpoint: "write", occurrences: [1] },
        { checkpoint: " write ", occurrences: [2] },
      ]),
    ).toThrow(/duplicated/u);

    expect(() =>
      createFaultInjector([{ checkpoint: "write", occurrences: [0] }]),
    ).toThrow(/positive safe integer/u);

    expect(() =>
      createFaultInjector([{ checkpoint: "write", occurrences: [1, 1] }]),
    ).toThrow(/duplicated/u);
  });
});

describe("restart scenarios", () => {
  it("recreates only ephemeral runtime while durable state survives an injected crash", async () => {
    const injector = createFaultInjector([
      { checkpoint: "after-durable-write", occurrences: [1] },
    ]);
    const durableState = { writes: 0 };
    const created: number[] = [];
    const disposed: number[] = [];

    const result = await runRestartScenario({
      maxRestarts: 2,
      createRuntime(generation) {
        created.push(generation);
        return { generation };
      },
      run(runtime) {
        durableState.writes += 1;
        injector.hit("after-durable-write");
        return {
          generation: runtime.generation,
          writes: durableState.writes,
        };
      },
      dispose(runtime) {
        disposed.push(runtime.generation);
      },
    });

    expect(result).toEqual({ generation: 1, writes: 2 });
    expect(durableState.writes).toBe(2);
    expect(created).toEqual([0, 1]);
    expect(disposed).toEqual([0, 1]);
  });

  it("does not restart failures that are not explicitly restartable", async () => {
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

  it("bounds restart attempts even when injected faults continue", async () => {
    const injector = createFaultInjector([
      { checkpoint: "crash-loop", occurrences: [1, 2, 3] },
    ]);
    const generations: number[] = [];

    await expect(
      runRestartScenario({
        maxRestarts: 1,
        createRuntime(generation) {
          generations.push(generation);
          return { generation };
        },
        run() {
          injector.hit("crash-loop");
          return "unreachable";
        },
        dispose() {},
      }),
    ).rejects.toMatchObject({
      name: "FaultInjectionError",
      checkpoint: "crash-loop",
      occurrence: 2,
    });

    expect(generations).toEqual([0, 1]);
    expect(injector.remaining("crash-loop")).toEqual([3]);
  });

  it("preserves both runtime and cleanup failures", async () => {
    const failure = new FaultInjectionError("after-write", 1);
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

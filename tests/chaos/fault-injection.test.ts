import { describe, expect, it } from "vitest";
import {
  InjectedCrash,
  createFaultInjector,
} from "../../test/support/fault-injection.js";

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

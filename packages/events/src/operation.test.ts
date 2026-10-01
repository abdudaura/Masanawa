import { describe, expect, it } from "vitest";
import {
  assertOperationTransition,
  canTransitionOperation,
  isAmbiguousOperationState,
} from "./operation.js";

describe("Operation lifecycle", () => {
  it("does not allow accepted work to return to dispatch", () => {
    expect(canTransitionOperation("accepted", "dispatching")).toBe(false);
    expect(() => assertOperationTransition("accepted", "dispatching")).toThrow(
      /cannot transition/,
    );
  });

  it("forces an unknown dispatch outcome through reconciliation", () => {
    expect(canTransitionOperation("unknown", "dispatching")).toBe(false);
    expect(canTransitionOperation("unknown", "succeeded")).toBe(false);
    expect(canTransitionOperation("unknown", "reconciling")).toBe(true);
    expect(isAmbiguousOperationState("unknown")).toBe(true);
  });

  it("allows pre-dispatch rejection to terminate safely", () => {
    expect(canTransitionOperation("authorized", "rejected")).toBe(true);
  });
});

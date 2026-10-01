import { describe, expect, it } from "vitest";
import {
  assertReconciliationTransition,
  canTransitionReconciliation,
  isActiveReconciliationStatus,
} from "./reconciliation.js";

describe("reconciliation lifecycle", () => {
  it("permits active recovery transitions and makes resolved terminal", () => {
    expect(canTransitionReconciliation("open", "checking")).toBe(true);
    expect(canTransitionReconciliation("checking", "needs-attention")).toBe(true);
    expect(canTransitionReconciliation("needs-attention", "resolved")).toBe(true);
    expect(canTransitionReconciliation("resolved", "checking")).toBe(false);
    expect(isActiveReconciliationStatus("resolved")).toBe(false);
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() => assertReconciliationTransition("resolved", "open")).toThrow(
      "Reconciliation case cannot transition from resolved to open",
    );
  });
});

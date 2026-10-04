import { describe, expect, it } from "vitest";
import {
  assertWorkflowCompensationTransition,
  canTransitionWorkflowCompensation,
  isImmediatelyCancellableTaskState,
  terminalWorkflowControlState,
} from "./index.js";

describe("workflow control semantics", () => {
  it("derives terminal control state from cancel versus supersede", () => {
    expect(terminalWorkflowControlState("cancel")).toBe("cancelled");
    expect(terminalWorkflowControlState("supersede")).toBe("superseded");
  });

  it("only immediately cancels work that has not retained a running lease", () => {
    for (const state of ["pending", "ready", "waiting"]) {
      expect(isImmediatelyCancellableTaskState(state)).toBe(true);
    }
    for (const state of ["running", "completed", "failed", "cancelled"]) {
      expect(isImmediatelyCancellableTaskState(state)).toBe(false);
    }
  });

  it("keeps compensation history forward-only", () => {
    expect(canTransitionWorkflowCompensation("planned", "running")).toBe(true);
    expect(canTransitionWorkflowCompensation("running", "succeeded")).toBe(true);
    expect(() =>
      assertWorkflowCompensationTransition("succeeded", "running"),
    ).toThrow(/illegal workflow compensation transition/u);
  });
});

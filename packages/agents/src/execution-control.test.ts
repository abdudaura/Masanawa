import { describe, expect, it, vi } from "vitest";
import {
  createAgentExecutionControl,
} from "./execution-control.js";

describe("Agent Harness execution control", () => {
  it("stops once and preserves the first terminal reason", () => {
    const control = createAgentExecutionControl();
    const aborts = vi.fn();
    control.signal.addEventListener("abort", aborts);

    expect(
      control.stop({
        reason: "budget-exhausted",
        detail: "token ceiling reached",
      }),
    ).toEqual({
      stopped: true,
      reason: "budget-exhausted",
      detail: "token ceiling reached",
    });

    expect(
      control.stop({
        reason: "shutdown",
        detail: "later stop must not replace first reason",
      }),
    ).toEqual({
      stopped: true,
      reason: "budget-exhausted",
      detail: "token ceiling reached",
    });

    expect(control.signal.aborted).toBe(true);
    expect(aborts).toHaveBeenCalledTimes(1);
  });

  it("throws a stable typed failure after stop", () => {
    const control = createAgentExecutionControl();
    control.stop({ reason: "lease-lost" });

    expect(() => control.throwIfStopped()).toThrow(
      "Agent execution has stopped",
    );

    try {
      control.throwIfStopped();
    } catch (error) {
      expect(error).toMatchObject({
        code: "agents.execution_stopped",
        details: { reason: "lease-lost" },
      });
    }
  });

  it("propagates the exact parent stop reason and detail to a child", () => {
    const parent = createAgentExecutionControl();
    const child = createAgentExecutionControl({ parent });
    const childAborts = vi.fn();
    child.signal.addEventListener("abort", childAborts);

    parent.stop({
      reason: "authority-revoked",
      detail: "policy revision changed",
    });

    expect(child.snapshot()).toEqual({
      stopped: true,
      reason: "authority-revoked",
      detail: "policy revision changed",
    });
    expect(child.signal.aborted).toBe(true);
    expect(childAborts).toHaveBeenCalledTimes(1);
  });

  it("child-local cancellation does not abort parent or sibling", () => {
    const parent = createAgentExecutionControl();
    const childA = createAgentExecutionControl({ parent });
    const childB = createAgentExecutionControl({ parent });

    childA.stop({ reason: "deadline" });

    expect(childA.signal.aborted).toBe(true);
    expect(parent.signal.aborted).toBe(false);
    expect(childB.signal.aborted).toBe(false);
  });

  it("creates an immediately stopped child from an already stopped parent", () => {
    const parent = createAgentExecutionControl();
    parent.stop({
      reason: "user-cancelled",
      detail: "owner stopped the task",
    });

    const child = createAgentExecutionControl({ parent });
    expect(child.signal.aborted).toBe(true);
    expect(child.snapshot()).toEqual({
      stopped: true,
      reason: "user-cancelled",
      detail: "owner stopped the task",
    });
  });

  it("cleans up parent propagation when the child stops first", () => {
    const parent = createAgentExecutionControl();
    const child = createAgentExecutionControl({ parent });
    child.stop({ reason: "deadline" });

    parent.stop({ reason: "shutdown" });

    expect(child.snapshot()).toEqual({
      stopped: true,
      reason: "deadline",
      detail: null,
    });
  });

  it("bounds optional stop detail", () => {
    const control = createAgentExecutionControl();

    expect(() =>
      control.stop({
        reason: "shutdown",
        detail: "x".repeat(501),
      }),
    ).toThrow("at most 500 characters");

    expect(control.signal.aborted).toBe(false);
  });
});

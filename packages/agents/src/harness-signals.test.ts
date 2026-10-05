import { describe, expect, it, vi } from "vitest";
import { createAgentExecutionControl } from "./execution-control.js";
import {
  combineAbortSignals,
  routeHarnessExecutionSignal,
} from "./harness-signals.js";

describe("Harness execution signal routing", () => {
  it("durable Task-backed execution ignores request disconnect abort", () => {
    const executionControl = createAgentExecutionControl();
    const requestController = new AbortController();
    const routed = routeHarnessExecutionSignal({
      taskId: "task_1",
      workflowRunId: null,
      requestSignal: requestController.signal,
      executionControl,
    });

    requestController.abort();

    expect(routed.signal.aborted).toBe(false);
    expect(executionControl.signal.aborted).toBe(false);

    executionControl.stop({ reason: "user-cancelled" });
    expect(routed.signal.aborted).toBe(true);
  });

  it("durable WorkflowRun-backed execution ignores request disconnect abort", () => {
    const executionControl = createAgentExecutionControl();
    const requestController = new AbortController();
    const routed = routeHarnessExecutionSignal({
      taskId: null,
      workflowRunId: "workflow-run_1",
      requestSignal: requestController.signal,
      executionControl,
    });

    requestController.abort();
    expect(routed.signal.aborted).toBe(false);

    executionControl.stop({ reason: "lease-lost" });
    expect(routed.signal.aborted).toBe(true);
  });

  it("ephemeral chat combines request and execution-control aborts", () => {
    const executionControl = createAgentExecutionControl();
    const requestController = new AbortController();
    const routed = routeHarnessExecutionSignal({
      taskId: null,
      workflowRunId: null,
      requestSignal: requestController.signal,
      executionControl,
    });

    requestController.abort();

    expect(routed.signal.aborted).toBe(true);
    expect(executionControl.signal.aborted).toBe(false);
  });

  it("ephemeral chat also aborts when server execution control stops", () => {
    const executionControl = createAgentExecutionControl();
    const requestController = new AbortController();
    const routed = routeHarnessExecutionSignal({
      taskId: null,
      workflowRunId: null,
      requestSignal: requestController.signal,
      executionControl,
    });

    executionControl.stop({ reason: "deadline" });

    expect(routed.signal.aborted).toBe(true);
    expect(requestController.signal.aborted).toBe(false);
  });

  it("combines already-aborted signals immediately", () => {
    const first = new AbortController();
    const second = new AbortController();
    first.abort();

    const combined = combineAbortSignals([
      first.signal,
      second.signal,
    ]);

    expect(combined.signal.aborted).toBe(true);
  });

  it("dispose removes listeners without aborting the combined signal", () => {
    const first = new AbortController();
    const second = new AbortController();
    const combined = combineAbortSignals([
      first.signal,
      second.signal,
    ]);
    const aborts = vi.fn();
    combined.signal.addEventListener("abort", aborts);

    combined.dispose();
    first.abort();
    second.abort();

    expect(combined.signal.aborted).toBe(false);
    expect(aborts).not.toHaveBeenCalled();
  });

  it("supports ephemeral execution with no request signal", () => {
    const executionControl = createAgentExecutionControl();
    const routed = routeHarnessExecutionSignal({
      taskId: null,
      workflowRunId: null,
      executionControl,
    });

    expect(routed.signal.aborted).toBe(false);
    executionControl.stop({ reason: "shutdown" });
    expect(routed.signal.aborted).toBe(true);
  });
});

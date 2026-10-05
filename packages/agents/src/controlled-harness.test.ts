import { describe, expect, it, vi } from "vitest";
import type {
  AgentHarness,
  AgentHarnessRequest,
  AgentHarnessResult,
} from "./harness.js";
import { createAgentExecutionControl } from "./execution-control.js";
import { createExecutionControlledAgentHarness } from "./controlled-harness.js";

function request(overrides: Partial<AgentHarnessRequest> = {}): AgentHarnessRequest {
  return {
    agentRunId: "agent-run_00000000-0000-4000-8000-000000000001" as never,
    characterSessionId:
      "character-session_00000000-0000-4000-8000-000000000002" as never,
    characterVersionId:
      "character-version_00000000-0000-4000-8000-000000000003" as never,
    skillVersionIds: [],
    presentation: {} as never,
    input: {} as never,
    taskId: null,
    workflowRunId: null,
    ...overrides,
  };
}

function result(): AgentHarnessResult {
  return {
    reply: "ok",
    parts: [],
    usage: undefined,
    taskId: null,
    workflowRunId: null,
  } as unknown as AgentHarnessResult;
}

describe("execution-controlled AgentHarness", () => {
  it("routes durable execution only through server execution control", async () => {
    const receivedSignals: AbortSignal[] = [];
    const inner: AgentHarness = {
      async execute(input) {
        if (input.signal) receivedSignals.push(input.signal);
        return {
          ...result(),
          taskId: input.taskId,
          workflowRunId: input.workflowRunId,
        };
      },
    };
    const wrapper = createExecutionControlledAgentHarness(inner);
    const executionControl = createAgentExecutionControl();
    const requestController = new AbortController();

    const promise = wrapper.execute({
      ...request({
        taskId: "task_00000000-0000-4000-8000-000000000004" as never,
        signal: requestController.signal,
      }),
      executionControl,
    });
    requestController.abort();
    const resolved = await promise;

    expect(resolved.taskId).not.toBeNull();
    expect(receivedSignals).toHaveLength(1);
    expect(receivedSignals[0]).toBe(executionControl.signal);
    expect(receivedSignals[0]!.aborted).toBe(false);
  });

  it("ephemeral chat aborts from the request signal", async () => {
    const requestController = new AbortController();
    const inner: AgentHarness = {
      async execute(input) {
        requestController.abort();
        expect(input.signal?.aborted).toBe(true);
        return result();
      },
    };
    const wrapper = createExecutionControlledAgentHarness(inner);

    await expect(wrapper.execute({
      ...request({ signal: requestController.signal }),
      executionControl: createAgentExecutionControl(),
    })).rejects.toMatchObject({
      code: "agents.request_aborted",
    });
  });

  it("server execution stop prevents a stale durable result from being accepted", async () => {
    const executionControl = createAgentExecutionControl();
    const inner: AgentHarness = {
      async execute(input) {
        executionControl.stop({
          reason: "lease-lost",
          detail: "workflow task fence changed",
        });
        expect(input.signal?.aborted).toBe(true);
        return {
          ...result(),
          workflowRunId: input.workflowRunId,
        };
      },
    };
    const wrapper = createExecutionControlledAgentHarness(inner);

    await expect(wrapper.execute({
      ...request({
        workflowRunId:
          "workflow-run_00000000-0000-4000-8000-000000000005" as never,
      }),
      executionControl,
    })).rejects.toMatchObject({
      code: "agents.execution_stopped",
      details: { reason: "lease-lost" },
    });
  });

  it("does not call the inner harness when execution was already stopped", async () => {
    const execute = vi.fn(async () => result());
    const wrapper = createExecutionControlledAgentHarness({
      execute,
    });
    const executionControl = createAgentExecutionControl();
    executionControl.stop({ reason: "authority-revoked" });

    await expect(wrapper.execute({
      ...request(),
      executionControl,
    })).rejects.toMatchObject({
      code: "agents.execution_stopped",
    });

    expect(execute).not.toHaveBeenCalled();
  });
});

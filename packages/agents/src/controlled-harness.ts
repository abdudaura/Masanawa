import { PlatformError } from "@masanawa/contracts";
import type {
  AgentHarness,
  AgentHarnessRequest,
  AgentHarnessResult,
} from "./harness.js";
import type { AgentExecutionControl } from "./execution-control.js";
import { routeHarnessExecutionSignal } from "./harness-signals.js";

export interface ControlledAgentHarnessRequest extends AgentHarnessRequest {
  readonly executionControl: AgentExecutionControl;
}

function requestAborted(): PlatformError {
  return new PlatformError({
    code: "agents.request_aborted",
    category: "conflict",
    message: "Ephemeral Agent request was aborted",
    retryable: false,
  });
}

export function createExecutionControlledAgentHarness(
  inner: AgentHarness,
): Readonly<{
  execute(input: ControlledAgentHarnessRequest): Promise<AgentHarnessResult>;
}> {
  return Object.freeze({
    async execute(input) {
      input.executionControl.throwIfStopped();

      const routed = routeHarnessExecutionSignal({
        taskId: input.taskId,
        workflowRunId: input.workflowRunId,
        ...(input.signal ? { requestSignal: input.signal } : {}),
        executionControl: input.executionControl,
      });
      const durable =
        input.taskId !== null || input.workflowRunId !== null;

      const {
        executionControl: _executionControl,
        signal: _requestSignal,
        ...request
      } = input;

      try {
        const result = await inner.execute({
          ...request,
          signal: routed.signal,
        });

        input.executionControl.throwIfStopped();

        if (!durable && routed.signal.aborted) {
          throw requestAborted();
        }

        return result;
      } finally {
        routed.dispose();
      }
    },
  });
}

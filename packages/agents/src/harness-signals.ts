import type { AgentExecutionControl } from "./execution-control.js";

export interface HarnessExecutionSignalInput {
  readonly taskId: string | null;
  readonly workflowRunId: string | null;
  readonly requestSignal?: AbortSignal;
  readonly executionControl: AgentExecutionControl;
}

export interface CombinedAbortSignal {
  readonly signal: AbortSignal;
  dispose(): void;
}

export function combineAbortSignals(
  signals: readonly AbortSignal[],
): CombinedAbortSignal {
  if (signals.length === 0) {
    const controller = new AbortController();
    return Object.freeze({
      signal: controller.signal,
      dispose() {},
    });
  }

  const controller = new AbortController();
  let disposed = false;
  const listeners = new Map<AbortSignal, () => void>();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    for (const [signal, listener] of listeners) {
      signal.removeEventListener("abort", listener);
    }
    listeners.clear();
  };

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
    cleanup();
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }
    const listener = () => abort();
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return Object.freeze({
    signal: controller.signal,
    dispose: cleanup,
  });
}

export function routeHarnessExecutionSignal(
  input: HarnessExecutionSignalInput,
): CombinedAbortSignal {
  const durable =
    input.taskId !== null || input.workflowRunId !== null;

  if (durable) {
    return Object.freeze({
      signal: input.executionControl.signal,
      dispose() {},
    });
  }

  const signals = input.requestSignal
    ? [input.executionControl.signal, input.requestSignal]
    : [input.executionControl.signal];

  return combineAbortSignals(signals);
}

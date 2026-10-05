import { PlatformError } from "@masanawa/contracts";

export const agentExecutionStopReasons = [
  "user-cancelled",
  "budget-exhausted",
  "lease-lost",
  "authority-revoked",
  "deadline",
  "shutdown",
] as const;

export type AgentExecutionStopReason =
  (typeof agentExecutionStopReasons)[number];

export interface AgentExecutionStopSnapshot {
  readonly stopped: boolean;
  readonly reason: AgentExecutionStopReason | null;
  readonly detail: string | null;
}

export interface AgentExecutionControl {
  readonly signal: AbortSignal;
  snapshot(): AgentExecutionStopSnapshot;
  stop(input: {
    readonly reason: AgentExecutionStopReason;
    readonly detail?: string | null;
  }): AgentExecutionStopSnapshot;
  throwIfStopped(): void;
}

function normalizeDetail(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("Agent execution stop detail must be a string");
  }
  const detail = value.trim();
  if (detail.length === 0) return null;
  if (detail.length > 500) {
    throw new RangeError(
      "Agent execution stop detail must be at most 500 characters",
    );
  }
  return detail;
}

function assertReason(
  value: AgentExecutionStopReason,
): AgentExecutionStopReason {
  if (!agentExecutionStopReasons.includes(value)) {
    throw new TypeError("Agent execution stop reason is invalid");
  }
  return value;
}

function stoppedError(snapshot: AgentExecutionStopSnapshot): PlatformError {
  return new PlatformError({
    code: "agents.execution_stopped",
    category: "conflict",
    message: "Agent execution has stopped",
    retryable: false,
    details: {
      reason: snapshot.reason,
      ...(snapshot.detail ? { detail: snapshot.detail } : {}),
    },
  });
}

export function createAgentExecutionControl(input?: {
  readonly parent?: AgentExecutionControl;
}): AgentExecutionControl {
  const controller = new AbortController();
  let snapshot: AgentExecutionStopSnapshot = Object.freeze({
    stopped: false,
    reason: null,
    detail: null,
  });
  let parentListener: (() => void) | null = null;

  const cleanupParentListener = () => {
    if (input?.parent && parentListener) {
      input.parent.signal.removeEventListener("abort", parentListener);
      parentListener = null;
    }
  };

  const control: AgentExecutionControl = Object.freeze({
    signal: controller.signal,

    snapshot() {
      return snapshot;
    },

    stop(request) {
      if (snapshot.stopped) return snapshot;

      const reason = assertReason(request.reason);
      const detail = normalizeDetail(request.detail);

      snapshot = Object.freeze({
        stopped: true,
        reason,
        detail,
      });
      cleanupParentListener();
      controller.abort();
      return snapshot;
    },

    throwIfStopped() {
      if (snapshot.stopped) throw stoppedError(snapshot);
    },
  });

  if (input?.parent) {
    const propagateParentStop = () => {
      const parentSnapshot = input.parent!.snapshot();
      if (!parentSnapshot.stopped || parentSnapshot.reason === null) {
        control.stop({
          reason: "shutdown",
          detail: "Parent execution aborted without a stop snapshot",
        });
        return;
      }
      control.stop({
        reason: parentSnapshot.reason,
        detail: parentSnapshot.detail,
      });
    };

    if (input.parent.signal.aborted) {
      propagateParentStop();
    } else {
      parentListener = propagateParentStop;
      input.parent.signal.addEventListener("abort", parentListener, {
        once: true,
      });
    }
  }

  return control;
}

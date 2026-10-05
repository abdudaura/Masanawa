import {
  toInstant,
  type AgentRunId,
  type Instant,
} from "@masanawa/contracts";
import {
  assertAgentExecutionBudgetCurrent,
  assertCanAdmitChildRun,
  normalizeAgentExecutionBudget,
  normalizeAgentExecutionUsage,
  type AgentExecutionBudget,
  type AgentExecutionUsage,
} from "./execution-budget.js";

export interface ChildExecutionBudgetRequest {
  readonly childAgentRunId: AgentRunId;
  readonly at: Instant;
  readonly maxWallClockMs: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxTotalTokens: number;
  readonly maxToolCalls: number;
  readonly maxChildRuns: number;
  readonly maxProviderCostMicros: number;
}

export interface ChildExecutionBudgetGrant {
  /**
   * Local ceiling for one child run. All actual child usage must ALSO be
   * charged to the shared root/parent meter by the integration owner.
   * This local grant is not an independent pool of spendable execution budget.
   */
  readonly childBudget: AgentExecutionBudget;
  readonly rootAgentRunId: AgentRunId;
  readonly grantedAt: Instant;
  readonly parentObservedAt: Instant;
}

function integer(
  value: number,
  name: string,
  min = 0,
): number {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function remaining(limit: number, used: number): number {
  return Math.max(0, limit - used);
}

function elapsedMs(startedAt: Instant, at: Instant): number {
  const start = Date.parse(startedAt);
  const current = Date.parse(at);
  if (!Number.isFinite(start) || !Number.isFinite(current) || current < start) {
    throw new TypeError("Child budget timestamp is invalid");
  }
  return current - start;
}

function assertAtMost(
  requested: number,
  available: number,
  name: string,
): void {
  if (requested > available) {
    throw new RangeError(
      `${name} exceeds the parent AgentRun remaining execution budget`,
    );
  }
}

/**
 * Derives a local child ceiling from the parent's currently remaining envelope.
 *
 * Critical invariant: this does not transfer or duplicate budget. The root meter
 * remains authoritative and must be charged for all child inference/tool/child
 * activity. Durable integration must serialize root-meter updates so concurrent
 * children cannot oversubscribe the same remaining allowance.
 */
export function deriveChildExecutionBudget(input: {
  readonly parentBudget: AgentExecutionBudget;
  readonly parentUsage: AgentExecutionUsage;
  readonly request: ChildExecutionBudgetRequest;
}): ChildExecutionBudgetGrant {
  const parentBudget = normalizeAgentExecutionBudget(input.parentBudget);
  const parentUsage = normalizeAgentExecutionUsage(input.parentUsage);
  const at = toInstant(input.request.at);

  assertAgentExecutionBudgetCurrent({
    budget: parentBudget,
    usage: parentUsage,
    at,
  });
  assertCanAdmitChildRun({
    budget: parentBudget,
    usage: parentUsage,
    at,
  });

  const elapsed = elapsedMs(parentUsage.startedAt, at);
  const remainingWallClockMs = Math.max(
    0,
    parentBudget.maxWallClockMs - elapsed,
  );
  const remainingInputTokens = remaining(
    parentBudget.maxInputTokens,
    parentUsage.inputTokens,
  );
  const remainingOutputTokens = remaining(
    parentBudget.maxOutputTokens,
    parentUsage.outputTokens,
  );
  const remainingTotalTokens = remaining(
    parentBudget.maxTotalTokens,
    parentUsage.inputTokens + parentUsage.outputTokens,
  );
  const remainingToolCalls = remaining(
    parentBudget.maxToolCalls,
    parentUsage.toolCalls,
  );
  const remainingChildRuns = remaining(
    parentBudget.maxChildRuns,
    parentUsage.childRuns + 1,
  );
  const remainingProviderCostMicros = remaining(
    parentBudget.maxProviderCostMicros,
    parentUsage.providerCostMicros,
  );

  const request = {
    maxWallClockMs: integer(
      input.request.maxWallClockMs,
      "request.maxWallClockMs",
      1_000,
    ),
    maxInputTokens: integer(
      input.request.maxInputTokens,
      "request.maxInputTokens",
      1,
    ),
    maxOutputTokens: integer(
      input.request.maxOutputTokens,
      "request.maxOutputTokens",
      1,
    ),
    maxTotalTokens: integer(
      input.request.maxTotalTokens,
      "request.maxTotalTokens",
      1,
    ),
    maxToolCalls: integer(
      input.request.maxToolCalls,
      "request.maxToolCalls",
    ),
    maxChildRuns: integer(
      input.request.maxChildRuns,
      "request.maxChildRuns",
    ),
    maxProviderCostMicros: integer(
      input.request.maxProviderCostMicros,
      "request.maxProviderCostMicros",
    ),
  };

  assertAtMost(
    request.maxWallClockMs,
    remainingWallClockMs,
    "request.maxWallClockMs",
  );
  assertAtMost(
    request.maxInputTokens,
    remainingInputTokens,
    "request.maxInputTokens",
  );
  assertAtMost(
    request.maxOutputTokens,
    remainingOutputTokens,
    "request.maxOutputTokens",
  );
  assertAtMost(
    request.maxTotalTokens,
    remainingTotalTokens,
    "request.maxTotalTokens",
  );
  assertAtMost(
    request.maxToolCalls,
    remainingToolCalls,
    "request.maxToolCalls",
  );
  assertAtMost(
    request.maxChildRuns,
    remainingChildRuns,
    "request.maxChildRuns",
  );
  assertAtMost(
    request.maxProviderCostMicros,
    remainingProviderCostMicros,
    "request.maxProviderCostMicros",
  );

  const childBudget = normalizeAgentExecutionBudget({
    schemaVersion: 1,
    agentRunId: input.request.childAgentRunId,
    maxWallClockMs: request.maxWallClockMs,
    maxInputTokens: request.maxInputTokens,
    maxOutputTokens: request.maxOutputTokens,
    maxTotalTokens: request.maxTotalTokens,
    maxToolCalls: request.maxToolCalls,
    maxChildRuns: request.maxChildRuns,
    maxProviderCostMicros: request.maxProviderCostMicros,
    providerCostCurrency: parentBudget.providerCostCurrency,
  });

  return Object.freeze({
    childBudget,
    rootAgentRunId: parentBudget.agentRunId,
    grantedAt: at,
    parentObservedAt: parentUsage.observedAt,
  });
}

import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type AgentRunId,
  type Instant,
} from "@masanawa/contracts";

export interface AgentExecutionBudget {
  readonly schemaVersion: 1;
  readonly agentRunId: AgentRunId;
  readonly maxWallClockMs: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxTotalTokens: number;
  readonly maxToolCalls: number;
  readonly maxChildRuns: number;
  readonly maxProviderCostMicros: number;
  readonly providerCostCurrency: string;
}

export interface AgentExecutionUsage {
  readonly schemaVersion: 1;
  readonly agentRunId: AgentRunId;
  readonly startedAt: Instant;
  readonly observedAt: Instant;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
  readonly childRuns: number;
  readonly providerCostMicros: number;
  readonly providerCostCurrency: string;
}

export interface InferenceBudgetPreflight {
  readonly at: Instant;
  readonly inputTokens: number;
  readonly maxOutputTokens: number;
  readonly estimatedProviderCostMicros: number;
  readonly providerCostCurrency: string;
}

export interface InferenceUsageDelta {
  readonly observedAt: Instant;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly providerCostMicros: number;
  readonly providerCostCurrency: string;
}

function exactKeys(value: object, keys: readonly string[], name: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} is invalid`);
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    throw new TypeError(`${name} has unknown fields`);
  }
}

function boundedInteger(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function normalizeCurrency(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("providerCostCurrency must be a string");
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new TypeError("providerCostCurrency must be an ISO-style 3-letter code");
  }
  return normalized;
}

function sameCurrency(left: string, right: string): boolean {
  return normalizeCurrency(left) === normalizeCurrency(right);
}

function budgetExceeded(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function elapsedMs(startedAt: Instant, at: Instant): number {
  const started = Date.parse(startedAt);
  const observed = Date.parse(at);
  if (!Number.isFinite(started) || !Number.isFinite(observed) || observed < started) {
    throw new TypeError("Agent execution timestamps are invalid");
  }
  return observed - started;
}

export function normalizeAgentExecutionBudget(
  input: AgentExecutionBudget,
): AgentExecutionBudget {
  exactKeys(input, [
    "schemaVersion",
    "agentRunId",
    "maxWallClockMs",
    "maxInputTokens",
    "maxOutputTokens",
    "maxTotalTokens",
    "maxToolCalls",
    "maxChildRuns",
    "maxProviderCostMicros",
    "providerCostCurrency",
  ], "AgentExecutionBudget");

  if (input.schemaVersion !== 1) {
    throw new TypeError("AgentExecutionBudget schema is invalid");
  }

  const maxInputTokens = boundedInteger(
    input.maxInputTokens,
    "maxInputTokens",
    1,
    100_000_000,
  );
  const maxOutputTokens = boundedInteger(
    input.maxOutputTokens,
    "maxOutputTokens",
    1,
    100_000_000,
  );
  const maxTotalTokens = boundedInteger(
    input.maxTotalTokens,
    "maxTotalTokens",
    1,
    200_000_000,
  );
  if (
    maxTotalTokens < maxInputTokens ||
    maxTotalTokens < maxOutputTokens
  ) {
    throw new RangeError(
      "maxTotalTokens cannot be lower than an input or output token ceiling",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    agentRunId: parseCanonicalId("agent-run", input.agentRunId),
    maxWallClockMs: boundedInteger(
      input.maxWallClockMs,
      "maxWallClockMs",
      1_000,
      7 * 24 * 60 * 60 * 1_000,
    ),
    maxInputTokens,
    maxOutputTokens,
    maxTotalTokens,
    maxToolCalls: boundedInteger(input.maxToolCalls, "maxToolCalls", 0, 100_000),
    maxChildRuns: boundedInteger(input.maxChildRuns, "maxChildRuns", 0, 10_000),
    maxProviderCostMicros: boundedInteger(
      input.maxProviderCostMicros,
      "maxProviderCostMicros",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    providerCostCurrency: normalizeCurrency(input.providerCostCurrency),
  });
}

export function normalizeAgentExecutionUsage(
  input: AgentExecutionUsage,
): AgentExecutionUsage {
  exactKeys(input, [
    "schemaVersion",
    "agentRunId",
    "startedAt",
    "observedAt",
    "inputTokens",
    "outputTokens",
    "toolCalls",
    "childRuns",
    "providerCostMicros",
    "providerCostCurrency",
  ], "AgentExecutionUsage");

  if (input.schemaVersion !== 1) {
    throw new TypeError("AgentExecutionUsage schema is invalid");
  }
  const startedAt = toInstant(input.startedAt);
  const observedAt = toInstant(input.observedAt);
  if (observedAt < startedAt) {
    throw new TypeError("AgentExecutionUsage observedAt precedes startedAt");
  }

  return Object.freeze({
    schemaVersion: 1,
    agentRunId: parseCanonicalId("agent-run", input.agentRunId),
    startedAt,
    observedAt,
    inputTokens: boundedInteger(
      input.inputTokens,
      "inputTokens",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    outputTokens: boundedInteger(
      input.outputTokens,
      "outputTokens",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    toolCalls: boundedInteger(
      input.toolCalls,
      "toolCalls",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    childRuns: boundedInteger(
      input.childRuns,
      "childRuns",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    providerCostMicros: boundedInteger(
      input.providerCostMicros,
      "providerCostMicros",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    providerCostCurrency: normalizeCurrency(input.providerCostCurrency),
  });
}

export function createInitialAgentExecutionUsage(input: {
  readonly agentRunId: AgentRunId;
  readonly startedAt: Instant;
  readonly providerCostCurrency: string;
}): AgentExecutionUsage {
  const startedAt = toInstant(input.startedAt);
  return normalizeAgentExecutionUsage({
    schemaVersion: 1,
    agentRunId: input.agentRunId,
    startedAt,
    observedAt: startedAt,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    childRuns: 0,
    providerCostMicros: 0,
    providerCostCurrency: input.providerCostCurrency,
  });
}

function assertBoundTogether(
  budgetRaw: AgentExecutionBudget,
  usageRaw: AgentExecutionUsage,
): {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
} {
  const budget = normalizeAgentExecutionBudget(budgetRaw);
  const usage = normalizeAgentExecutionUsage(usageRaw);
  if (
    budget.agentRunId !== usage.agentRunId ||
    !sameCurrency(budget.providerCostCurrency, usage.providerCostCurrency)
  ) {
    throw new PlatformError({
      code: "agents.execution_budget_binding_mismatch",
      category: "authorization",
      message: "Execution budget and usage are not bound to the same AgentRun/currency",
      retryable: false,
    });
  }
  return { budget, usage };
}

export function assertAgentExecutionBudgetCurrent(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly at: Instant;
}): void {
  const { budget, usage } = assertBoundTogether(input.budget, input.usage);
  const at = toInstant(input.at);
  if (at < usage.observedAt) {
    throw new PlatformError({
      code: "agents.execution_usage_stale",
      category: "conflict",
      message: "Execution budget cannot be checked against an older observation time",
      retryable: false,
    });
  }

  if (elapsedMs(usage.startedAt, at) > budget.maxWallClockMs) {
    throw budgetExceeded(
      "agents.execution_budget_wall_clock_exhausted",
      "AgentRun wall-clock budget is exhausted",
    );
  }
  if (usage.inputTokens > budget.maxInputTokens) {
    throw budgetExceeded(
      "agents.execution_budget_input_tokens_exhausted",
      "AgentRun input-token budget is exhausted",
    );
  }
  if (usage.outputTokens > budget.maxOutputTokens) {
    throw budgetExceeded(
      "agents.execution_budget_output_tokens_exhausted",
      "AgentRun output-token budget is exhausted",
    );
  }
  if (usage.inputTokens + usage.outputTokens > budget.maxTotalTokens) {
    throw budgetExceeded(
      "agents.execution_budget_total_tokens_exhausted",
      "AgentRun total-token budget is exhausted",
    );
  }
  if (usage.toolCalls > budget.maxToolCalls) {
    throw budgetExceeded(
      "agents.execution_budget_tool_calls_exhausted",
      "AgentRun Tool-call budget is exhausted",
    );
  }
  if (usage.childRuns > budget.maxChildRuns) {
    throw budgetExceeded(
      "agents.execution_budget_child_runs_exhausted",
      "AgentRun child-run budget is exhausted",
    );
  }
  if (usage.providerCostMicros > budget.maxProviderCostMicros) {
    throw budgetExceeded(
      "agents.execution_budget_provider_cost_exhausted",
      "AgentRun provider-cost budget is exhausted",
    );
  }
}

export function assertCanAdmitInference(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly next: InferenceBudgetPreflight;
}): void {
  const { budget, usage } = assertBoundTogether(input.budget, input.usage);
  assertAgentExecutionBudgetCurrent({
    budget,
    usage,
    at: input.next.at,
  });

  const nextInput = boundedInteger(
    input.next.inputTokens,
    "next.inputTokens",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const nextOutput = boundedInteger(
    input.next.maxOutputTokens,
    "next.maxOutputTokens",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const nextCost = boundedInteger(
    input.next.estimatedProviderCostMicros,
    "next.estimatedProviderCostMicros",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  if (!sameCurrency(input.next.providerCostCurrency, budget.providerCostCurrency)) {
    throw new TypeError("Inference provider-cost currency does not match the AgentRun budget");
  }

  if (usage.inputTokens + nextInput > budget.maxInputTokens) {
    throw budgetExceeded(
      "agents.execution_budget_input_tokens_exhausted",
      "Next inference exceeds the AgentRun input-token budget",
    );
  }
  if (usage.outputTokens + nextOutput > budget.maxOutputTokens) {
    throw budgetExceeded(
      "agents.execution_budget_output_tokens_exhausted",
      "Next inference exceeds the AgentRun output-token budget",
    );
  }
  if (
    usage.inputTokens +
      usage.outputTokens +
      nextInput +
      nextOutput >
    budget.maxTotalTokens
  ) {
    throw budgetExceeded(
      "agents.execution_budget_total_tokens_exhausted",
      "Next inference exceeds the AgentRun total-token budget",
    );
  }
  if (usage.providerCostMicros + nextCost > budget.maxProviderCostMicros) {
    throw budgetExceeded(
      "agents.execution_budget_provider_cost_exhausted",
      "Next inference exceeds the AgentRun provider-cost budget",
    );
  }
}

export function recordInferenceUsage(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly delta: InferenceUsageDelta;
}): AgentExecutionUsage {
  const { budget, usage } = assertBoundTogether(input.budget, input.usage);
  const observedAt = toInstant(input.delta.observedAt);
  if (observedAt < usage.observedAt) {
    throw new PlatformError({
      code: "agents.execution_usage_stale",
      category: "conflict",
      message: "Inference usage observation moved backwards",
      retryable: false,
    });
  }
  if (!sameCurrency(input.delta.providerCostCurrency, budget.providerCostCurrency)) {
    throw new TypeError("Inference usage currency does not match the AgentRun budget");
  }

  const next = normalizeAgentExecutionUsage({
    ...usage,
    observedAt,
    inputTokens:
      usage.inputTokens +
      boundedInteger(
        input.delta.inputTokens,
        "delta.inputTokens",
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    outputTokens:
      usage.outputTokens +
      boundedInteger(
        input.delta.outputTokens,
        "delta.outputTokens",
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    providerCostMicros:
      usage.providerCostMicros +
      boundedInteger(
        input.delta.providerCostMicros,
        "delta.providerCostMicros",
        0,
        Number.MAX_SAFE_INTEGER,
      ),
  });
  assertAgentExecutionBudgetCurrent({ budget, usage: next, at: observedAt });
  return next;
}

export function assertCanDispatchTool(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly at: Instant;
}): void {
  const { budget, usage } = assertBoundTogether(input.budget, input.usage);
  assertAgentExecutionBudgetCurrent({ budget, usage, at: input.at });
  if (usage.toolCalls + 1 > budget.maxToolCalls) {
    throw budgetExceeded(
      "agents.execution_budget_tool_calls_exhausted",
      "Next Tool dispatch exceeds the AgentRun Tool-call budget",
    );
  }
}

export function recordToolDispatch(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly observedAt: Instant;
}): AgentExecutionUsage {
  assertCanDispatchTool({
    budget: input.budget,
    usage: input.usage,
    at: input.observedAt,
  });
  const usage = normalizeAgentExecutionUsage(input.usage);
  const next = normalizeAgentExecutionUsage({
    ...usage,
    observedAt: toInstant(input.observedAt),
    toolCalls: usage.toolCalls + 1,
  });
  assertAgentExecutionBudgetCurrent({
    budget: input.budget,
    usage: next,
    at: next.observedAt,
  });
  return next;
}

export function assertCanAdmitChildRun(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly at: Instant;
}): void {
  const { budget, usage } = assertBoundTogether(input.budget, input.usage);
  assertAgentExecutionBudgetCurrent({ budget, usage, at: input.at });
  if (usage.childRuns + 1 > budget.maxChildRuns) {
    throw budgetExceeded(
      "agents.execution_budget_child_runs_exhausted",
      "Next child AgentRun exceeds the AgentRun child-run budget",
    );
  }
}

export function recordChildRunAdmission(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly observedAt: Instant;
}): AgentExecutionUsage {
  assertCanAdmitChildRun({
    budget: input.budget,
    usage: input.usage,
    at: input.observedAt,
  });
  const usage = normalizeAgentExecutionUsage(input.usage);
  const next = normalizeAgentExecutionUsage({
    ...usage,
    observedAt: toInstant(input.observedAt),
    childRuns: usage.childRuns + 1,
  });
  assertAgentExecutionBudgetCurrent({
    budget: input.budget,
    usage: next,
    at: next.observedAt,
  });
  return next;
}

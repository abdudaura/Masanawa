import { describe, expect, it } from "vitest";
import {
  createInitialAgentExecutionUsage,
  normalizeAgentExecutionBudget,
  recordInferenceUsage,
  recordToolDispatch,
} from "./execution-budget.js";
import { deriveChildExecutionBudget } from "./execution-budget-partition.js";

const parentAgentRunId =
  "agent-run_00000000-0000-4000-8000-000000000001" as never;
const childAgentRunId =
  "agent-run_00000000-0000-4000-8000-000000000002" as never;
const startedAt = "2026-10-05T10:00:00.000Z" as never;

const budget = normalizeAgentExecutionBudget({
  schemaVersion: 1,
  agentRunId: parentAgentRunId,
  maxWallClockMs: 120_000,
  maxInputTokens: 1_000,
  maxOutputTokens: 800,
  maxTotalTokens: 1_500,
  maxToolCalls: 10,
  maxChildRuns: 3,
  maxProviderCostMicros: 20_000,
  providerCostCurrency: "USD",
});

function baseUsage() {
  return createInitialAgentExecutionUsage({
    agentRunId: parentAgentRunId,
    startedAt,
    providerCostCurrency: "USD",
  });
}

function request() {
  return {
    childAgentRunId,
    at: "2026-10-05T10:00:30.000Z" as never,
    maxWallClockMs: 60_000,
    maxInputTokens: 300,
    maxOutputTokens: 200,
    maxTotalTokens: 450,
    maxToolCalls: 3,
    maxChildRuns: 1,
    maxProviderCostMicros: 5_000,
  };
}

describe("child AgentRun execution budget derivation", () => {
  it("derives a bounded local child envelope from remaining root capacity", () => {
    const grant = deriveChildExecutionBudget({
      parentBudget: budget,
      parentUsage: baseUsage(),
      request: request(),
    });
    expect(grant.parentAgentRunId).toBe(parentAgentRunId);
    expect(grant.childBudget.agentRunId).toBe(childAgentRunId);
    expect(grant.childBudget.providerCostCurrency).toBe("USD");
    expect(grant.childBudget.maxTotalTokens).toBe(450);
  });

  it("accounts for parent usage before granting a child ceiling", () => {
    let usage = recordInferenceUsage({
      budget,
      usage: baseUsage(),
      delta: {
        observedAt: "2026-10-05T10:00:10.000Z" as never,
        inputTokens: 800,
        outputTokens: 400,
        providerCostMicros: 16_000,
        providerCostCurrency: "USD",
      },
    });
    usage = recordToolDispatch({
      budget,
      usage,
      observedAt: "2026-10-05T10:00:11.000Z" as never,
    });

    expect(() =>
      deriveChildExecutionBudget({
        parentBudget: budget,
        parentUsage: usage,
        request: request(),
      }),
    ).toThrow("maxInputTokens exceeds");
  });

  it("cannot grant a child beyond the parent's remaining wall clock", () => {
    expect(() =>
      deriveChildExecutionBudget({
        parentBudget: budget,
        parentUsage: baseUsage(),
        request: {
          ...request(),
          at: "2026-10-05T10:01:30.000Z" as never,
          maxWallClockMs: 60_000,
        },
      }),
    ).toThrow("maxWallClockMs exceeds");
  });

  it("reserves one direct child slot conceptually before allowing nested-child ceiling", () => {
    const grant = deriveChildExecutionBudget({
      parentBudget: budget,
      parentUsage: baseUsage(),
      request: {
        ...request(),
        maxChildRuns: 2,
      },
    });
    expect(grant.childBudget.maxChildRuns).toBe(2);

    expect(() =>
      deriveChildExecutionBudget({
        parentBudget: budget,
        parentUsage: baseUsage(),
        request: {
          ...request(),
          maxChildRuns: 3,
        },
      }),
    ).toThrow("maxChildRuns exceeds");
  });

  it("does not turn the child ceiling into independent financial authority", () => {
    const grant = deriveChildExecutionBudget({
      parentBudget: budget,
      parentUsage: baseUsage(),
      request: request(),
    });
    expect(Object.keys(grant.childBudget)).not.toContain("accountId");
    expect(Object.keys(grant.childBudget)).not.toContain("approvalIds");
    expect(Object.keys(grant.childBudget)).not.toContain("wallet");
  });
});

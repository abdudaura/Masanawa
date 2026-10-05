import { describe, expect, it } from "vitest";
import {
  assertAgentExecutionBudgetCurrent,
  assertCanAdmitChildRun,
  assertCanAdmitInference,
  assertCanDispatchTool,
  createInitialAgentExecutionUsage,
  normalizeAgentExecutionBudget,
  recordChildRunAdmission,
  recordInferenceUsage,
  recordToolDispatch,
} from "./execution-budget.js";

const agentRunId =
  "agent-run_00000000-0000-4000-8000-000000000001" as never;
const startedAt = "2026-10-05T10:00:00.000Z" as never;

const budget = normalizeAgentExecutionBudget({
  schemaVersion: 1,
  agentRunId,
  maxWallClockMs: 60_000,
  maxInputTokens: 100,
  maxOutputTokens: 80,
  maxTotalTokens: 150,
  maxToolCalls: 2,
  maxChildRuns: 1,
  maxProviderCostMicros: 5_000,
  providerCostCurrency: "USD",
});

function usage() {
  return createInitialAgentExecutionUsage({
    agentRunId,
    startedAt,
    providerCostCurrency: "USD",
  });
}

describe("AgentRun execution budgets", () => {
  it("preflights inference against input/output/total/cost ceilings", () => {
    const current = usage();
    expect(() =>
      assertCanAdmitInference({
        budget,
        usage: current,
        next: {
          at: "2026-10-05T10:00:01.000Z" as never,
          inputTokens: 40,
          maxOutputTokens: 30,
          estimatedProviderCostMicros: 1_000,
          providerCostCurrency: "USD",
        },
      }),
    ).not.toThrow();

    expect(() =>
      assertCanAdmitInference({
        budget,
        usage: current,
        next: {
          at: "2026-10-05T10:00:01.000Z" as never,
          inputTokens: 101,
          maxOutputTokens: 1,
          estimatedProviderCostMicros: 0,
          providerCostCurrency: "USD",
        },
      }),
    ).toThrow("input-token budget");
  });

  it("records inference usage monotonically and fails closed after exhaustion", () => {
    const first = recordInferenceUsage({
      budget,
      usage: usage(),
      delta: {
        observedAt: "2026-10-05T10:00:10.000Z" as never,
        inputTokens: 60,
        outputTokens: 40,
        providerCostMicros: 2_000,
        providerCostCurrency: "USD",
      },
    });
    expect(first.inputTokens).toBe(60);
    expect(first.outputTokens).toBe(40);
    expect(first.providerCostMicros).toBe(2_000);

    expect(() =>
      recordInferenceUsage({
        budget,
        usage: first,
        delta: {
          observedAt: "2026-10-05T10:00:20.000Z" as never,
          inputTokens: 30,
          outputTokens: 30,
          providerCostMicros: 1_000,
          providerCostCurrency: "USD",
        },
      }),
    ).toThrow("total-token budget");

    expect(() =>
      recordInferenceUsage({
        budget,
        usage: first,
        delta: {
          observedAt: "2026-10-05T10:00:09.000Z" as never,
          inputTokens: 0,
          outputTokens: 0,
          providerCostMicros: 0,
          providerCostCurrency: "USD",
        },
      }),
    ).toThrow("moved backwards");
  });

  it("requires matching AgentRun and provider cost currency", () => {
    expect(() =>
      assertCanAdmitInference({
        budget,
        usage: usage(),
        next: {
          at: "2026-10-05T10:00:01.000Z" as never,
          inputTokens: 1,
          maxOutputTokens: 1,
          estimatedProviderCostMicros: 1,
          providerCostCurrency: "NGN",
        },
      }),
    ).toThrow("currency");

    expect(() =>
      assertAgentExecutionBudgetCurrent({
        budget,
        usage: {
          ...usage(),
          agentRunId:
            "agent-run_00000000-0000-4000-8000-000000000999" as never,
        },
        at: "2026-10-05T10:00:01.000Z" as never,
      }),
    ).toThrow("same AgentRun");
  });

  it("fails when wall-clock budget is exhausted", () => {
    expect(() =>
      assertAgentExecutionBudgetCurrent({
        budget,
        usage: usage(),
        at: "2026-10-05T10:01:00.001Z" as never,
      }),
    ).toThrow("wall-clock budget");
  });

  it("checks and records Tool dispatch count before dispatch", () => {
    let current = usage();
    expect(() =>
      assertCanDispatchTool({
        budget,
        usage: current,
        at: "2026-10-05T10:00:01.000Z" as never,
      }),
    ).not.toThrow();

    current = recordToolDispatch({
      budget,
      usage: current,
      observedAt: "2026-10-05T10:00:01.000Z" as never,
    });
    current = recordToolDispatch({
      budget,
      usage: current,
      observedAt: "2026-10-05T10:00:02.000Z" as never,
    });
    expect(current.toolCalls).toBe(2);

    expect(() =>
      assertCanDispatchTool({
        budget,
        usage: current,
        at: "2026-10-05T10:00:03.000Z" as never,
      }),
    ).toThrow("Tool-call budget");
  });

  it("checks and records child AgentRun admission count", () => {
    let current = usage();
    expect(() =>
      assertCanAdmitChildRun({
        budget,
        usage: current,
        at: "2026-10-05T10:00:01.000Z" as never,
      }),
    ).not.toThrow();

    current = recordChildRunAdmission({
      budget,
      usage: current,
      observedAt: "2026-10-05T10:00:01.000Z" as never,
    });
    expect(current.childRuns).toBe(1);

    expect(() =>
      assertCanAdmitChildRun({
        budget,
        usage: current,
        at: "2026-10-05T10:00:02.000Z" as never,
      }),
    ).toThrow("child-run budget");
  });

  it("rejects malformed budgets and negative/non-finite-like usage inputs", () => {
    expect(() =>
      normalizeAgentExecutionBudget({
        ...budget,
        maxToolCalls: -1,
      }),
    ).toThrow("maxToolCalls");

    expect(() =>
      recordInferenceUsage({
        budget,
        usage: usage(),
        delta: {
          observedAt: "2026-10-05T10:00:01.000Z" as never,
          inputTokens: -1,
          outputTokens: 0,
          providerCostMicros: 0,
          providerCostCurrency: "USD",
        },
      }),
    ).toThrow("delta.inputTokens");
  });
});

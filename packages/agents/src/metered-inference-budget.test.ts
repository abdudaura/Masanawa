import { describe, expect, it, vi } from "vitest";
import type {
  AgentInferenceControls,
  AgentInferenceRequest,
} from "./strategy.js";
import {
  createInitialAgentExecutionUsage,
  normalizeAgentExecutionBudget,
} from "./execution-budget.js";
import {
  createBudgetAccountedMeteredInference,
  type AgentInferenceUsageReservationPort,
} from "./metered-inference-budget.js";
import type { MeteredAgentInferenceProvider } from "./inference-usage.js";

const agentRunId =
  "agent-run_00000000-0000-4000-8000-000000000001" as never;
const startedAt = "2026-10-05T12:00:00.000Z" as never;
const observedAt = "2026-10-05T12:00:05.000Z" as never;

const budget = normalizeAgentExecutionBudget({
  schemaVersion: 1,
  agentRunId,
  maxWallClockMs: 60_000,
  maxInputTokens: 1_000,
  maxOutputTokens: 800,
  maxTotalTokens: 1_500,
  maxToolCalls: 10,
  maxChildRuns: 2,
  maxProviderCostMicros: 50_000,
  providerCostCurrency: "USD",
});

function usage() {
  return createInitialAgentExecutionUsage({
    agentRunId,
    startedAt,
    providerCostCurrency: "USD",
  });
}

const inference: AgentInferenceRequest = {
  systemInstructions: [],
  input: { kind: "text", text: "hello" },
};

function provider(
  overrides: Partial<MeteredAgentInferenceProvider> = {},
): MeteredAgentInferenceProvider {
  return {
    async generate(
      _input: AgentInferenceRequest,
      _controls?: AgentInferenceControls,
    ) {
      return {
        text: "hello back",
        usage: {
          schemaVersion: 1,
          source: "provider-reported",
          inputTokens: 20,
          outputTokens: 10,
          providerCostMicros: 500,
          providerCostCurrency: "USD",
          evidenceRef: "provider-request:req-1",
          pricingRevision: null,
          observedAt,
        },
      };
    },
    ...overrides,
  };
}

const preflight = {
  at: "2026-10-05T12:00:01.000Z" as never,
  inputTokens: 30,
  maxOutputTokens: 50,
  estimatedProviderCostMicros: 1_000,
  providerCostCurrency: "USD",
};

describe("budget-accounted metered inference", () => {
  it("preflights, calls provider, durably records verified usage, then returns result", async () => {
    const reserveInferenceUsage: AgentInferenceUsageReservationPort["reserveInferenceUsage"] =
      vi.fn(async (input) => input.nextUsage);
    const generate = vi.fn(provider().generate);
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      reservations: { reserveInferenceUsage },
    });

    const result = await service.generate({
      agentRunId,
      inference,
      budget,
      usage: usage(),
      preflight,
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserveInferenceUsage).toHaveBeenCalledTimes(1);
    expect(generate.mock.invocationCallOrder[0]).toBeLessThan(
      reserveInferenceUsage.mock.invocationCallOrder[0]!,
    );
    expect(result.result.text).toBe("hello back");
    expect(result.result.usage.evidenceRef).toBe("provider-request:req-1");
    expect(result.usageAfterInference.inputTokens).toBe(20);
    expect(result.usageAfterInference.outputTokens).toBe(10);
  });

  it("does not call provider when preflight exceeds budget", async () => {
    const generate = vi.fn(provider().generate);
    const reserveInferenceUsage = vi.fn();
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      reservations: {
        reserveInferenceUsage: reserveInferenceUsage as never,
      },
    });

    await expect(service.generate({
      agentRunId,
      inference,
      budget,
      usage: usage(),
      preflight: {
        ...preflight,
        inputTokens: 1_001,
      },
    })).rejects.toThrow("input-token budget");

    expect(generate).not.toHaveBeenCalled();
    expect(reserveInferenceUsage).not.toHaveBeenCalled();
  });

  it("rejects the provider result when durable usage reservation fails", async () => {
    const service = createBudgetAccountedMeteredInference({
      provider: provider(),
      reservations: {
        async reserveInferenceUsage() {
          throw new Error("usage revision conflict");
        },
      },
    });

    await expect(service.generate({
      agentRunId,
      inference,
      budget,
      usage: usage(),
      preflight,
    })).rejects.toMatchObject({
      code: "agents.inference_usage_uncommitted",
      retryable: false,
      details: {
        evidenceRef: "provider-request:req-1",
      },
    });
  });

  it("rejects a mismatched committed usage snapshot", async () => {
    const service = createBudgetAccountedMeteredInference({
      provider: provider(),
      reservations: {
        async reserveInferenceUsage(input) {
          return {
            ...input.nextUsage,
            outputTokens: input.nextUsage.outputTokens + 1,
          };
        },
      },
    });

    await expect(service.generate({
      agentRunId,
      inference,
      budget,
      usage: usage(),
      preflight,
    })).rejects.toMatchObject({
      code: "agents.inference_usage_uncommitted",
      details: { evidenceRef: "provider-request:req-1" },
    });
  });

  it("rejects provider-reported usage that exceeds the actual budget", async () => {
    const service = createBudgetAccountedMeteredInference({
      provider: provider({
        async generate() {
          return {
            text: "too expensive",
            usage: {
              schemaVersion: 1,
              source: "provider-reported",
              inputTokens: 900,
              outputTokens: 700,
              providerCostMicros: 500,
              providerCostCurrency: "USD",
              evidenceRef: "provider-request:req-over",
              pricingRevision: null,
              observedAt,
            },
          };
        },
      }),
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate({
      agentRunId,
      inference,
      budget,
      usage: usage(),
      preflight,
    })).rejects.toThrow("total-token budget");
  });

  it("requires budget and usage bound to the requested AgentRun", async () => {
    const service = createBudgetAccountedMeteredInference({
      provider: provider(),
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate({
      agentRunId:
        "agent-run_00000000-0000-4000-8000-000000000999" as never,
      inference,
      budget,
      usage: usage(),
      preflight,
    })).rejects.toThrow("not bound to agentRunId");
  });
});

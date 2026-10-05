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
  type AgentInferenceDispatchReservationPort,
  type AgentInferenceUsageReservationPort,
} from "./metered-inference-budget.js";
import type { MeteredAgentInferenceProvider } from "./inference-usage.js";

const agentRunId =
  "agent-run_00000000-0000-4000-8000-000000000001" as never;
const startedAt = "2026-10-05T12:00:00.000Z" as never;
const observedAt = "2026-10-05T12:00:05.000Z" as never;
const attemptKey = "inference-attempt:turn-1";
const requestFingerprint = "sha256:request-fingerprint-1";

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

function dispatches(
  newlyAdmitted = true,
): AgentInferenceDispatchReservationPort {
  return {
    async reserveInferenceDispatch() {
      return { newlyAdmitted };
    },
  };
}

const preflight = {
  at: "2026-10-05T12:00:01.000Z" as never,
  inputTokens: 30,
  maxOutputTokens: 50,
  estimatedProviderCostMicros: 1_000,
  providerCostCurrency: "USD",
};

function request() {
  return {
    agentRunId,
    attemptKey,
    requestFingerprint,
    inference,
    budget,
    usage: usage(),
    preflight,
  };
}

describe("budget-accounted metered inference", () => {
  it("claims dispatch, calls provider, durably records verified usage, then returns result", async () => {
    const reserveInferenceDispatch: AgentInferenceDispatchReservationPort["reserveInferenceDispatch"] =
      vi.fn(async () => ({ newlyAdmitted: true }));
    const reserveInferenceUsage: AgentInferenceUsageReservationPort["reserveInferenceUsage"] =
      vi.fn(async (input) => input.nextUsage);
    const generate = vi.fn(provider().generate);
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: { reserveInferenceDispatch },
      reservations: { reserveInferenceUsage },
    });

    const result = await service.generate(request());

    expect(reserveInferenceDispatch).toHaveBeenCalledWith({
      agentRunId,
      attemptKey,
      requestFingerprint,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserveInferenceUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        agentRunId,
        attemptKey,
        requestFingerprint,
        evidenceRef: "provider-request:req-1",
      }),
    );
    expect(reserveInferenceDispatch.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0]!,
    );
    expect(generate.mock.invocationCallOrder[0]).toBeLessThan(
      reserveInferenceUsage.mock.invocationCallOrder[0]!,
    );
    expect(result.result.text).toBe("hello back");
    expect(result.result.usage.evidenceRef).toBe("provider-request:req-1");
    expect(result.usageAfterInference.inputTokens).toBe(20);
    expect(result.usageAfterInference.outputTokens).toBe(10);
  });

  it("does not reserve dispatch or call provider when preflight exceeds budget", async () => {
    const generate = vi.fn(provider().generate);
    const reserveInferenceDispatch = vi.fn();
    const reserveInferenceUsage = vi.fn();
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: {
        reserveInferenceDispatch: reserveInferenceDispatch as never,
      },
      reservations: {
        reserveInferenceUsage: reserveInferenceUsage as never,
      },
    });

    await expect(service.generate({
      ...request(),
      preflight: {
        ...preflight,
        inputTokens: 1_001,
      },
    })).rejects.toThrow("input-token budget");

    expect(reserveInferenceDispatch).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(reserveInferenceUsage).not.toHaveBeenCalled();
  });

  it("does not call provider when durable dispatch admission is ambiguous", async () => {
    const generate = vi.fn(provider().generate);
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: {
        async reserveInferenceDispatch() {
          throw new Error("dispatch reservation timeout");
        },
      },
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate(request())).rejects.toMatchObject({
      code: "agents.inference_dispatch_uncommitted",
      retryable: false,
      details: { attemptKey },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("blocks an already-admitted attempt instead of redispatching provider inference", async () => {
    const generate = vi.fn(provider().generate);
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: dispatches(false),
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate(request())).rejects.toMatchObject({
      code: "agents.inference_dispatch_replay_blocked",
      retryable: false,
      details: { attemptKey },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("blocks redispatch after provider success when durable usage accounting failed", async () => {
    let claimed = false;
    const generate = vi.fn(provider().generate);
    const reserveInferenceUsage = vi.fn(async () => {
      throw new Error("usage revision conflict");
    });
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: {
        async reserveInferenceDispatch() {
          if (claimed) return { newlyAdmitted: false };
          claimed = true;
          return { newlyAdmitted: true };
        },
      },
      reservations: { reserveInferenceUsage },
    });

    await expect(service.generate(request())).rejects.toMatchObject({
      code: "agents.inference_usage_uncommitted",
      retryable: false,
      details: {
        evidenceRef: "provider-request:req-1",
        attemptKey,
      },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserveInferenceUsage).toHaveBeenCalledTimes(1);

    await expect(service.generate(request())).rejects.toMatchObject({
      code: "agents.inference_dispatch_replay_blocked",
      retryable: false,
      details: { attemptKey },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserveInferenceUsage).toHaveBeenCalledTimes(1);
  });

  it("rejects a mismatched committed usage snapshot", async () => {
    const service = createBudgetAccountedMeteredInference({
      provider: provider(),
      dispatches: dispatches(),
      reservations: {
        async reserveInferenceUsage(input) {
          return {
            ...input.nextUsage,
            outputTokens: input.nextUsage.outputTokens + 1,
          };
        },
      },
    });

    await expect(service.generate(request())).rejects.toMatchObject({
      code: "agents.inference_usage_uncommitted",
      details: {
        evidenceRef: "provider-request:req-1",
        attemptKey,
      },
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
      dispatches: dispatches(),
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate(request()))
      .rejects.toThrow("total-token budget");
  });

  it("requires budget and usage bound to the requested AgentRun before dispatch admission", async () => {
    const reserveInferenceDispatch = vi.fn();
    const service = createBudgetAccountedMeteredInference({
      provider: provider(),
      dispatches: {
        reserveInferenceDispatch: reserveInferenceDispatch as never,
      },
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate({
      ...request(),
      agentRunId:
        "agent-run_00000000-0000-4000-8000-000000000999" as never,
    })).rejects.toThrow("not bound to agentRunId");
    expect(reserveInferenceDispatch).not.toHaveBeenCalled();
  });

  it("requires stable opaque attempt identity before provider dispatch", async () => {
    const generate = vi.fn(provider().generate);
    const reserveInferenceDispatch = vi.fn();
    const service = createBudgetAccountedMeteredInference({
      provider: { generate },
      dispatches: {
        reserveInferenceDispatch: reserveInferenceDispatch as never,
      },
      reservations: {
        async reserveInferenceUsage(input) {
          return input.nextUsage;
        },
      },
    });

    await expect(service.generate({
      ...request(),
      attemptKey: "   ",
    })).rejects.toThrow("attemptKey");
    await expect(service.generate({
      ...request(),
      requestFingerprint: "",
    })).rejects.toThrow("requestFingerprint");

    expect(reserveInferenceDispatch).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});

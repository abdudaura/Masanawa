import { describe, expect, it } from "vitest";
import {
  createInitialAgentExecutionUsage,
  normalizeAgentExecutionBudget,
} from "./execution-budget.js";
import {
  inferenceUsageEvidenceToDelta,
  normalizeAgentInferenceUsageEvidence,
  recordVerifiedInferenceUsage,
} from "./inference-usage.js";

const agentRunId =
  "agent-run_00000000-0000-4000-8000-000000000001" as never;
const startedAt = "2026-10-05T12:00:00.000Z" as never;
const observedAt = "2026-10-05T12:00:10.000Z" as never;

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

describe("verified Agent inference usage evidence", () => {
  it.each(["provider-reported", "platform-metered"] as const)(
    "accepts trusted %s usage evidence",
    (source) => {
      expect(
        normalizeAgentInferenceUsageEvidence({
          schemaVersion: 1,
          source,
          inputTokens: 120,
          outputTokens: 40,
          providerCostMicros: 2_500,
          providerCostCurrency: "usd",
          evidenceRef: "provider-request:abc123",
          pricingRevision: source === "platform-metered" ? "pricing-v1" : null,
          observedAt,
        }),
      ).toEqual({
        schemaVersion: 1,
        source,
        inputTokens: 120,
        outputTokens: 40,
        providerCostMicros: 2_500,
        providerCostCurrency: "USD",
        evidenceRef: "provider-request:abc123",
        pricingRevision: source === "platform-metered" ? "pricing-v1" : null,
        observedAt,
      });
    },
  );

  it("rejects estimated or otherwise untrusted usage sources", () => {
    expect(() =>
      normalizeAgentInferenceUsageEvidence({
        schemaVersion: 1,
        source: "estimated" as never,
        inputTokens: 1,
        outputTokens: 1,
        providerCostMicros: 1,
        providerCostCurrency: "USD",
        evidenceRef: "estimate:test",
        pricingRevision: null,
        observedAt,
      }),
    ).toThrow("source is not trusted");
  });

  it("rejects negative, fractional and unsafe usage values", () => {
    for (const inputTokens of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        normalizeAgentInferenceUsageEvidence({
          schemaVersion: 1,
          source: "provider-reported",
          inputTokens,
          outputTokens: 0,
          providerCostMicros: 0,
          providerCostCurrency: "USD",
          evidenceRef: "provider-request:negative-test",
          pricingRevision: null,
          observedAt,
        }),
      ).toThrow("inputTokens");
    }
  });

  it("converts evidence exactly into budget usage delta", () => {
    expect(
      inferenceUsageEvidenceToDelta({
        schemaVersion: 1,
        source: "platform-metered",
        inputTokens: 33,
        outputTokens: 44,
        providerCostMicros: 1_250,
        providerCostCurrency: "NGN",
        evidenceRef: "meter:event-1",
        pricingRevision: "pricing-ng-v3",
        observedAt,
      }),
    ).toEqual({
      observedAt,
      inputTokens: 33,
      outputTokens: 44,
      providerCostMicros: 1_250,
      providerCostCurrency: "NGN",
    });
  });

  it("records verified usage through the canonical AgentRun budget accounting", () => {
    const next = recordVerifiedInferenceUsage({
      budget,
      usage: usage(),
      evidence: {
        schemaVersion: 1,
        source: "provider-reported",
        inputTokens: 120,
        outputTokens: 40,
        providerCostMicros: 2_500,
        providerCostCurrency: "USD",
        evidenceRef: "provider-request:usage-1",
        pricingRevision: null,
        observedAt,
      },
    });

    expect(next.inputTokens).toBe(120);
    expect(next.outputTokens).toBe(40);
    expect(next.providerCostMicros).toBe(2_500);
    expect(next.observedAt).toBe(observedAt);
  });

  it("still fails closed on currency mismatch through the canonical budget contract", () => {
    expect(() =>
      recordVerifiedInferenceUsage({
        budget,
        usage: usage(),
        evidence: {
          schemaVersion: 1,
          source: "provider-reported",
          inputTokens: 10,
          outputTokens: 5,
          providerCostMicros: 100,
          providerCostCurrency: "NGN",
          evidenceRef: "provider-request:currency-mismatch",
          pricingRevision: null,
          observedAt,
        },
      }),
    ).toThrow("currency");
  });

  it("still fails closed when verified usage exhausts a budget", () => {
    expect(() =>
      recordVerifiedInferenceUsage({
        budget,
        usage: usage(),
        evidence: {
          schemaVersion: 1,
          source: "platform-metered",
          inputTokens: 900,
          outputTokens: 700,
          providerCostMicros: 1_000,
          providerCostCurrency: "USD",
          evidenceRef: "meter:event-exhausted",
          pricingRevision: "pricing-usd-v2",
          observedAt,
        },
      }),
    ).toThrow("total-token budget");
  });
  it("requires an auditable evidence reference", () => {
    expect(() =>
      normalizeAgentInferenceUsageEvidence({
        schemaVersion: 1,
        source: "provider-reported",
        inputTokens: 1,
        outputTokens: 1,
        providerCostMicros: 1,
        providerCostCurrency: "USD",
        evidenceRef: "   ",
        pricingRevision: null,
        observedAt,
      }),
    ).toThrow("evidenceRef");
  });

  it("requires pricing revision only for platform-metered cost", () => {
    expect(() =>
      normalizeAgentInferenceUsageEvidence({
        schemaVersion: 1,
        source: "platform-metered",
        inputTokens: 1,
        outputTokens: 1,
        providerCostMicros: 1,
        providerCostCurrency: "USD",
        evidenceRef: "meter:event-no-pricing",
        pricingRevision: null,
        observedAt,
      }),
    ).toThrow("requires pricingRevision");

    expect(() =>
      normalizeAgentInferenceUsageEvidence({
        schemaVersion: 1,
        source: "provider-reported",
        inputTokens: 1,
        outputTokens: 1,
        providerCostMicros: 1,
        providerCostCurrency: "USD",
        evidenceRef: "provider-request:unexpected-pricing",
        pricingRevision: "pricing-v1",
        observedAt,
      }),
    ).toThrow("must not claim");
  });

  it("rejects unknown evidence fields", () => {
    expect(() =>
      normalizeAgentInferenceUsageEvidence({
        schemaVersion: 1,
        source: "provider-reported",
        inputTokens: 1,
        outputTokens: 1,
        providerCostMicros: 1,
        providerCostCurrency: "USD",
        evidenceRef: "provider-request:unknown-field",
        pricingRevision: null,
        observedAt,
        fabricated: true,
      } as never),
    ).toThrow("unknown fields");
  });

});

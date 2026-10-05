import type { AgentInferenceProvider, AgentInferenceRequest, AgentInferenceControls, AgentInferenceResult } from "./strategy.js";
import {
  recordInferenceUsage,
  type AgentExecutionBudget,
  type AgentExecutionUsage,
  type InferenceUsageDelta,
} from "./execution-budget.js";
import { toInstant, type Instant } from "@masanawa/contracts";

export const agentInferenceUsageSources = [
  "provider-reported",
  "platform-metered",
] as const;

export type AgentInferenceUsageSource =
  (typeof agentInferenceUsageSources)[number];

export interface AgentInferenceUsageEvidence {
  readonly schemaVersion: 1;
  readonly source: AgentInferenceUsageSource;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly providerCostMicros: number;
  readonly providerCostCurrency: string;
  readonly evidenceRef: string;
  readonly pricingRevision: string | null;
  readonly observedAt: Instant;
}

export interface MeteredAgentInferenceResult extends AgentInferenceResult {
  readonly usage: AgentInferenceUsageEvidence;
}

/**
 * Additive provider-neutral interface for adapters that can produce trustworthy usage.
 * Existing AgentInferenceProvider remains unchanged for backward compatibility.
 */
export interface MeteredAgentInferenceProvider extends AgentInferenceProvider {
  generate(
    input: AgentInferenceRequest,
    controls?: AgentInferenceControls,
  ): Promise<MeteredAgentInferenceResult>;
}

function exactKeys(value: object, keys: readonly string[]): void {
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    throw new TypeError("Agent inference usage evidence has unknown fields");
  }
}

function boundedReference(value: string, name: string, max: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(
      `${name} must be non-empty and at most ${max} characters`,
    );
  }
  return normalized;
}

function nonNegativeSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeCurrency(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("providerCostCurrency must be a string");
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new TypeError(
      "providerCostCurrency must be an ISO-style 3-letter code",
    );
  }
  return normalized;
}

export function normalizeAgentInferenceUsageEvidence(
  input: AgentInferenceUsageEvidence,
): AgentInferenceUsageEvidence {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Agent inference usage evidence is invalid");
  }
  exactKeys(input, [
    "schemaVersion",
    "source",
    "inputTokens",
    "outputTokens",
    "providerCostMicros",
    "providerCostCurrency",
    "evidenceRef",
    "pricingRevision",
    "observedAt",
  ]);
  if (input.schemaVersion !== 1) {
    throw new TypeError("Agent inference usage evidence schema is invalid");
  }
  if (!agentInferenceUsageSources.includes(input.source)) {
    throw new TypeError(
      "Agent inference usage evidence source is not trusted",
    );
  }

  const evidenceRef = boundedReference(
    input.evidenceRef,
    "evidenceRef",
    500,
  );
  const pricingRevision =
    input.pricingRevision === null
      ? null
      : boundedReference(
          input.pricingRevision,
          "pricingRevision",
          160,
        );
  if (input.source === "platform-metered" && pricingRevision === null) {
    throw new TypeError(
      "platform-metered usage requires pricingRevision",
    );
  }
  if (input.source === "provider-reported" && pricingRevision !== null) {
    throw new TypeError(
      "provider-reported usage must not claim a platform pricingRevision",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    source: input.source,
    inputTokens: nonNegativeSafeInteger(
      input.inputTokens,
      "inputTokens",
    ),
    outputTokens: nonNegativeSafeInteger(
      input.outputTokens,
      "outputTokens",
    ),
    providerCostMicros: nonNegativeSafeInteger(
      input.providerCostMicros,
      "providerCostMicros",
    ),
    providerCostCurrency: normalizeCurrency(
      input.providerCostCurrency,
    ),
    evidenceRef,
    pricingRevision,
    observedAt: toInstant(input.observedAt),
  });
}

export function inferenceUsageEvidenceToDelta(
  input: AgentInferenceUsageEvidence,
): InferenceUsageDelta {
  const evidence = normalizeAgentInferenceUsageEvidence(input);
  return Object.freeze({
    observedAt: evidence.observedAt,
    inputTokens: evidence.inputTokens,
    outputTokens: evidence.outputTokens,
    providerCostMicros: evidence.providerCostMicros,
    providerCostCurrency: evidence.providerCostCurrency,
  });
}

export function recordVerifiedInferenceUsage(input: {
  readonly budget: AgentExecutionBudget;
  readonly usage: AgentExecutionUsage;
  readonly evidence: AgentInferenceUsageEvidence;
}): AgentExecutionUsage {
  return recordInferenceUsage({
    budget: input.budget,
    usage: input.usage,
    delta: inferenceUsageEvidenceToDelta(input.evidence),
  });
}

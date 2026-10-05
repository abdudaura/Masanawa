import {
  PlatformError,
  type AgentRunId,
} from "@masanawa/contracts";
import type {
  AgentInferenceControls,
  AgentInferenceRequest,
} from "./strategy.js";
import {
  assertCanAdmitInference,
  type AgentExecutionBudget,
  type AgentExecutionUsage,
  type InferenceBudgetPreflight,
} from "./execution-budget.js";
import {
  normalizeAgentInferenceUsageEvidence,
  recordVerifiedInferenceUsage,
  type MeteredAgentInferenceProvider,
  type MeteredAgentInferenceResult,
} from "./inference-usage.js";

export interface AgentInferenceUsageReservationPort {
  /**
   * Durably reserve the exact verified post-inference usage.
   *
   * Implementations must be idempotent by agentRunId + evidenceRef:
   * - exact replay returns the same committed usage;
   * - changed replay fails closed;
   * - optimistic expectedUsage mismatch fails closed.
   */
  reserveInferenceUsage(input: {
    readonly agentRunId: AgentRunId;
    readonly evidenceRef: string;
    readonly budget: AgentExecutionBudget;
    readonly expectedUsage: AgentExecutionUsage;
    readonly nextUsage: AgentExecutionUsage;
  }): Promise<AgentExecutionUsage>;
}

export interface AccountedMeteredInferenceResult {
  readonly result: MeteredAgentInferenceResult;
  readonly usageAfterInference: AgentExecutionUsage;
}

function sameUsage(
  left: AgentExecutionUsage,
  right: AgentExecutionUsage,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.agentRunId === right.agentRunId &&
    left.startedAt === right.startedAt &&
    left.observedAt === right.observedAt &&
    left.inputTokens === right.inputTokens &&
    left.outputTokens === right.outputTokens &&
    left.toolCalls === right.toolCalls &&
    left.childRuns === right.childRuns &&
    left.providerCostMicros === right.providerCostMicros &&
    left.providerCostCurrency === right.providerCostCurrency
  );
}

function accountingFailure(
  evidenceRef: string,
  cause: unknown,
): PlatformError {
  return new PlatformError({
    code: "agents.inference_usage_uncommitted",
    category: "conflict",
    message:
      "Verified inference usage was not durably committed; reconcile by evidence reference before any provider redispatch",
    retryable: false,
    details: {
      evidenceRef,
      cause:
        cause instanceof Error
          ? cause.name
          : "unknown",
    },
  });
}

export function createBudgetAccountedMeteredInference(input: {
  readonly provider: MeteredAgentInferenceProvider;
  readonly reservations: AgentInferenceUsageReservationPort;
}) {
  return Object.freeze({
    async generate(request: {
      readonly agentRunId: AgentRunId;
      readonly inference: AgentInferenceRequest;
      readonly controls?: AgentInferenceControls;
      readonly budget: AgentExecutionBudget;
      readonly usage: AgentExecutionUsage;
      readonly preflight: InferenceBudgetPreflight;
    }): Promise<AccountedMeteredInferenceResult> {
      if (
        request.budget.agentRunId !== request.agentRunId ||
        request.usage.agentRunId !== request.agentRunId
      ) {
        throw new TypeError(
          "Metered inference budget/usage is not bound to agentRunId",
        );
      }

      assertCanAdmitInference({
        budget: request.budget,
        usage: request.usage,
        next: request.preflight,
      });

      const providerResult = await input.provider.generate(
        request.inference,
        request.controls,
      );
      const evidence = normalizeAgentInferenceUsageEvidence(
        providerResult.usage,
      );
      const normalizedResult: MeteredAgentInferenceResult = Object.freeze({
        ...providerResult,
        usage: evidence,
      });

      const nextUsage = recordVerifiedInferenceUsage({
        budget: request.budget,
        usage: request.usage,
        evidence,
      });

      let committedUsage: AgentExecutionUsage;
      try {
        committedUsage = await input.reservations.reserveInferenceUsage({
          agentRunId: request.agentRunId,
          evidenceRef: evidence.evidenceRef,
          budget: request.budget,
          expectedUsage: request.usage,
          nextUsage,
        });
      } catch (error) {
        throw accountingFailure(evidence.evidenceRef, error);
      }

      if (!sameUsage(committedUsage, nextUsage)) {
        throw accountingFailure(
          evidence.evidenceRef,
          new TypeError(
            "Inference usage reservation returned a different usage snapshot",
          ),
        );
      }

      return Object.freeze({
        result: normalizedResult,
        usageAfterInference: committedUsage,
      });
    },
  });
}

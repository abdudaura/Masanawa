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

export interface AgentInferenceDispatchReservationPort {
  /**
   * Durably claim one provider dispatch before inference begins.
   *
   * Implementations must be exact/idempotent by agentRunId + attemptKey:
   * - the first exact claim returns newlyAdmitted=true;
   * - an exact replay returns newlyAdmitted=false and must never widen authority;
   * - a changed requestFingerprint for the same key fails closed.
   *
   * Once a claim exists, callers must reconcile that attempt instead of blindly
   * redispatching the provider. This deliberately prefers conservative recovery
   * over duplicate token/cost spend after an ambiguous failure.
   */
  reserveInferenceDispatch(input: {
    readonly agentRunId: AgentRunId;
    readonly attemptKey: string;
    readonly requestFingerprint: string;
  }): Promise<{ readonly newlyAdmitted: boolean }>;
}

export interface AgentInferenceUsageReservationPort {
  /**
   * Durably reserve the exact verified post-inference usage.
   *
   * Implementations must be idempotent by agentRunId + attemptKey + evidenceRef:
   * - exact replay returns the same committed usage;
   * - changed replay fails closed;
   * - optimistic expectedUsage mismatch fails closed;
   * - the attemptKey/requestFingerprint must bind the usage to the already
   *   reserved provider dispatch.
   */
  reserveInferenceUsage(input: {
    readonly agentRunId: AgentRunId;
    readonly attemptKey: string;
    readonly requestFingerprint: string;
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

function boundedOpaque(value: string, name: string, max: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function dispatchFailure(
  attemptKey: string,
  cause: unknown,
): PlatformError {
  return new PlatformError({
    code: "agents.inference_dispatch_uncommitted",
    category: "conflict",
    message:
      "Inference dispatch admission is uncertain; reconcile the attempt before provider execution",
    retryable: false,
    details: {
      attemptKey,
      cause: cause instanceof Error ? cause.name : "unknown",
    },
  });
}

function dispatchReplayBlocked(attemptKey: string): PlatformError {
  return new PlatformError({
    code: "agents.inference_dispatch_replay_blocked",
    category: "conflict",
    message:
      "This inference attempt already has durable dispatch admission; reconcile it instead of redispatching the provider",
    retryable: false,
    details: { attemptKey },
  });
}

function accountingFailure(
  evidenceRef: string,
  attemptKey: string,
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
      attemptKey,
      cause:
        cause instanceof Error
          ? cause.name
          : "unknown",
    },
  });
}

export function createBudgetAccountedMeteredInference(input: {
  readonly provider: MeteredAgentInferenceProvider;
  readonly dispatches: AgentInferenceDispatchReservationPort;
  readonly reservations: AgentInferenceUsageReservationPort;
}) {
  return Object.freeze({
    async generate(request: {
      readonly agentRunId: AgentRunId;
      readonly attemptKey: string;
      readonly requestFingerprint: string;
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

      const attemptKey = boundedOpaque(
        request.attemptKey,
        "attemptKey",
        256,
      );
      const requestFingerprint = boundedOpaque(
        request.requestFingerprint,
        "requestFingerprint",
        256,
      );

      let dispatchAdmission: { readonly newlyAdmitted: boolean };
      try {
        dispatchAdmission = await input.dispatches.reserveInferenceDispatch({
          agentRunId: request.agentRunId,
          attemptKey,
          requestFingerprint,
        });
      } catch (error) {
        throw dispatchFailure(attemptKey, error);
      }
      if (
        !dispatchAdmission ||
        typeof dispatchAdmission.newlyAdmitted !== "boolean"
      ) {
        throw dispatchFailure(
          attemptKey,
          new TypeError("Inference dispatch reservation returned invalid evidence"),
        );
      }
      if (!dispatchAdmission.newlyAdmitted) {
        throw dispatchReplayBlocked(attemptKey);
      }

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
          attemptKey,
          requestFingerprint,
          evidenceRef: evidence.evidenceRef,
          budget: request.budget,
          expectedUsage: request.usage,
          nextUsage,
        });
      } catch (error) {
        throw accountingFailure(evidence.evidenceRef, attemptKey, error);
      }

      if (!sameUsage(committedUsage, nextUsage)) {
        throw accountingFailure(
          evidence.evidenceRef,
          attemptKey,
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

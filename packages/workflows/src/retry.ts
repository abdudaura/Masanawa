import {
  workflowRetryLimits,
  type WorkflowFailureClassification,
  type WorkflowRetryDecision,
  type WorkflowRetryPolicy,
} from "./retry-model.js";

const policyKeyPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

export function createWorkflowRetryPolicy(
  input: WorkflowRetryPolicy,
): WorkflowRetryPolicy {
  if (
    !input.key ||
    input.key.length > workflowRetryLimits.maxPolicyKeyLength ||
    !policyKeyPattern.test(input.key)
  ) {
    fail("retry policy key must use a bounded stable lowercase key format");
  }
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    fail("retry policy version must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > workflowRetryLimits.maxAttempts
  ) {
    fail(`maxAttempts must be between 1 and ${workflowRetryLimits.maxAttempts}`);
  }
  if (!["fixed", "linear", "exponential"].includes(input.backoff)) {
    fail("retry backoff kind is not supported");
  }
  if (
    !Number.isSafeInteger(input.baseDelayMs) ||
    input.baseDelayMs < workflowRetryLimits.minDelayMs ||
    input.baseDelayMs > workflowRetryLimits.maxDelayMs
  ) {
    fail("baseDelayMs is outside the supported retry range");
  }
  if (
    !Number.isSafeInteger(input.maxDelayMs) ||
    input.maxDelayMs < input.baseDelayMs ||
    input.maxDelayMs > workflowRetryLimits.maxDelayMs
  ) {
    fail("maxDelayMs must be bounded and no smaller than baseDelayMs");
  }
  if (
    !Number.isFinite(input.multiplier) ||
    input.multiplier < 1 ||
    input.multiplier > 10
  ) {
    fail("retry multiplier must be finite and between 1 and 10");
  }
  if (
    !["dead-letter", "needs-attention"].includes(
      input.exhaustionDisposition,
    )
  ) {
    fail("retry exhaustionDisposition is not supported");
  }

  return Object.freeze({ ...input });
}

export function retryDelayMs(
  policyInput: WorkflowRetryPolicy,
  completedAttempts: number,
): number {
  const policy = createWorkflowRetryPolicy(policyInput);
  if (
    !Number.isSafeInteger(completedAttempts) ||
    completedAttempts < 1 ||
    completedAttempts >= policy.maxAttempts
  ) {
    fail("completedAttempts must identify a retryable completed attempt");
  }

  const retryIndex = completedAttempts - 1;
  let raw: number;
  if (policy.backoff === "fixed") {
    raw = policy.baseDelayMs;
  } else if (policy.backoff === "linear") {
    raw = policy.baseDelayMs * (1 + retryIndex * policy.multiplier);
  } else {
    raw = policy.baseDelayMs * Math.pow(policy.multiplier, retryIndex);
  }

  return Math.min(policy.maxDelayMs, Math.max(policy.baseDelayMs, Math.round(raw)));
}

export function decideWorkflowRetry(
  policyInput: WorkflowRetryPolicy,
  input: {
    readonly priorCompletedAttempts: number;
    readonly classification: WorkflowFailureClassification;
  },
): WorkflowRetryDecision {
  const policy = createWorkflowRetryPolicy(policyInput);
  if (
    !Number.isSafeInteger(input.priorCompletedAttempts) ||
    input.priorCompletedAttempts < 0 ||
    input.priorCompletedAttempts >= policy.maxAttempts
  ) {
    fail("priorCompletedAttempts is outside the retry policy attempt range");
  }

  const completedAttempts = input.priorCompletedAttempts + 1;

  if (
    input.classification === "ambiguous" ||
    input.classification === "unsafe-retry"
  ) {
    return Object.freeze({
      completedAttempts,
      disposition: "needs-attention",
      delayMs: null,
    });
  }

  if (input.classification === "terminal") {
    return Object.freeze({
      completedAttempts,
      disposition: "dead-letter",
      delayMs: null,
    });
  }

  if (completedAttempts >= policy.maxAttempts) {
    return Object.freeze({
      completedAttempts,
      disposition: policy.exhaustionDisposition,
      delayMs: null,
    });
  }

  return Object.freeze({
    completedAttempts,
    disposition: "retry-scheduled",
    delayMs: retryDelayMs(policy, completedAttempts),
  });
}

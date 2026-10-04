export const workflowRetryLimits = Object.freeze({
  maxAttempts: 20,
  minDelayMs: 100,
  maxDelayMs: 604_800_000,
  maxFailureCodeLength: 160,
  maxFailureMessageLength: 2_000,
  maxPolicyKeyLength: 96,
} as const);

export type WorkflowRetryBackoff = "fixed" | "linear" | "exponential";
export type WorkflowRetryDisposition =
  | "retry-scheduled"
  | "dead-letter"
  | "needs-attention";

export interface WorkflowRetryPolicy {
  readonly key: string;
  readonly version: number;
  readonly maxAttempts: number;
  readonly backoff: WorkflowRetryBackoff;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly exhaustionDisposition: Extract<
    WorkflowRetryDisposition,
    "dead-letter" | "needs-attention"
  >;
}

export type WorkflowFailureClassification =
  | "retryable"
  | "terminal"
  | "ambiguous"
  | "unsafe-retry";

export interface WorkflowRetryDecision {
  readonly completedAttempts: number;
  readonly disposition: WorkflowRetryDisposition;
  readonly delayMs: number | null;
}

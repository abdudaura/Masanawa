export const workflowRetryLimits = Object.freeze({
  maxAttempts: 100,
  maxDelayMs: 7 * 24 * 60 * 60 * 1000,
  maxMultiplier: 16,
  maxReasonCodeLength: 160,
  maxErrorMessageLength: 2_000,
} as const);

export interface WorkflowRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
}

export interface WorkflowRetryFailureSignal {
  readonly failureCount: number;
  readonly retryable: boolean;
  readonly uncertainOutcome: boolean;
  readonly operatorAttention: boolean;
  readonly reasonCode: string;
}

export type WorkflowRetryDisposition =
  | {
      readonly kind: "retry-scheduled";
      readonly failureCount: number;
      readonly delayMs: number;
      readonly reasonCode: string;
    }
  | {
      readonly kind: "dead-letter";
      readonly failureCount: number;
      readonly reasonCode: string;
    }
  | {
      readonly kind: "needs-attention";
      readonly failureCount: number;
      readonly reasonCode: string;
    };

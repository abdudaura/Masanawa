import { describe, expect, it } from "vitest";
import {
  decideWorkflowRetryDisposition,
  normalizeWorkflowRetryPolicy,
  workflowRetryDelayMs,
} from "./index.js";

const policy = {
  maxAttempts: 4,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
  multiplier: 2,
} as const;

describe("Workflow retry policy", () => {
  it("normalizes bounded retry policy", () => {
    expect(normalizeWorkflowRetryPolicy(policy)).toEqual(policy);
    expect(() =>
      normalizeWorkflowRetryPolicy({
        ...policy,
        baseDelayMs: 20_000,
      }),
    ).toThrow(/cannot exceed/u);
  });

  it("computes deterministic capped exponential backoff", () => {
    expect(workflowRetryDelayMs(policy, 1)).toBe(1_000);
    expect(workflowRetryDelayMs(policy, 2)).toBe(2_000);
    expect(workflowRetryDelayMs(policy, 3)).toBe(4_000);
    expect(
      workflowRetryDelayMs(
        { ...policy, multiplier: 10 },
        3,
      ),
    ).toBe(10_000);
  });

  it("schedules only retryable failures below the attempt ceiling", () => {
    expect(
      decideWorkflowRetryDisposition(policy, {
        failureCount: 1,
        retryable: true,
        uncertainOutcome: false,
        operatorAttention: false,
        reasonCode: "provider.timeout",
      }),
    ).toEqual({
      kind: "retry-scheduled",
      failureCount: 1,
      delayMs: 1_000,
      reasonCode: "provider.timeout",
    });

    expect(
      decideWorkflowRetryDisposition(policy, {
        failureCount: 4,
        retryable: true,
        uncertainOutcome: false,
        operatorAttention: false,
        reasonCode: "provider.timeout",
      }),
    ).toEqual({
      kind: "dead-letter",
      failureCount: 4,
      reasonCode: "provider.timeout",
    });
  });

  it("routes non-retryable failures to dead-letter", () => {
    expect(
      decideWorkflowRetryDisposition(policy, {
        failureCount: 1,
        retryable: false,
        uncertainOutcome: false,
        operatorAttention: false,
        reasonCode: "provider.rejected",
      }),
    ).toMatchObject({
      kind: "dead-letter",
      failureCount: 1,
    });
  });

  it("routes uncertain or operator-sensitive outcomes to needs-attention before retry logic", () => {
    for (const signal of [
      {
        uncertainOutcome: true,
        operatorAttention: false,
      },
      {
        uncertainOutcome: false,
        operatorAttention: true,
      },
    ]) {
      expect(
        decideWorkflowRetryDisposition(policy, {
          failureCount: 1,
          retryable: true,
          reasonCode: "provider.unknown_outcome",
          ...signal,
        }),
      ).toEqual({
        kind: "needs-attention",
        failureCount: 1,
        reasonCode: "provider.unknown_outcome",
      });
    }
  });

  it("rejects malformed limits and reason codes", () => {
    expect(() =>
      decideWorkflowRetryDisposition(policy, {
        failureCount: 0,
        retryable: true,
        uncertainOutcome: false,
        operatorAttention: false,
        reasonCode: "provider.timeout",
      }),
    ).toThrow(/failureCount/u);

    expect(() =>
      decideWorkflowRetryDisposition(policy, {
        failureCount: 1,
        retryable: true,
        uncertainOutcome: false,
        operatorAttention: false,
        reasonCode: "Bad Reason",
      }),
    ).toThrow(/stable bounded lowercase/u);
  });
});

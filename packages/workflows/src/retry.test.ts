import { describe, expect, it } from "vitest";
import {
  createWorkflowRetryPolicy,
  decideWorkflowRetry,
  retryDelayMs,
  workflowRetryLimits,
} from "./index.js";

const policy = createWorkflowRetryPolicy({
  key: "provider_transient",
  version: 1,
  maxAttempts: 4,
  backoff: "exponential",
  baseDelayMs: 1_000,
  maxDelayMs: 5_000,
  multiplier: 2,
  exhaustionDisposition: "dead-letter",
});

describe("workflow retry policy", () => {
  it("computes deterministic bounded exponential backoff", () => {
    expect(retryDelayMs(policy, 1)).toBe(1_000);
    expect(retryDelayMs(policy, 2)).toBe(2_000);
    expect(retryDelayMs(policy, 3)).toBe(4_000);
  });

  it("supports fixed and linear backoff without random jitter", () => {
    const fixed = createWorkflowRetryPolicy({
      ...policy,
      backoff: "fixed",
    });
    expect(retryDelayMs(fixed, 1)).toBe(1_000);
    expect(retryDelayMs(fixed, 3)).toBe(1_000);

    const linear = createWorkflowRetryPolicy({
      ...policy,
      backoff: "linear",
      multiplier: 2,
    });
    expect(retryDelayMs(linear, 1)).toBe(1_000);
    expect(retryDelayMs(linear, 2)).toBe(3_000);
    expect(retryDelayMs(linear, 3)).toBe(5_000);
  });

  it("schedules retry before exhaustion and terminally disposes at the limit", () => {
    expect(
      decideWorkflowRetry(policy, {
        priorCompletedAttempts: 0,
        classification: "retryable",
      }),
    ).toEqual({
      completedAttempts: 1,
      disposition: "retry-scheduled",
      delayMs: 1_000,
    });

    expect(
      decideWorkflowRetry(policy, {
        priorCompletedAttempts: 3,
        classification: "retryable",
      }),
    ).toEqual({
      completedAttempts: 4,
      disposition: "dead-letter",
      delayMs: null,
    });
  });

  it("escalates ambiguous and unsafe retry outcomes to needs-attention", () => {
    for (const classification of ["ambiguous", "unsafe-retry"] as const) {
      expect(
        decideWorkflowRetry(policy, {
          priorCompletedAttempts: 0,
          classification,
        }),
      ).toEqual({
        completedAttempts: 1,
        disposition: "needs-attention",
        delayMs: null,
      });
    }
  });

  it("respects needs-attention exhaustion policy", () => {
    const needsAttention = createWorkflowRetryPolicy({
      ...policy,
      maxAttempts: 2,
      exhaustionDisposition: "needs-attention",
    });
    expect(
      decideWorkflowRetry(needsAttention, {
        priorCompletedAttempts: 1,
        classification: "retryable",
      }),
    ).toEqual({
      completedAttempts: 2,
      disposition: "needs-attention",
      delayMs: null,
    });
  });

  it("rejects malformed and unsafe retry policies", () => {
    expect(() =>
      createWorkflowRetryPolicy({
        ...policy,
        maxAttempts: workflowRetryLimits.maxAttempts + 1,
      }),
    ).toThrow(/maxAttempts/u);

    expect(() =>
      createWorkflowRetryPolicy({
        ...policy,
        maxDelayMs: 500,
      }),
    ).toThrow(/maxDelayMs/u);

    expect(() =>
      createWorkflowRetryPolicy({
        ...policy,
        multiplier: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/multiplier/u);

    expect(() =>
      decideWorkflowRetry(policy, {
        priorCompletedAttempts: policy.maxAttempts,
        classification: "retryable",
      }),
    ).toThrow(/attempt range/u);
  });
});

import { describe, expect, it } from "vitest";
import {
  decideCandidatePromotion,
  normalizeOptimizationCandidate,
  type OptimizationCandidate,
} from "../../packages/telemetry/src/promotion.js";
import type {
  EvaluationRegressionComparison,
  EvaluationRunResult,
} from "../../packages/telemetry/src/evaluation.js";

const candidate: OptimizationCandidate = {
  schemaVersion: 1,
  candidateId: "candidate-000001",
  targetKind: "agent-strategy",
  targetRef: "agent-strategy:foreground",
  baselineRevision: 7,
  candidateRevision: 8,
  datasetKey: "agent.foreground",
  datasetVersion: "1.0.0",
  proposalHash: "a".repeat(64),
};

const evaluation: EvaluationRunResult = {
  datasetKey: "agent.foreground",
  datasetVersion: "1.0.0",
  passed: true,
  passedCases: 10,
  failedCases: 0,
  results: [],
};

const regression: EvaluationRegressionComparison = {
  regressions: [],
  recoveries: ["case-1"],
  unchangedFailures: [],
  unchangedPasses: ["case-2"],
  passed: true,
};

const review = {
  reviewerUserId: "user_reviewer-001",
  authorityContextId: "authority-context_promotion-001",
  decision: "approve" as const,
  reviewedAt: "2026-10-06T12:00:00Z",
  reason: "Evaluation gates passed and change is approved for promotion.",
};

const policy = {
  minCases: 5,
  maxFailedCases: 0,
  requireZeroRegressions: true,
  requireEvaluationPass: true,
};

describe("learning candidate promotion gates", () => {
  it("allows only a reviewed candidate whose exact baseline and evaluation gates pass", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation,
        regression,
        policy,
        review,
      }),
    ).toEqual({
      allowed: true,
      reason: "allowed",
      candidateId: "candidate-000001",
      targetRef: "agent-strategy:foreground",
      baselineRevision: 7,
      candidateRevision: 8,
    });
  });

  it("rejects stale baseline revisions to prevent overwriting newer production truth", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 8,
        evaluation,
        regression,
        policy,
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "stale-baseline",
    });
  });

  it("requires the exact dataset key and version declared by the candidate", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation: { ...evaluation, datasetVersion: "1.0.1" },
        regression,
        policy,
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "dataset-mismatch",
    });
  });

  it("rejects insufficient or failing evaluation evidence", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation: {
          ...evaluation,
          passedCases: 2,
          failedCases: 0,
        },
        regression,
        policy,
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "insufficient-evidence",
    });

    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation: {
          ...evaluation,
          passed: false,
          passedCases: 9,
          failedCases: 1,
        },
        regression,
        policy,
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "evaluation-gate-failed",
    });
  });

  it("rejects any regression when zero-regression policy is enabled", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation,
        regression: {
          ...regression,
          regressions: ["case-3"],
          passed: false,
        },
        policy,
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "regression-gate-failed",
    });
  });

  it("never self-promotes even perfect telemetry when the explicit review denies", () => {
    expect(
      decideCandidatePromotion({
        candidate,
        currentTargetRevision: 7,
        evaluation,
        regression,
        policy,
        review: {
          ...review,
          decision: "deny",
          reason: "Hold for operator investigation.",
        },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "review-denied",
    });
  });

  it("requires candidate revisions to advance rather than mutate an existing revision", () => {
    expect(() =>
      normalizeOptimizationCandidate({
        ...candidate,
        candidateRevision: candidate.baselineRevision,
      }),
    ).toThrow("must advance baselineRevision");
  });
});

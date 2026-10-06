import {
  type EvaluationRegressionComparison,
  type EvaluationRunResult,
} from "./evaluation.js";

export type OptimizationTargetKind =
  | "agent-strategy"
  | "provider-policy"
  | "skill-configuration"
  | "prompt-template"
  | "workflow-policy";

export interface OptimizationCandidate {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly targetKind: OptimizationTargetKind;
  readonly targetRef: string;
  readonly baselineRevision: number;
  readonly candidateRevision: number;
  readonly datasetKey: string;
  readonly datasetVersion: string;
  readonly proposalHash: string;
}

export interface PromotionGatePolicy {
  readonly minCases: number;
  readonly maxFailedCases: number;
  readonly requireZeroRegressions: boolean;
  readonly requireEvaluationPass: boolean;
}

export interface PromotionReview {
  readonly reviewerUserId: string;
  readonly authorityContextId: string;
  readonly decision: "approve" | "deny";
  readonly reviewedAt: string;
  readonly reason: string;
}

export interface CandidatePromotionDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "stale-baseline"
    | "dataset-mismatch"
    | "insufficient-evidence"
    | "evaluation-gate-failed"
    | "regression-gate-failed"
    | "review-denied";
  readonly candidateId: string;
  readonly targetRef: string;
  readonly baselineRevision: number;
  readonly candidateRevision: number;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function nonnegative(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function semanticVersion(value: string): string {
  const normalized = bounded(value, "datasetVersion", 5, 64);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(normalized)) {
    throw new TypeError("datasetVersion must use semantic version syntax");
  }
  return normalized;
}

function sha256(value: string, name: string): string {
  const normalized = bounded(value, name, 64, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new TypeError(`${name} must be SHA-256 hex`);
  }
  return normalized;
}

function instant(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

export function normalizeOptimizationCandidate(
  input: OptimizationCandidate,
): OptimizationCandidate {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported OptimizationCandidate schemaVersion");
  }
  if (
    input.targetKind !== "agent-strategy" &&
    input.targetKind !== "provider-policy" &&
    input.targetKind !== "skill-configuration" &&
    input.targetKind !== "prompt-template" &&
    input.targetKind !== "workflow-policy"
  ) {
    throw new TypeError("targetKind is invalid");
  }

  const baselineRevision = positive(input.baselineRevision, "baselineRevision");
  const candidateRevision = positive(input.candidateRevision, "candidateRevision");
  if (candidateRevision <= baselineRevision) {
    throw new Error("candidateRevision must advance baselineRevision");
  }

  return Object.freeze({
    schemaVersion: 1,
    candidateId: bounded(input.candidateId, "candidateId", 8, 180),
    targetKind: input.targetKind,
    targetRef: bounded(input.targetRef, "targetRef", 8, 220),
    baselineRevision,
    candidateRevision,
    datasetKey: bounded(input.datasetKey, "datasetKey", 1, 128).toLowerCase(),
    datasetVersion: semanticVersion(input.datasetVersion),
    proposalHash: sha256(input.proposalHash, "proposalHash"),
  });
}

export function normalizePromotionReview(
  input: PromotionReview,
): PromotionReview {
  if (input.decision !== "approve" && input.decision !== "deny") {
    throw new TypeError("review decision is invalid");
  }
  return Object.freeze({
    reviewerUserId: bounded(input.reviewerUserId, "reviewerUserId", 8, 220),
    authorityContextId: bounded(
      input.authorityContextId,
      "authorityContextId",
      8,
      220,
    ),
    decision: input.decision,
    reviewedAt: instant(input.reviewedAt, "reviewedAt"),
    reason: bounded(input.reason, "review.reason", 1, 500),
  });
}

export function decideCandidatePromotion(input: {
  readonly candidate: OptimizationCandidate;
  readonly currentTargetRevision: number;
  readonly evaluation: EvaluationRunResult;
  readonly regression: EvaluationRegressionComparison;
  readonly policy: PromotionGatePolicy;
  readonly review: PromotionReview;
}): CandidatePromotionDecision {
  const candidate = normalizeOptimizationCandidate(input.candidate);
  const review = normalizePromotionReview(input.review);
  const currentTargetRevision = positive(
    input.currentTargetRevision,
    "currentTargetRevision",
  );
  const minCases = positive(input.policy.minCases, "minCases");
  const maxFailedCases = nonnegative(
    input.policy.maxFailedCases,
    "maxFailedCases",
  );

  if (typeof input.policy.requireZeroRegressions !== "boolean") {
    throw new TypeError("requireZeroRegressions must be boolean");
  }
  if (typeof input.policy.requireEvaluationPass !== "boolean") {
    throw new TypeError("requireEvaluationPass must be boolean");
  }

  const decision = (
    allowed: boolean,
    reason: CandidatePromotionDecision["reason"],
  ): CandidatePromotionDecision =>
    Object.freeze({
      allowed,
      reason,
      candidateId: candidate.candidateId,
      targetRef: candidate.targetRef,
      baselineRevision: candidate.baselineRevision,
      candidateRevision: candidate.candidateRevision,
    });

  if (currentTargetRevision !== candidate.baselineRevision) {
    return decision(false, "stale-baseline");
  }

  if (
    input.evaluation.datasetKey !== candidate.datasetKey ||
    input.evaluation.datasetVersion !== candidate.datasetVersion
  ) {
    return decision(false, "dataset-mismatch");
  }

  const caseCount =
    input.evaluation.passedCases + input.evaluation.failedCases;
  if (caseCount < minCases) {
    return decision(false, "insufficient-evidence");
  }

  if (
    input.evaluation.failedCases > maxFailedCases ||
    (input.policy.requireEvaluationPass && !input.evaluation.passed)
  ) {
    return decision(false, "evaluation-gate-failed");
  }

  if (
    input.policy.requireZeroRegressions &&
    (!input.regression.passed || input.regression.regressions.length > 0)
  ) {
    return decision(false, "regression-gate-failed");
  }

  if (review.decision !== "approve") {
    return decision(false, "review-denied");
  }

  return decision(true, "allowed");
}

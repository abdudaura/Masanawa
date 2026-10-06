import {
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  compareEvaluationRuns,
  type EvaluationRegressionComparison,
  type EvaluationRunResult,
} from "./evaluation.js";

export type OptimizationCandidateKind =
  | "prompt"
  | "policy"
  | "configuration"
  | "skill-guide"
  | "routing";

export type OptimizationCandidateState =
  | "proposed"
  | "evaluated"
  | "approved"
  | "promoted"
  | "rejected";

export interface OptimizationCandidateArtifact {
  readonly kind: OptimizationCandidateKind;
  readonly targetKey: string;
  readonly candidateVersion: string;
  readonly baseVersion: string;
  readonly contentHash: string;
}

export interface CandidatePromotionGatePolicy {
  readonly requireCandidateDatasetPass: boolean;
  readonly maximumRegressions: number;
  readonly minimumRecoveries: number;
}

export interface CandidateEvaluationEvidence {
  readonly datasetKey: string;
  readonly datasetVersion: string;
  readonly baselinePassed: boolean;
  readonly candidatePassed: boolean;
  readonly regressions: readonly string[];
  readonly recoveries: readonly string[];
  readonly unchangedFailures: readonly string[];
  readonly unchangedPasses: readonly string[];
  readonly gatePassed: boolean;
  readonly evidenceKey: string;
  readonly evaluatedAt: Instant;
}

export interface CandidateApprovalEvidence {
  readonly authorityContextId: string;
  readonly approvalKey: string;
  readonly approvedAt: Instant;
  readonly candidateContentHash: string;
  readonly datasetKey: string;
  readonly datasetVersion: string;
}

export interface OptimizationCandidate {
  readonly schemaVersion: 1;
  readonly candidateKey: string;
  readonly artifact: OptimizationCandidateArtifact;
  readonly state: OptimizationCandidateState;
  readonly revision: number;
  readonly proposedAt: Instant;
  readonly updatedAt: Instant;
  readonly evaluation: CandidateEvaluationEvidence | null;
  readonly approval: CandidateApprovalEvidence | null;
  readonly resolutionNote: string | null;
}

export interface CandidatePromotionRecord {
  readonly candidateKey: string;
  readonly targetKey: string;
  readonly kind: OptimizationCandidateKind;
  readonly candidateVersion: string;
  readonly baseVersion: string;
  readonly contentHash: string;
  readonly datasetKey: string;
  readonly datasetVersion: string;
  readonly evaluationEvidenceKey: string;
  readonly approvalKey: string;
  readonly approvedByAuthorityContextId: string;
  readonly promotedAt: Instant;
}

const stableKeyPattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function stableKey(value: string, name: string, max = 160): string {
  const normalized = bounded(value, name, 1, max).toLowerCase();
  if (!stableKeyPattern.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function semver(value: string, name: string): string {
  const normalized = bounded(value, name, 5, 64);
  if (!semverPattern.test(normalized)) {
    throw new TypeError(`${name} must use semantic version syntax`);
  }
  return normalized;
}

function hash(value: string, name: string): string {
  const normalized = bounded(value, name, 64, 64).toLowerCase();
  if (!sha256Pattern.test(normalized)) {
    throw new TypeError(`${name} must be SHA-256 hex`);
  }
  return normalized;
}

function positiveRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

function nonnegativeInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function candidateKind(value: OptimizationCandidateKind): OptimizationCandidateKind {
  if (
    value !== "prompt" &&
    value !== "policy" &&
    value !== "configuration" &&
    value !== "skill-guide" &&
    value !== "routing"
  ) {
    throw new TypeError("candidate artifact kind is invalid");
  }
  return value;
}

function candidateState(value: OptimizationCandidateState): OptimizationCandidateState {
  if (
    value !== "proposed" &&
    value !== "evaluated" &&
    value !== "approved" &&
    value !== "promoted" &&
    value !== "rejected"
  ) {
    throw new TypeError("candidate state is invalid");
  }
  return value;
}

function normalizeArtifact(
  input: OptimizationCandidateArtifact,
): OptimizationCandidateArtifact {
  return Object.freeze({
    kind: candidateKind(input.kind),
    targetKey: stableKey(input.targetKey, "artifact.targetKey"),
    candidateVersion: semver(input.candidateVersion, "artifact.candidateVersion"),
    baseVersion: semver(input.baseVersion, "artifact.baseVersion"),
    contentHash: hash(input.contentHash, "artifact.contentHash"),
  });
}

function normalizeGatePolicy(
  input: CandidatePromotionGatePolicy,
): CandidatePromotionGatePolicy {
  if (typeof input.requireCandidateDatasetPass !== "boolean") {
    throw new TypeError("requireCandidateDatasetPass must be boolean");
  }
  return Object.freeze({
    requireCandidateDatasetPass: input.requireCandidateDatasetPass,
    maximumRegressions: nonnegativeInteger(
      input.maximumRegressions,
      "maximumRegressions",
      1000,
    ),
    minimumRecoveries: nonnegativeInteger(
      input.minimumRecoveries,
      "minimumRecoveries",
      1000,
    ),
  });
}

function normalizeEvaluation(
  input: CandidateEvaluationEvidence,
): CandidateEvaluationEvidence {
  const regressions = Object.freeze(
    [...input.regressions].map((value) => stableKey(value, "regression caseId", 128)).sort(),
  );
  const recoveries = Object.freeze(
    [...input.recoveries].map((value) => stableKey(value, "recovery caseId", 128)).sort(),
  );
  const unchangedFailures = Object.freeze(
    [...input.unchangedFailures]
      .map((value) => stableKey(value, "unchanged failure caseId", 128))
      .sort(),
  );
  const unchangedPasses = Object.freeze(
    [...input.unchangedPasses]
      .map((value) => stableKey(value, "unchanged pass caseId", 128))
      .sort(),
  );
  const all = [
    ...regressions,
    ...recoveries,
    ...unchangedFailures,
    ...unchangedPasses,
  ];
  if (new Set(all).size !== all.length) {
    throw new Error("evaluation case classifications must be disjoint");
  }
  if (
    typeof input.baselinePassed !== "boolean" ||
    typeof input.candidatePassed !== "boolean" ||
    typeof input.gatePassed !== "boolean"
  ) {
    throw new TypeError("evaluation boolean evidence is invalid");
  }
  return Object.freeze({
    datasetKey: stableKey(input.datasetKey, "datasetKey"),
    datasetVersion: semver(input.datasetVersion, "datasetVersion"),
    baselinePassed: input.baselinePassed,
    candidatePassed: input.candidatePassed,
    regressions,
    recoveries,
    unchangedFailures,
    unchangedPasses,
    gatePassed: input.gatePassed,
    evidenceKey: stableKey(input.evidenceKey, "evidenceKey"),
    evaluatedAt: toInstant(input.evaluatedAt),
  });
}

function normalizeApproval(
  input: CandidateApprovalEvidence,
): CandidateApprovalEvidence {
  return Object.freeze({
    authorityContextId: parseCanonicalId(
      "authority-context",
      input.authorityContextId,
    ),
    approvalKey: stableKey(input.approvalKey, "approvalKey"),
    approvedAt: toInstant(input.approvedAt),
    candidateContentHash: hash(
      input.candidateContentHash,
      "approval.candidateContentHash",
    ),
    datasetKey: stableKey(input.datasetKey, "approval.datasetKey"),
    datasetVersion: semver(input.datasetVersion, "approval.datasetVersion"),
  });
}

export function normalizeOptimizationCandidate(
  input: OptimizationCandidate,
): OptimizationCandidate {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported optimization candidate schemaVersion");
  }
  const proposedAt = toInstant(input.proposedAt);
  const updatedAt = toInstant(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(proposedAt)) {
    throw new Error("updatedAt cannot precede proposedAt");
  }
  const state = candidateState(input.state);
  const evaluation =
    input.evaluation === null ? null : normalizeEvaluation(input.evaluation);
  const approval =
    input.approval === null ? null : normalizeApproval(input.approval);
  const resolutionNote =
    input.resolutionNote === null
      ? null
      : bounded(input.resolutionNote, "resolutionNote", 1, 1000);

  if (state === "proposed") {
    if (evaluation !== null || approval !== null || resolutionNote !== null) {
      throw new Error("proposed candidate cannot carry evaluation or resolution evidence");
    }
  }
  if (state === "evaluated") {
    if (evaluation === null || approval !== null || resolutionNote !== null) {
      throw new Error("evaluated candidate lifecycle is inconsistent");
    }
  }
  if (state === "approved") {
    if (evaluation === null || approval === null || !evaluation.gatePassed) {
      throw new Error("approved candidate requires passed evaluation and approval");
    }
    if (resolutionNote !== null) {
      throw new Error("approved candidate cannot carry resolutionNote");
    }
  }
  if (state === "promoted") {
    if (evaluation === null || approval === null || !evaluation.gatePassed) {
      throw new Error("promoted candidate requires passed evaluation and approval");
    }
  }
  if (state === "rejected") {
    if (resolutionNote === null) {
      throw new Error("rejected candidate requires resolutionNote");
    }
  }

  const artifact = normalizeArtifact(input.artifact);
  if (approval !== null) {
    if (
      approval.candidateContentHash !== artifact.contentHash ||
      evaluation === null ||
      approval.datasetKey !== evaluation.datasetKey ||
      approval.datasetVersion !== evaluation.datasetVersion ||
      Date.parse(approval.approvedAt) < Date.parse(evaluation.evaluatedAt)
    ) {
      throw new Error("approval evidence does not match evaluated candidate");
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    candidateKey: stableKey(input.candidateKey, "candidateKey"),
    artifact,
    state,
    revision: positiveRevision(input.revision),
    proposedAt,
    updatedAt,
    evaluation,
    approval,
    resolutionNote,
  });
}

export function createOptimizationCandidate(input: {
  readonly candidateKey: string;
  readonly artifact: OptimizationCandidateArtifact;
  readonly proposedAt: Instant;
}): OptimizationCandidate {
  return normalizeOptimizationCandidate({
    schemaVersion: 1,
    candidateKey: input.candidateKey,
    artifact: input.artifact,
    state: "proposed",
    revision: 1,
    proposedAt: input.proposedAt,
    updatedAt: input.proposedAt,
    evaluation: null,
    approval: null,
    resolutionNote: null,
  });
}

function comparisonGate(input: {
  readonly comparison: EvaluationRegressionComparison;
  readonly candidate: EvaluationRunResult;
  readonly policy: CandidatePromotionGatePolicy;
}): boolean {
  return (
    input.comparison.regressions.length <= input.policy.maximumRegressions &&
    input.comparison.recoveries.length >= input.policy.minimumRecoveries &&
    (!input.policy.requireCandidateDatasetPass || input.candidate.passed)
  );
}

export function evaluateOptimizationCandidate(input: {
  readonly candidate: OptimizationCandidate;
  readonly expectedRevision: number;
  readonly baseline: EvaluationRunResult;
  readonly candidateRun: EvaluationRunResult;
  readonly gatePolicy?: CandidatePromotionGatePolicy;
  readonly evidenceKey: string;
  readonly evaluatedAt: Instant;
}): OptimizationCandidate {
  const current = normalizeOptimizationCandidate(input.candidate);
  if (current.state !== "proposed") {
    throw new Error("only proposed candidates may be evaluated");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("optimization candidate revision is stale");
  }

  const comparison = compareEvaluationRuns({
    baseline: input.baseline,
    candidate: input.candidateRun,
  });
  const policy = normalizeGatePolicy(
    input.gatePolicy ?? {
      requireCandidateDatasetPass: true,
      maximumRegressions: 0,
      minimumRecoveries: 0,
    },
  );
  const evaluatedAt = toInstant(input.evaluatedAt);
  if (Date.parse(evaluatedAt) < Date.parse(current.updatedAt)) {
    throw new Error("evaluatedAt cannot precede current candidate state");
  }

  const evaluation = normalizeEvaluation({
    datasetKey: input.candidateRun.datasetKey,
    datasetVersion: input.candidateRun.datasetVersion,
    baselinePassed: input.baseline.passed,
    candidatePassed: input.candidateRun.passed,
    regressions: comparison.regressions,
    recoveries: comparison.recoveries,
    unchangedFailures: comparison.unchangedFailures,
    unchangedPasses: comparison.unchangedPasses,
    gatePassed: comparisonGate({
      comparison,
      candidate: input.candidateRun,
      policy,
    }),
    evidenceKey: input.evidenceKey,
    evaluatedAt,
  });

  return normalizeOptimizationCandidate({
    ...current,
    state: "evaluated",
    revision: current.revision + 1,
    updatedAt: evaluatedAt,
    evaluation,
  });
}

export function approveOptimizationCandidate(input: {
  readonly candidate: OptimizationCandidate;
  readonly expectedRevision: number;
  readonly approval: CandidateApprovalEvidence;
}): OptimizationCandidate {
  const current = normalizeOptimizationCandidate(input.candidate);
  if (current.state !== "evaluated" || current.evaluation === null) {
    throw new Error("only evaluated candidates may be approved");
  }
  if (!current.evaluation.gatePassed) {
    throw new Error("candidate failed promotion gate");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("optimization candidate revision is stale");
  }

  const approval = normalizeApproval(input.approval);
  if (
    approval.candidateContentHash !== current.artifact.contentHash ||
    approval.datasetKey !== current.evaluation.datasetKey ||
    approval.datasetVersion !== current.evaluation.datasetVersion ||
    Date.parse(approval.approvedAt) < Date.parse(current.evaluation.evaluatedAt)
  ) {
    throw new Error("approval evidence does not match evaluated candidate");
  }

  return normalizeOptimizationCandidate({
    ...current,
    state: "approved",
    revision: current.revision + 1,
    updatedAt: approval.approvedAt,
    approval,
  });
}

export function promoteOptimizationCandidate(input: {
  readonly candidate: OptimizationCandidate;
  readonly expectedRevision: number;
  readonly promotedAt: Instant;
}): Readonly<{
  candidate: OptimizationCandidate;
  promotion: CandidatePromotionRecord;
}> {
  const current = normalizeOptimizationCandidate(input.candidate);
  if (
    current.state !== "approved" ||
    current.evaluation === null ||
    current.approval === null
  ) {
    throw new Error("only approved candidates may be promoted");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("optimization candidate revision is stale");
  }
  const promotedAt = toInstant(input.promotedAt);
  if (Date.parse(promotedAt) < Date.parse(current.updatedAt)) {
    throw new Error("promotedAt cannot precede approval");
  }

  const candidate = normalizeOptimizationCandidate({
    ...current,
    state: "promoted",
    revision: current.revision + 1,
    updatedAt: promotedAt,
  });
  const promotion: CandidatePromotionRecord = Object.freeze({
    candidateKey: candidate.candidateKey,
    targetKey: candidate.artifact.targetKey,
    kind: candidate.artifact.kind,
    candidateVersion: candidate.artifact.candidateVersion,
    baseVersion: candidate.artifact.baseVersion,
    contentHash: candidate.artifact.contentHash,
    datasetKey: candidate.evaluation!.datasetKey,
    datasetVersion: candidate.evaluation!.datasetVersion,
    evaluationEvidenceKey: candidate.evaluation!.evidenceKey,
    approvalKey: candidate.approval!.approvalKey,
    approvedByAuthorityContextId: candidate.approval!.authorityContextId,
    promotedAt,
  });

  return Object.freeze({ candidate, promotion });
}

export function rejectOptimizationCandidate(input: {
  readonly candidate: OptimizationCandidate;
  readonly expectedRevision: number;
  readonly rejectedAt: Instant;
  readonly note: string;
}): OptimizationCandidate {
  const current = normalizeOptimizationCandidate(input.candidate);
  if (current.state === "promoted" || current.state === "rejected") {
    throw new Error("terminal candidate cannot be rejected again");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("optimization candidate revision is stale");
  }
  const rejectedAt = toInstant(input.rejectedAt);
  if (Date.parse(rejectedAt) < Date.parse(current.updatedAt)) {
    throw new Error("rejectedAt cannot precede current candidate state");
  }
  return normalizeOptimizationCandidate({
    ...current,
    state: "rejected",
    revision: current.revision + 1,
    updatedAt: rejectedAt,
    resolutionNote: bounded(input.note, "resolutionNote", 1, 1000),
  });
}

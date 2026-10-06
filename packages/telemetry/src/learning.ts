import {
  compareEvaluationRuns,
  type EvaluationRunResult,
} from "./evaluation.js";

export type LearningCandidateTargetKind = "prompt" | "strategy" | "skill";
export type LearningCandidateState =
  | "proposed"
  | "evaluating"
  | "eligible"
  | "rejected";

export interface LearningCandidate {
  readonly schemaVersion: 1;
  readonly candidateKey: string;
  readonly targetKind: LearningCandidateTargetKind;
  readonly targetKey: string;
  readonly baseVersion: string;
  readonly contentHash: string;
  readonly sourceEvidenceHashes: readonly string[];
  readonly state: LearningCandidateState;
  readonly revision: number;
  readonly rejectionReasons: readonly string[];
}

export interface LearningGateEvidence {
  readonly kind: "certification" | "rehearsal";
  readonly candidateFingerprint: string;
  readonly contentHash: string;
  readonly evidenceHash: string;
  readonly passed: boolean;
  readonly revision: number;
}

export interface LearningPromotionProposal {
  readonly candidateKey: string;
  readonly candidateFingerprint: string;
  readonly targetKind: LearningCandidateTargetKind;
  readonly targetKey: string;
  readonly baseVersion: string;
  readonly contentHash: string;
  readonly evaluationDatasetKey: string;
  readonly evaluationDatasetVersion: string;
  readonly certificationEvidenceHash: string;
  readonly rehearsalEvidenceHash: string;
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

function bounded(value: string, name: string, min: number, max: number): string {
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

function key(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 160).toLowerCase();
  if (!keyPattern.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function version(value: string): string {
  const normalized = bounded(value, "baseVersion", 5, 64);
  if (!versionPattern.test(normalized)) {
    throw new TypeError("baseVersion must use semantic version syntax");
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

function positiveRevision(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function targetKind(value: LearningCandidateTargetKind): LearningCandidateTargetKind {
  if (value !== "prompt" && value !== "strategy" && value !== "skill") {
    throw new TypeError("Learning candidate targetKind is invalid");
  }
  return value;
}

export function learningCandidateFingerprint(input: {
  readonly targetKind: LearningCandidateTargetKind;
  readonly targetKey: string;
  readonly baseVersion: string;
  readonly contentHash: string;
}): string {
  return [
    targetKind(input.targetKind),
    encodeURIComponent(key(input.targetKey, "targetKey")),
    version(input.baseVersion),
    hash(input.contentHash, "contentHash"),
  ].join(":");
}

export function normalizeLearningCandidate(
  input: LearningCandidate,
): LearningCandidate {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported LearningCandidate schemaVersion");
  }
  if (
    input.state !== "proposed" &&
    input.state !== "evaluating" &&
    input.state !== "eligible" &&
    input.state !== "rejected"
  ) {
    throw new TypeError("Learning candidate state is invalid");
  }
  if (
    !Array.isArray(input.sourceEvidenceHashes) ||
    input.sourceEvidenceHashes.length < 1 ||
    input.sourceEvidenceHashes.length > 64
  ) {
    throw new RangeError("Learning candidate source evidence is invalid");
  }
  const sourceEvidenceHashes = input.sourceEvidenceHashes
    .map((value) => hash(value, "sourceEvidenceHash"))
    .sort();
  if (new Set(sourceEvidenceHashes).size !== sourceEvidenceHashes.length) {
    throw new Error("Learning candidate source evidence contains duplicates");
  }

  const rejectionReasons = input.rejectionReasons
    .map((value) => key(value, "rejectionReason"))
    .sort();
  if (new Set(rejectionReasons).size !== rejectionReasons.length) {
    throw new Error("Learning candidate rejection reasons contain duplicates");
  }
  if (input.state === "rejected" && rejectionReasons.length < 1) {
    throw new Error("Rejected Learning candidate requires a reason");
  }
  if (input.state !== "rejected" && rejectionReasons.length !== 0) {
    throw new Error("Only rejected Learning candidate may contain reasons");
  }

  return Object.freeze({
    schemaVersion: 1,
    candidateKey: key(input.candidateKey, "candidateKey"),
    targetKind: targetKind(input.targetKind),
    targetKey: key(input.targetKey, "targetKey"),
    baseVersion: version(input.baseVersion),
    contentHash: hash(input.contentHash, "contentHash"),
    sourceEvidenceHashes: Object.freeze(sourceEvidenceHashes),
    state: input.state,
    revision: positiveRevision(input.revision, "candidate.revision"),
    rejectionReasons: Object.freeze(rejectionReasons),
  });
}

export function beginLearningCandidateEvaluation(input: {
  readonly current: LearningCandidate;
  readonly expectedRevision: number;
}): LearningCandidate {
  const current = normalizeLearningCandidate(input.current);
  if (
    current.revision !==
    positiveRevision(input.expectedRevision, "expectedRevision")
  ) {
    throw new Error("Learning candidate revision is stale");
  }
  if (current.state !== "proposed") {
    throw new Error("Only proposed Learning candidate can enter evaluation");
  }
  return Object.freeze({
    ...current,
    state: "evaluating" as const,
    revision: current.revision + 1,
  });
}

export function normalizeLearningGateEvidence(
  input: LearningGateEvidence,
): LearningGateEvidence {
  if (input.kind !== "certification" && input.kind !== "rehearsal") {
    throw new TypeError("Learning gate evidence kind is invalid");
  }
  return Object.freeze({
    kind: input.kind,
    candidateFingerprint: bounded(
      input.candidateFingerprint,
      "candidateFingerprint",
      10,
      512,
    ),
    contentHash: hash(input.contentHash, "evidence.contentHash"),
    evidenceHash: hash(input.evidenceHash, "evidenceHash"),
    passed: input.passed === true,
    revision: positiveRevision(input.revision, "evidence.revision"),
  });
}

function exactGateEvidence(input: {
  readonly candidate: LearningCandidate;
  readonly evidence: LearningGateEvidence;
  readonly kind: LearningGateEvidence["kind"];
}): LearningGateEvidence {
  const evidence = normalizeLearningGateEvidence(input.evidence);
  const fingerprint = learningCandidateFingerprint(input.candidate);
  if (
    evidence.kind !== input.kind ||
    evidence.candidateFingerprint !== fingerprint ||
    evidence.contentHash !== input.candidate.contentHash
  ) {
    throw new Error(
      `Learning ${input.kind} evidence is not bound to the current candidate`,
    );
  }
  return evidence;
}

export function assessLearningCandidatePromotion(input: {
  readonly current: LearningCandidate;
  readonly expectedRevision: number;
  readonly baselineEvaluation: EvaluationRunResult;
  readonly candidateEvaluation: EvaluationRunResult;
  readonly certification: LearningGateEvidence;
  readonly rehearsal: LearningGateEvidence;
}): {
  readonly candidate: LearningCandidate;
  readonly proposal: LearningPromotionProposal | null;
} {
  const current = normalizeLearningCandidate(input.current);
  if (
    current.revision !==
    positiveRevision(input.expectedRevision, "expectedRevision")
  ) {
    throw new Error("Learning candidate revision is stale");
  }
  if (current.state !== "evaluating") {
    throw new Error("Learning candidate is not awaiting promotion assessment");
  }

  const certification = exactGateEvidence({
    candidate: current,
    evidence: input.certification,
    kind: "certification",
  });
  const rehearsal = exactGateEvidence({
    candidate: current,
    evidence: input.rehearsal,
    kind: "rehearsal",
  });
  const comparison = compareEvaluationRuns({
    baseline: input.baselineEvaluation,
    candidate: input.candidateEvaluation,
  });

  const rejectionReasons: string[] = [];
  if (!input.candidateEvaluation.passed) {
    rejectionReasons.push("candidate-evaluation-failed");
  }
  if (!comparison.passed) {
    rejectionReasons.push("evaluation-regression");
  }
  if (!certification.passed) {
    rejectionReasons.push("certification-failed");
  }
  if (!rehearsal.passed) {
    rejectionReasons.push("rehearsal-failed");
  }

  if (rejectionReasons.length > 0) {
    return Object.freeze({
      candidate: Object.freeze({
        ...current,
        state: "rejected" as const,
        revision: current.revision + 1,
        rejectionReasons: Object.freeze([...new Set(rejectionReasons)].sort()),
      }),
      proposal: null,
    });
  }

  const candidate = Object.freeze({
    ...current,
    state: "eligible" as const,
    revision: current.revision + 1,
    rejectionReasons: Object.freeze([]),
  });
  const proposal = Object.freeze({
    candidateKey: current.candidateKey,
    candidateFingerprint: learningCandidateFingerprint(current),
    targetKind: current.targetKind,
    targetKey: current.targetKey,
    baseVersion: current.baseVersion,
    contentHash: current.contentHash,
    evaluationDatasetKey: input.candidateEvaluation.datasetKey,
    evaluationDatasetVersion: input.candidateEvaluation.datasetVersion,
    certificationEvidenceHash: certification.evidenceHash,
    rehearsalEvidenceHash: rehearsal.evidenceHash,
  });
  return Object.freeze({ candidate, proposal });
}

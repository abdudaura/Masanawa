import { describe, expect, it } from "vitest";
import {
  assessLearningCandidatePromotion,
  beginLearningCandidateEvaluation,
  learningCandidateFingerprint,
  type LearningCandidate,
} from "./learning.js";
import type { EvaluationRunResult } from "./evaluation.js";

const contentHash = "a".repeat(64);
const evidenceHash = "b".repeat(64);

function candidate(): LearningCandidate {
  return {
    schemaVersion: 1,
    candidateKey: "candidate.core.prompt",
    targetKind: "prompt",
    targetKey: "agent.core.system-prompt",
    baseVersion: "1.0.0",
    contentHash,
    sourceEvidenceHashes: [evidenceHash],
    state: "proposed",
    revision: 1,
    rejectionReasons: [],
  };
}

function run(passed: boolean): EvaluationRunResult {
  return {
    datasetKey: "agent.core.regression",
    datasetVersion: "1.0.0",
    passed,
    passedCases: passed ? 1 : 0,
    failedCases: passed ? 0 : 1,
    results: [
      {
        caseId: "case.one",
        passed,
        failures: passed
          ? []
          : [
              {
                code: "missing-required-tag",
                detail: "completed",
              },
            ],
        observation: {
          tags: passed ? ["completed"] : [],
          latencyMs: 10,
          costMicros: 10,
          outputFingerprint: "c".repeat(64),
        },
      },
    ],
  };
}

function gate(
  current: LearningCandidate,
  kind: "certification" | "rehearsal",
  passed = true,
) {
  return {
    kind,
    candidateFingerprint: learningCandidateFingerprint(current),
    contentHash: current.contentHash,
    evidenceHash:
      kind === "certification" ? "d".repeat(64) : "e".repeat(64),
    passed,
    revision: 1,
  } as const;
}

describe("governed learning promotion", () => {
  it("moves proposed candidate into evaluation with stale-revision protection", () => {
    const evaluating = beginLearningCandidateEvaluation({
      current: candidate(),
      expectedRevision: 1,
    });
    expect(evaluating).toMatchObject({
      state: "evaluating",
      revision: 2,
    });
    expect(() =>
      beginLearningCandidateEvaluation({
        current: candidate(),
        expectedRevision: 2,
      }),
    ).toThrow("stale");
  });

  it("emits only a promotion proposal after all independent gates pass", () => {
    const evaluating = beginLearningCandidateEvaluation({
      current: candidate(),
      expectedRevision: 1,
    });
    const result = assessLearningCandidatePromotion({
      current: evaluating,
      expectedRevision: 2,
      baselineEvaluation: run(true),
      candidateEvaluation: run(true),
      certification: gate(evaluating, "certification"),
      rehearsal: gate(evaluating, "rehearsal"),
    });

    expect(result.candidate.state).toBe("eligible");
    expect(result.proposal).toMatchObject({
      candidateKey: evaluating.candidateKey,
      contentHash,
      evaluationDatasetKey: "agent.core.regression",
      certificationEvidenceHash: "d".repeat(64),
      rehearsalEvidenceHash: "e".repeat(64),
    });
    expect(result.proposal).not.toHaveProperty("published");
    expect(result.proposal).not.toHaveProperty("authority");
  });

  it("rejects a candidate on regression, failed certification or failed rehearsal", () => {
    const evaluating = beginLearningCandidateEvaluation({
      current: candidate(),
      expectedRevision: 1,
    });

    const regression = assessLearningCandidatePromotion({
      current: evaluating,
      expectedRevision: 2,
      baselineEvaluation: run(true),
      candidateEvaluation: run(false),
      certification: gate(evaluating, "certification"),
      rehearsal: gate(evaluating, "rehearsal"),
    });
    expect(regression.proposal).toBeNull();
    expect(regression.candidate.rejectionReasons).toEqual([
      "candidate-evaluation-failed",
      "evaluation-regression",
    ]);

    const certification = assessLearningCandidatePromotion({
      current: evaluating,
      expectedRevision: 2,
      baselineEvaluation: run(true),
      candidateEvaluation: run(true),
      certification: gate(evaluating, "certification", false),
      rehearsal: gate(evaluating, "rehearsal"),
    });
    expect(certification.candidate.rejectionReasons).toEqual([
      "certification-failed",
    ]);

    const rehearsal = assessLearningCandidatePromotion({
      current: evaluating,
      expectedRevision: 2,
      baselineEvaluation: run(true),
      candidateEvaluation: run(true),
      certification: gate(evaluating, "certification"),
      rehearsal: gate(evaluating, "rehearsal", false),
    });
    expect(rehearsal.candidate.rejectionReasons).toEqual([
      "rehearsal-failed",
    ]);
  });

  it("fails closed when gate evidence is for different candidate content", () => {
    const evaluating = beginLearningCandidateEvaluation({
      current: candidate(),
      expectedRevision: 1,
    });
    expect(() =>
      assessLearningCandidatePromotion({
        current: evaluating,
        expectedRevision: 2,
        baselineEvaluation: run(true),
        candidateEvaluation: run(true),
        certification: {
          ...gate(evaluating, "certification"),
          contentHash: "f".repeat(64),
        },
        rehearsal: gate(evaluating, "rehearsal"),
      }),
    ).toThrow("not bound");
  });

  it("does not allow rejected/eligible candidates to be reassessed silently", () => {
    const evaluating = beginLearningCandidateEvaluation({
      current: candidate(),
      expectedRevision: 1,
    });
    const rejected = assessLearningCandidatePromotion({
      current: evaluating,
      expectedRevision: 2,
      baselineEvaluation: run(true),
      candidateEvaluation: run(true),
      certification: gate(evaluating, "certification", false),
      rehearsal: gate(evaluating, "rehearsal"),
    }).candidate;

    expect(() =>
      assessLearningCandidatePromotion({
        current: rejected,
        expectedRevision: rejected.revision,
        baselineEvaluation: run(true),
        candidateEvaluation: run(true),
        certification: gate(rejected, "certification"),
        rehearsal: gate(rejected, "rehearsal"),
      }),
    ).toThrow("not awaiting");
  });
});

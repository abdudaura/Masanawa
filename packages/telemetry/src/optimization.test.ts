import { describe, expect, it } from "vitest";
import {
  approveOptimizationCandidate,
  createOptimizationCandidate,
  evaluateOptimizationCandidate,
  promoteOptimizationCandidate,
  rejectOptimizationCandidate,
} from "./optimization.js";
import type { EvaluationRunResult } from "./evaluation.js";

const hash = "a".repeat(64);
const authorityContextId =
  "authority-context_0199f0a0-0000-7000-8000-000000000001";

function run(input: {
  readonly fastPass: boolean;
  readonly safePass: boolean;
}): EvaluationRunResult {
  const results = [
    {
      caseId: "case.fast",
      passed: input.fastPass,
      failures: [],
      observation: {
        tags: input.fastPass ? ["safe"] : [],
        latencyMs: 10,
        costMicros: 10,
        outputFingerprint: "b".repeat(64),
      },
    },
    {
      caseId: "case.safe",
      passed: input.safePass,
      failures: [],
      observation: {
        tags: input.safePass ? ["safe"] : [],
        latencyMs: 10,
        costMicros: 10,
        outputFingerprint: "c".repeat(64),
      },
    },
  ];
  const failedCases = results.filter((item) => !item.passed).length;
  return {
    datasetKey: "agent.core.regression",
    datasetVersion: "1.0.0",
    passed: failedCases === 0,
    passedCases: results.length - failedCases,
    failedCases,
    results,
  };
}

function proposed() {
  return createOptimizationCandidate({
    candidateKey: "agent.core.prompt.candidate-2",
    artifact: {
      kind: "prompt",
      targetKey: "agent.core.prompt",
      candidateVersion: "2.0.0",
      baseVersion: "1.0.0",
      contentHash: hash,
    },
    proposedAt: "2026-10-06T18:00:00.000Z",
  });
}

describe("candidate optimization promotion gates", () => {
  it("records a passed evaluation but does not self-promote or self-approve", () => {
    const candidate = evaluateOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      baseline: run({ fastPass: true, safePass: true }),
      candidateRun: run({ fastPass: true, safePass: true }),
      evidenceKey: "eval.agent-core.candidate-2",
      evaluatedAt: "2026-10-06T18:01:00.000Z",
    });

    expect(candidate).toMatchObject({
      state: "evaluated",
      revision: 2,
      evaluation: {
        gatePassed: true,
        regressions: [],
      },
      approval: null,
    });
    expect(JSON.stringify(candidate)).not.toContain("promotedAt");
  });

  it("blocks a newly regressing candidate under the zero-regression default", () => {
    const candidate = evaluateOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      baseline: run({ fastPass: true, safePass: true }),
      candidateRun: run({ fastPass: false, safePass: true }),
      evidenceKey: "eval.regressing",
      evaluatedAt: "2026-10-06T18:01:00.000Z",
    });

    expect(candidate.evaluation).toMatchObject({
      gatePassed: false,
      regressions: ["case.fast"],
    });
    expect(() =>
      approveOptimizationCandidate({
        candidate,
        expectedRevision: 2,
        approval: {
          authorityContextId,
          approvalKey: "approval.regressing",
          approvedAt: "2026-10-06T18:02:00.000Z",
          candidateContentHash: hash,
          datasetKey: "agent.core.regression",
          datasetVersion: "1.0.0",
        },
      }),
    ).toThrow("failed promotion gate");
  });

  it("can require recoveries in addition to zero regressions", () => {
    const candidate = evaluateOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      baseline: run({ fastPass: false, safePass: true }),
      candidateRun: run({ fastPass: true, safePass: true }),
      gatePolicy: {
        requireCandidateDatasetPass: true,
        maximumRegressions: 0,
        minimumRecoveries: 1,
      },
      evidenceKey: "eval.recovery",
      evaluatedAt: "2026-10-06T18:01:00.000Z",
    });

    expect(candidate.evaluation).toMatchObject({
      gatePassed: true,
      recoveries: ["case.fast"],
    });
  });

  it("requires explicit matching approval evidence after evaluation", () => {
    const evaluated = evaluateOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      baseline: run({ fastPass: true, safePass: true }),
      candidateRun: run({ fastPass: true, safePass: true }),
      evidenceKey: "eval.approval",
      evaluatedAt: "2026-10-06T18:01:00.000Z",
    });

    expect(() =>
      approveOptimizationCandidate({
        candidate: evaluated,
        expectedRevision: 2,
        approval: {
          authorityContextId,
          approvalKey: "approval.wrong-hash",
          approvedAt: "2026-10-06T18:02:00.000Z",
          candidateContentHash: "d".repeat(64),
          datasetKey: "agent.core.regression",
          datasetVersion: "1.0.0",
        },
      }),
    ).toThrow(/does not match evaluated candidate/);

    const approved = approveOptimizationCandidate({
      candidate: evaluated,
      expectedRevision: 2,
      approval: {
        authorityContextId,
        approvalKey: "approval.agent-core.candidate-2",
        approvedAt: "2026-10-06T18:02:00.000Z",
        candidateContentHash: hash,
        datasetKey: "agent.core.regression",
        datasetVersion: "1.0.0",
      },
    });
    expect(approved).toMatchObject({
      state: "approved",
      revision: 3,
    });
  });

  it("produces promotion evidence only after approval and never applies the artifact", () => {
    const evaluated = evaluateOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      baseline: run({ fastPass: true, safePass: true }),
      candidateRun: run({ fastPass: true, safePass: true }),
      evidenceKey: "eval.promote",
      evaluatedAt: "2026-10-06T18:01:00.000Z",
    });
    const approved = approveOptimizationCandidate({
      candidate: evaluated,
      expectedRevision: 2,
      approval: {
        authorityContextId,
        approvalKey: "approval.promote",
        approvedAt: "2026-10-06T18:02:00.000Z",
        candidateContentHash: hash,
        datasetKey: "agent.core.regression",
        datasetVersion: "1.0.0",
      },
    });

    const result = promoteOptimizationCandidate({
      candidate: approved,
      expectedRevision: 3,
      promotedAt: "2026-10-06T18:03:00.000Z",
    });

    expect(result.candidate).toMatchObject({
      state: "promoted",
      revision: 4,
    });
    expect(result.promotion).toEqual({
      candidateKey: "agent.core.prompt.candidate-2",
      targetKey: "agent.core.prompt",
      kind: "prompt",
      candidateVersion: "2.0.0",
      baseVersion: "1.0.0",
      contentHash: hash,
      datasetKey: "agent.core.regression",
      datasetVersion: "1.0.0",
      evaluationEvidenceKey: "eval.promote",
      approvalKey: "approval.promote",
      approvedByAuthorityContextId: authorityContextId,
      promotedAt: "2026-10-06T18:03:00.000Z",
    });
    expect(JSON.stringify(result.promotion)).not.toContain("payload");
    expect(JSON.stringify(result.promotion)).not.toContain("prompt text");
  });

  it("rejects stale lifecycle revisions", () => {
    expect(() =>
      evaluateOptimizationCandidate({
        candidate: proposed(),
        expectedRevision: 2,
        baseline: run({ fastPass: true, safePass: true }),
        candidateRun: run({ fastPass: true, safePass: true }),
        evidenceKey: "eval.stale",
        evaluatedAt: "2026-10-06T18:01:00.000Z",
      }),
    ).toThrow("revision is stale");
  });

  it("supports explicit rejection without promotion authority", () => {
    const rejected = rejectOptimizationCandidate({
      candidate: proposed(),
      expectedRevision: 1,
      rejectedAt: "2026-10-06T18:01:00.000Z",
      note: "Candidate is not suitable for production.",
    });

    expect(rejected).toMatchObject({
      state: "rejected",
      revision: 2,
      resolutionNote: "Candidate is not suitable for production.",
    });
    expect(() =>
      promoteOptimizationCandidate({
        candidate: rejected,
        expectedRevision: 2,
        promotedAt: "2026-10-06T18:02:00.000Z",
      }),
    ).toThrow("only approved candidates");
  });

  it("fails comparison when baseline and candidate use different datasets", () => {
    const candidateRun = {
      ...run({ fastPass: true, safePass: true }),
      datasetVersion: "2.0.0",
    };

    expect(() =>
      evaluateOptimizationCandidate({
        candidate: proposed(),
        expectedRevision: 1,
        baseline: run({ fastPass: true, safePass: true }),
        candidateRun,
        evidenceKey: "eval.dataset-mismatch",
        evaluatedAt: "2026-10-06T18:01:00.000Z",
      }),
    ).toThrow("same dataset");
  });
});

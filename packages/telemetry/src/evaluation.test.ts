import { describe, expect, it } from "vitest";
import {
  compareEvaluationRuns,
  evaluateCase,
  normalizeEvaluationDataset,
  runEvaluationDataset,
  type EvaluationDataset,
} from "./evaluation.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function dataset(): EvaluationDataset {
  return {
    schemaVersion: 1,
    key: "agent.core.regression",
    version: "1.0.0",
    description: "Core privacy-safe regression fixtures",
    cases: [
      {
        caseId: "case.fast-safe",
        source: { kind: "fixture", fixtureKey: "fast-safe" },
        evidenceHash: hashA,
        expectation: {
          requiredTags: ["safe", "completed"],
          forbiddenTags: ["privacy-leak"],
          maxLatencyMs: 500,
          maxCostMicros: 1000,
        },
      },
      {
        caseId: "case.no-side-effect",
        source: { kind: "fixture", fixtureKey: "no-side-effect" },
        evidenceHash: hashB,
        expectation: {
          requiredTags: ["rejected"],
          forbiddenTags: ["side-effect"],
          maxLatencyMs: null,
          maxCostMicros: null,
        },
      },
    ],
  };
}

describe("evaluation datasets and regression harness", () => {
  it("normalizes versioned datasets and rejects duplicate/contradictory expectations", () => {
    const normalized = normalizeEvaluationDataset(dataset());
    expect(normalized.cases.map((item) => item.caseId)).toEqual([
      "case.fast-safe",
      "case.no-side-effect",
    ]);

    expect(() =>
      normalizeEvaluationDataset({
        ...dataset(),
        cases: [dataset().cases[0]!, dataset().cases[0]!],
      }),
    ).toThrow("duplicate caseId");

    expect(() =>
      normalizeEvaluationDataset({
        ...dataset(),
        cases: [{
          ...dataset().cases[0]!,
          expectation: {
            ...dataset().cases[0]!.expectation,
            requiredTags: ["same"],
            forbiddenTags: ["same"],
          },
        }],
      }),
    ).toThrow("both required and forbidden");
  });

  it("evaluates required/forbidden tags and latency/cost ceilings deterministically", () => {
    const result = evaluateCase({
      evaluationCase: dataset().cases[0]!,
      observation: {
        tags: ["safe", "completed", "privacy-leak"],
        latencyMs: 650,
        costMicros: 1200,
        outputFingerprint: hashA,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      "forbidden-tag",
      "latency-regression",
      "cost-regression",
    ]);
  });

  it("runs the dataset in canonical case order and returns a bounded summary", async () => {
    const visited: string[] = [];
    const result = await runEvaluationDataset({
      dataset: dataset(),
      observe(evaluationCase) {
        visited.push(evaluationCase.caseId);
        if (evaluationCase.caseId === "case.fast-safe") {
          return {
            tags: ["completed", "safe"],
            latencyMs: 400,
            costMicros: 900,
            outputFingerprint: hashA,
          };
        }
        return {
          tags: ["rejected"],
          latencyMs: 100,
          costMicros: 0,
          outputFingerprint: hashB,
        };
      },
    });

    expect(visited).toEqual(["case.fast-safe", "case.no-side-effect"]);
    expect(result).toMatchObject({
      passed: true,
      passedCases: 2,
      failedCases: 0,
    });
  });

  it("classifies only newly failing cases as regressions", async () => {
    const baseline = await runEvaluationDataset({
      dataset: dataset(),
      observe(evaluationCase) {
        return evaluationCase.caseId === "case.fast-safe"
          ? {
              tags: ["completed", "safe"],
              latencyMs: 400,
              costMicros: 900,
              outputFingerprint: hashA,
            }
          : {
              tags: ["side-effect"],
              latencyMs: 100,
              costMicros: 0,
              outputFingerprint: hashB,
            };
      },
    });
    const candidate = await runEvaluationDataset({
      dataset: dataset(),
      observe(evaluationCase) {
        return evaluationCase.caseId === "case.fast-safe"
          ? {
              tags: ["safe"],
              latencyMs: 400,
              costMicros: 900,
              outputFingerprint: hashA,
            }
          : {
              tags: ["rejected"],
              latencyMs: 100,
              costMicros: 0,
              outputFingerprint: hashB,
            };
      },
    });

    expect(compareEvaluationRuns({ baseline, candidate })).toEqual({
      regressions: ["case.fast-safe"],
      recoveries: ["case.no-side-effect"],
      unchangedFailures: [],
      unchangedPasses: [],
      passed: false,
    });
  });

  it("rejects mismatched dataset versions/case sets before comparison", async () => {
    const baseline = await runEvaluationDataset({
      dataset: dataset(),
      observe() {
        return {
          tags: ["safe", "completed", "rejected"],
          latencyMs: 0,
          costMicros: 0,
          outputFingerprint: hashA,
        };
      },
    });

    expect(() =>
      compareEvaluationRuns({
        baseline,
        candidate: {
          ...baseline,
          datasetVersion: "2.0.0",
        },
      }),
    ).toThrow("same dataset");
  });
});

import {
  PlatformError,
  type MemoryRecordId,
} from "@masanawa/contracts";

export type MemoryEvaluationPartition = "development" | "held-out";

export interface MemoryRetrievalEvaluationCase {
  readonly caseId: string;
  readonly expectedRecordIds: readonly MemoryRecordId[];
  readonly forbiddenRecordIds: readonly MemoryRecordId[];
  readonly retrievedRecordIds: readonly MemoryRecordId[];
}

export interface MemoryRetrievalEvaluationSet {
  readonly name: string;
  readonly partition: MemoryEvaluationPartition;
  readonly cases: readonly MemoryRetrievalEvaluationCase[];
}

export interface MemoryRetrievalEvaluationSummary {
  readonly name: string;
  readonly partition: MemoryEvaluationPartition;
  readonly caseCount: number;
  readonly expectedRecordCount: number;
  readonly retrievedRecordCount: number;
  readonly relevantRetrievedCount: number;
  readonly forbiddenHitCount: number;
  readonly leakageCaseCount: number;
  readonly recall: number | null;
  readonly precision: number | null;
  readonly meanReciprocalRank: number | null;
  readonly privacyPass: boolean;
}

function boundedName(value: string, name: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function uniqueIds(
  values: readonly MemoryRecordId[],
  name: string,
): readonly MemoryRecordId[] {
  if (!Array.isArray(values)) {
    throw new TypeError(`${name} must be an array`);
  }
  const unique = [...new Set(values)];
  if (unique.length !== values.length) {
    throw new TypeError(`${name} must not contain duplicate MemoryRecord IDs`);
  }
  return Object.freeze(unique);
}

export function evaluateMemoryRetrieval(
  set: MemoryRetrievalEvaluationSet,
): MemoryRetrievalEvaluationSummary {
  const name = boundedName(set.name, "evaluation.name", 200);
  if (set.partition !== "development" && set.partition !== "held-out") {
    throw new TypeError("evaluation.partition is invalid");
  }
  if (!Array.isArray(set.cases) || set.cases.length < 1) {
    throw new RangeError("evaluation requires at least one case");
  }

  const caseIds = new Set<string>();
  let expectedRecordCount = 0;
  let retrievedRecordCount = 0;
  let relevantRetrievedCount = 0;
  let forbiddenHitCount = 0;
  let leakageCaseCount = 0;
  let reciprocalRankTotal = 0;
  let reciprocalRankCaseCount = 0;

  for (const current of set.cases) {
    const caseId = boundedName(current.caseId, "caseId", 200);
    if (caseIds.has(caseId)) {
      throw new TypeError("evaluation case IDs must be unique");
    }
    caseIds.add(caseId);

    const expected = uniqueIds(
      current.expectedRecordIds,
      "expectedRecordIds",
    );
    const forbidden = uniqueIds(
      current.forbiddenRecordIds,
      "forbiddenRecordIds",
    );
    const retrieved = uniqueIds(
      current.retrievedRecordIds,
      "retrievedRecordIds",
    );

    const expectedSet = new Set(expected);
    const forbiddenSet = new Set(forbidden);
    for (const memoryRecordId of expectedSet) {
      if (forbiddenSet.has(memoryRecordId)) {
        throw new TypeError(
          "a MemoryRecord cannot be both expected and forbidden in one case",
        );
      }
    }

    expectedRecordCount += expected.length;
    retrievedRecordCount += retrieved.length;

    let caseForbiddenHits = 0;
    let firstRelevantRank: number | null = null;
    for (let index = 0; index < retrieved.length; index += 1) {
      const memoryRecordId = retrieved[index]!;
      if (expectedSet.has(memoryRecordId)) {
        relevantRetrievedCount += 1;
        if (firstRelevantRank === null) {
          firstRelevantRank = index + 1;
        }
      }
      if (forbiddenSet.has(memoryRecordId)) {
        forbiddenHitCount += 1;
        caseForbiddenHits += 1;
      }
    }
    if (caseForbiddenHits > 0) {
      leakageCaseCount += 1;
    }

    if (expected.length > 0) {
      reciprocalRankCaseCount += 1;
      reciprocalRankTotal +=
        firstRelevantRank === null ? 0 : 1 / firstRelevantRank;
    }
  }

  return Object.freeze({
    name,
    partition: set.partition,
    caseCount: set.cases.length,
    expectedRecordCount,
    retrievedRecordCount,
    relevantRetrievedCount,
    forbiddenHitCount,
    leakageCaseCount,
    recall:
      expectedRecordCount === 0
        ? null
        : relevantRetrievedCount / expectedRecordCount,
    precision:
      retrievedRecordCount === 0
        ? null
        : relevantRetrievedCount / retrievedRecordCount,
    meanReciprocalRank:
      reciprocalRankCaseCount === 0
        ? null
        : reciprocalRankTotal / reciprocalRankCaseCount,
    privacyPass: forbiddenHitCount === 0,
  });
}

export function assertZeroMemoryRetrievalLeakage(
  summary: MemoryRetrievalEvaluationSummary,
): void {
  if (!summary.privacyPass) {
    throw new PlatformError({
      code: "memory.evaluation_privacy_leakage",
      category: "authorization",
      message:
        "Memory retrieval evaluation returned one or more forbidden records",
      retryable: false,
      details: {
        evaluation: summary.name,
        partition: summary.partition,
        forbiddenHitCount: summary.forbiddenHitCount,
        leakageCaseCount: summary.leakageCaseCount,
      },
    });
  }
}

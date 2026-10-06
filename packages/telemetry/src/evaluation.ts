import {
  isCanonicalId,
  type AgentRunId,
  type OperationId,
  type WorkflowRunId,
} from "@masanawa/contracts";

export type EvaluationSource =
  | { readonly kind: "agent-run"; readonly agentRunId: AgentRunId }
  | { readonly kind: "workflow-run"; readonly workflowRunId: WorkflowRunId }
  | { readonly kind: "operation"; readonly operationId: OperationId }
  | { readonly kind: "fixture"; readonly fixtureKey: string };

export interface EvaluationExpectation {
  readonly requiredTags: readonly string[];
  readonly forbiddenTags: readonly string[];
  readonly maxLatencyMs: number | null;
  readonly maxCostMicros: number | null;
}

export interface EvaluationCase {
  readonly caseId: string;
  readonly source: EvaluationSource;
  readonly evidenceHash: string;
  readonly expectation: EvaluationExpectation;
}

export interface EvaluationDataset {
  readonly schemaVersion: 1;
  readonly key: string;
  readonly version: string;
  readonly description: string | null;
  readonly cases: readonly EvaluationCase[];
}

export interface EvaluationObservation {
  readonly tags: readonly string[];
  readonly latencyMs: number;
  readonly costMicros: number;
  readonly outputFingerprint: string;
}

export interface EvaluationFailure {
  readonly code:
    | "missing-required-tag"
    | "forbidden-tag"
    | "latency-regression"
    | "cost-regression";
  readonly detail: string;
}

export interface EvaluationCaseResult {
  readonly caseId: string;
  readonly passed: boolean;
  readonly failures: readonly EvaluationFailure[];
  readonly observation: EvaluationObservation;
}

export interface EvaluationRunResult {
  readonly datasetKey: string;
  readonly datasetVersion: string;
  readonly passed: boolean;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly results: readonly EvaluationCaseResult[];
}

export interface EvaluationRegressionComparison {
  readonly regressions: readonly string[];
  readonly recoveries: readonly string[];
  readonly unchangedFailures: readonly string[];
  readonly unchangedPasses: readonly string[];
  readonly passed: boolean;
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function key(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 128).toLowerCase();
  if (!keyPattern.test(normalized)) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function version(value: string): string {
  const normalized = bounded(value, "dataset.version", 5, 64);
  if (!versionPattern.test(normalized)) {
    throw new TypeError("dataset.version must use semantic version syntax");
  }
  return normalized;
}

function metric(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function optionalMetric(value: number | null, name: string): number | null {
  return value === null ? null : metric(value, name);
}

function normalizeTags(values: readonly string[], name: string): readonly string[] {
  if (!Array.isArray(values) || values.length > 64) {
    throw new RangeError(`${name} exceeds its bound`);
  }
  const tags = values.map((value) => key(value, name)).sort();
  if (new Set(tags).size !== tags.length) {
    throw new Error(`${name} contains duplicates`);
  }
  return Object.freeze(tags);
}

function normalizeSource(input: EvaluationSource): EvaluationSource {
  switch (input.kind) {
    case "agent-run":
      if (!isCanonicalId("agent-run", input.agentRunId)) {
        throw new TypeError("evaluation agentRunId is invalid");
      }
      return Object.freeze({ kind: "agent-run", agentRunId: input.agentRunId });
    case "workflow-run":
      if (!isCanonicalId("workflow-run", input.workflowRunId)) {
        throw new TypeError("evaluation workflowRunId is invalid");
      }
      return Object.freeze({ kind: "workflow-run", workflowRunId: input.workflowRunId });
    case "operation":
      if (!isCanonicalId("operation", input.operationId)) {
        throw new TypeError("evaluation operationId is invalid");
      }
      return Object.freeze({ kind: "operation", operationId: input.operationId });
    case "fixture":
      return Object.freeze({
        kind: "fixture",
        fixtureKey: key(input.fixtureKey, "fixtureKey"),
      });
    default:
      throw new TypeError("evaluation source kind is invalid");
  }
}

export function normalizeEvaluationCase(input: EvaluationCase): EvaluationCase {
  const caseId = key(input.caseId, "caseId");
  const evidenceHash = bounded(input.evidenceHash, "evidenceHash", 64, 64).toLowerCase();
  if (!sha256Pattern.test(evidenceHash)) {
    throw new TypeError("evidenceHash must be SHA-256 hex");
  }

  const requiredTags = normalizeTags(
    input.expectation.requiredTags,
    "requiredTags",
  );
  const forbiddenTags = normalizeTags(
    input.expectation.forbiddenTags,
    "forbiddenTags",
  );
  if (requiredTags.some((tag) => forbiddenTags.includes(tag))) {
    throw new Error("A tag cannot be both required and forbidden");
  }

  return Object.freeze({
    caseId,
    source: normalizeSource(input.source),
    evidenceHash,
    expectation: Object.freeze({
      requiredTags,
      forbiddenTags,
      maxLatencyMs: optionalMetric(
        input.expectation.maxLatencyMs,
        "maxLatencyMs",
      ),
      maxCostMicros: optionalMetric(
        input.expectation.maxCostMicros,
        "maxCostMicros",
      ),
    }),
  });
}

export function normalizeEvaluationDataset(
  input: EvaluationDataset,
): EvaluationDataset {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported EvaluationDataset schemaVersion");
  }
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 1000) {
    throw new RangeError("EvaluationDataset must contain 1 to 1000 cases");
  }
  const cases = input.cases.map(normalizeEvaluationCase);
  const ids = cases.map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("EvaluationDataset contains duplicate caseId");
  }

  return Object.freeze({
    schemaVersion: 1,
    key: key(input.key, "dataset.key"),
    version: version(input.version),
    description:
      input.description === null
        ? null
        : bounded(input.description, "dataset.description", 1, 500),
    cases: Object.freeze([...cases].sort((a, b) => a.caseId.localeCompare(b.caseId))),
  });
}

export function normalizeEvaluationObservation(
  input: EvaluationObservation,
): EvaluationObservation {
  const outputFingerprint = bounded(
    input.outputFingerprint,
    "outputFingerprint",
    64,
    64,
  ).toLowerCase();
  if (!sha256Pattern.test(outputFingerprint)) {
    throw new TypeError("outputFingerprint must be SHA-256 hex");
  }
  return Object.freeze({
    tags: normalizeTags(input.tags, "observation.tags"),
    latencyMs: metric(input.latencyMs, "latencyMs"),
    costMicros: metric(input.costMicros, "costMicros"),
    outputFingerprint,
  });
}

export function evaluateCase(input: {
  readonly evaluationCase: EvaluationCase;
  readonly observation: EvaluationObservation;
}): EvaluationCaseResult {
  const evaluationCase = normalizeEvaluationCase(input.evaluationCase);
  const observation = normalizeEvaluationObservation(input.observation);
  const failures: EvaluationFailure[] = [];

  for (const tag of evaluationCase.expectation.requiredTags) {
    if (!observation.tags.includes(tag)) {
      failures.push(
        Object.freeze({
          code: "missing-required-tag" as const,
          detail: tag,
        }),
      );
    }
  }
  for (const tag of evaluationCase.expectation.forbiddenTags) {
    if (observation.tags.includes(tag)) {
      failures.push(
        Object.freeze({
          code: "forbidden-tag" as const,
          detail: tag,
        }),
      );
    }
  }
  const maxLatencyMs = evaluationCase.expectation.maxLatencyMs;
  if (maxLatencyMs !== null && observation.latencyMs > maxLatencyMs) {
    failures.push(
      Object.freeze({
        code: "latency-regression" as const,
        detail: `${observation.latencyMs}>${maxLatencyMs}`,
      }),
    );
  }
  const maxCostMicros = evaluationCase.expectation.maxCostMicros;
  if (maxCostMicros !== null && observation.costMicros > maxCostMicros) {
    failures.push(
      Object.freeze({
        code: "cost-regression" as const,
        detail: `${observation.costMicros}>${maxCostMicros}`,
      }),
    );
  }

  return Object.freeze({
    caseId: evaluationCase.caseId,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    observation,
  });
}

export async function runEvaluationDataset(input: {
  readonly dataset: EvaluationDataset;
  readonly observe: (
    evaluationCase: EvaluationCase,
  ) => Promise<EvaluationObservation> | EvaluationObservation;
}): Promise<EvaluationRunResult> {
  const dataset = normalizeEvaluationDataset(input.dataset);
  const results: EvaluationCaseResult[] = [];
  for (const evaluationCase of dataset.cases) {
    const observation = await input.observe(evaluationCase);
    results.push(
      evaluateCase({
        evaluationCase,
        observation,
      }),
    );
  }

  const failedCases = results.filter((result) => !result.passed).length;
  const passedCases = results.length - failedCases;
  return Object.freeze({
    datasetKey: dataset.key,
    datasetVersion: dataset.version,
    passed: failedCases === 0,
    passedCases,
    failedCases,
    results: Object.freeze(results),
  });
}

export function compareEvaluationRuns(input: {
  readonly baseline: EvaluationRunResult;
  readonly candidate: EvaluationRunResult;
}): EvaluationRegressionComparison {
  if (
    input.baseline.datasetKey !== input.candidate.datasetKey ||
    input.baseline.datasetVersion !== input.candidate.datasetVersion
  ) {
    throw new Error("Evaluation runs must use the same dataset key/version");
  }

  const baseline = new Map(
    input.baseline.results.map((result) => [result.caseId, result.passed] as const),
  );
  const candidate = new Map(
    input.candidate.results.map((result) => [result.caseId, result.passed] as const),
  );
  if (
    baseline.size !== candidate.size ||
    [...baseline.keys()].some((caseId) => !candidate.has(caseId))
  ) {
    throw new Error("Evaluation runs do not contain the same cases");
  }

  const regressions: string[] = [];
  const recoveries: string[] = [];
  const unchangedFailures: string[] = [];
  const unchangedPasses: string[] = [];
  for (const caseId of [...baseline.keys()].sort()) {
    const before = baseline.get(caseId)!;
    const after = candidate.get(caseId)!;
    if (before && !after) regressions.push(caseId);
    else if (!before && after) recoveries.push(caseId);
    else if (!before && !after) unchangedFailures.push(caseId);
    else unchangedPasses.push(caseId);
  }

  return Object.freeze({
    regressions: Object.freeze(regressions),
    recoveries: Object.freeze(recoveries),
    unchangedFailures: Object.freeze(unchangedFailures),
    unchangedPasses: Object.freeze(unchangedPasses),
    passed: regressions.length === 0,
  });
}

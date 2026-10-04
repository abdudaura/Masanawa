import {
  decisionLimits,
  type DecisionAnswer,
  type DecisionDefinition,
  type DecisionRequest,
  type DecisionResult,
  type DecisionTrace,
  type DecisionValue,
  type JevQuestion,
} from "./model.js";

const keyPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;
const versionPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*\.v[1-9][0-9]*$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function assertBoundedString(
  value: unknown,
  name: string,
  maxLength: number,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    fail(`${name} must be a non-empty string no longer than ${maxLength} characters`);
  }
}

function normalizeKey(value: unknown, name: string, maxLength: number): string {
  assertBoundedString(value, name, maxLength);
  if (!keyPattern.test(value)) {
    fail(`${name} must use a stable lowercase decision key format`);
  }
  return value;
}

function normalizeVersion(value: unknown): string {
  assertBoundedString(value, "schemaVersion", decisionLimits.maxVersionLength);
  if (!versionPattern.test(value)) {
    fail("schemaVersion must be a versioned decision key such as route.v1");
  }
  return value;
}

function normalizeFiniteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    fail(`${name} must be finite`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function normalizeValue(value: DecisionValue, depth: number, path: string): DecisionValue {
  if (depth > decisionLimits.maxDepth) {
    fail(`${path} exceeds maximum decision packet depth`);
  }
  if (
    value === null ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return normalizeFiniteNumber(value, path);
  }
  if (typeof value === "string") {
    if (value.length > decisionLimits.maxStringLength) {
      fail(`${path} exceeds maximum string length`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > decisionLimits.maxArrayItems) {
      fail(`${path} exceeds maximum array length`);
    }
    return Object.freeze(
      value.map((item, index) => normalizeValue(item, depth + 1, `${path}[${index}]`)),
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(`${path} must contain only plain JSON-like objects`);
    }
    const entries = Object.entries(value as Readonly<Record<string, DecisionValue>>);
    if (entries.length > decisionLimits.maxObjectKeys) {
      fail(`${path} exceeds maximum object key count`);
    }
    const normalized: Record<string, DecisionValue> = {};
    for (const [key, item] of entries.sort(([a], [b]) => compareKeys(a, b))) {
      normalizeKey(key, `${path} key`, decisionLimits.maxAnswerKeyLength);
      normalized[key] = normalizeValue(item, depth + 1, `${path}.${key}`);
    }
    return Object.freeze(normalized);
  }
  return fail(`${path} contains unsupported decision packet data`);
}

function normalizeQuestion(question: JevQuestion, name: string): JevQuestion {
  assertBoundedString(
    question.instructions,
    `${name}.instructions`,
    decisionLimits.maxInstructionsLength,
  );

  if (question.type === "choice") {
    const entries = Object.entries(question.criteria);
    if (entries.length < 2 || entries.length > decisionLimits.maxCriteriaPerQuestion) {
      fail(`${name}.criteria must contain between 2 and ${decisionLimits.maxCriteriaPerQuestion} choices`);
    }
    const criteria: Record<string, string> = {};
    for (const [key, description] of entries.sort(([a], [b]) => compareKeys(a, b))) {
      const normalizedKey = normalizeKey(key, `${name}.criteria key`, decisionLimits.maxAnswerKeyLength);
      assertBoundedString(
        description,
        `${name}.criteria.${normalizedKey}`,
        decisionLimits.maxInstructionsLength,
      );
      criteria[normalizedKey] = description;
    }
    return Object.freeze({
      type: "choice",
      instructions: question.instructions,
      criteria: Object.freeze(criteria),
    });
  }

  if (question.type === "noul") {
    const criteria = question.criteria
      ? Object.freeze({
          ...(question.criteria.true
            ? { true: boundedInstruction(question.criteria.true, `${name}.criteria.true`) }
            : {}),
          ...(question.criteria.false
            ? { false: boundedInstruction(question.criteria.false, `${name}.criteria.false`) }
            : {}),
        })
      : undefined;
    return Object.freeze({
      type: "noul",
      instructions: question.instructions,
      ...(criteria ? { criteria } : {}),
    });
  }

  const min = normalizeFiniteNumber(question.min, `${name}.min`);
  const max = normalizeFiniteNumber(question.max, `${name}.max`);
  if (min >= max) {
    fail(`${name} score range must have min < max`);
  }
  if (
    question.criteria.length === 0 ||
    question.criteria.length > decisionLimits.maxCriteriaPerQuestion
  ) {
    fail(`${name}.criteria must be bounded and non-empty`);
  }
  return Object.freeze({
    type: "score",
    instructions: question.instructions,
    min,
    max,
    criteria: Object.freeze(
      question.criteria.map((criterion, index) =>
        boundedInstruction(criterion, `${name}.criteria[${index}]`),
      ),
    ),
  });
}

function boundedInstruction(value: string, name: string): string {
  assertBoundedString(value, name, decisionLimits.maxInstructionsLength);
  return value;
}

export function createDecisionDefinition(
  input: DecisionDefinition,
): DecisionDefinition {
  const decisionClass = normalizeKey(
    input.decisionClass,
    "decisionClass",
    decisionLimits.maxClassLength,
  );
  const schemaVersion = normalizeVersion(input.schemaVersion);
  if (!schemaVersion.startsWith(`${decisionClass}.v`)) {
    fail("schemaVersion must be namespaced to decisionClass");
  }

  const entries = Object.entries(input.questions);
  if (entries.length === 0 || entries.length > decisionLimits.maxQuestions) {
    fail(`questions must contain between 1 and ${decisionLimits.maxQuestions} entries`);
  }
  const questions: Record<string, JevQuestion> = {};
  for (const [name, question] of entries.sort(([a], [b]) => compareKeys(a, b))) {
    const key = normalizeKey(name, "question key", decisionLimits.maxAnswerKeyLength);
    questions[key] = normalizeQuestion(question, `questions.${key}`);
  }

  if (!["low", "medium", "high"].includes(input.risk)) {
    fail("risk must be low, medium or high");
  }
  if (!["shadow", "active"].includes(input.rollout)) {
    fail("rollout must be shadow or active");
  }

  return Object.freeze({
    decisionClass,
    schemaVersion,
    risk: input.risk,
    rollout: input.rollout,
    questions: Object.freeze(questions),
    deterministicFallback: boundedInstruction(
      input.deterministicFallback,
      "deterministicFallback",
    ),
  });
}

function normalizeTrace(trace: DecisionTrace): DecisionTrace {
  if (trace.operationIds.length > decisionLimits.maxOperationIds) {
    fail("trace.operationIds exceeds maximum operation reference count");
  }
  return Object.freeze({
    ...trace,
    operationIds: Object.freeze([...new Set(trace.operationIds)]),
  });
}

export function assertDecisionRequestMatchesDefinition(
  definition: DecisionDefinition,
  request: DecisionRequest,
): void {
  const normalizedDefinition = createDecisionDefinition(definition);
  if (
    request.decisionClass !== normalizedDefinition.decisionClass ||
    request.schemaVersion !== normalizedDefinition.schemaVersion
  ) {
    fail("decision request does not match the declared decision schema");
  }
}

export function createDecisionRequest(input: DecisionRequest): DecisionRequest {
  const decisionClass = normalizeKey(
    input.decisionClass,
    "decisionClass",
    decisionLimits.maxClassLength,
  );
  const schemaVersion = normalizeVersion(input.schemaVersion);
  if (!schemaVersion.startsWith(`${decisionClass}.v`)) {
    fail("schemaVersion must be namespaced to decisionClass");
  }

  const entries = Object.entries(input.packet);
  if (entries.length > decisionLimits.maxPacketKeys) {
    fail("packet exceeds maximum top-level key count");
  }
  const packet: Record<string, DecisionValue> = {};
  for (const [key, value] of entries.sort(([a], [b]) => compareKeys(a, b))) {
    const normalizedKey = normalizeKey(key, "packet key", decisionLimits.maxAnswerKeyLength);
    packet[normalizedKey] = normalizeValue(value, 1, `packet.${normalizedKey}`);
  }
  return Object.freeze({
    decisionClass,
    schemaVersion,
    packet: Object.freeze(packet),
    trace: normalizeTrace(input.trace),
  });
}

function validateAnswer(question: JevQuestion, answer: DecisionAnswer, name: string): DecisionAnswer {
  if (question.type === "choice") {
    if (typeof answer !== "string" || !(answer in question.criteria)) {
      fail(`${name} must be one of the declared closed-set choices`);
    }
    return answer;
  }
  if (question.type === "noul") {
    if (typeof answer !== "boolean") {
      fail(`${name} must be boolean for a noul question`);
    }
    return answer;
  }
  if (typeof answer !== "number") {
    fail(`${name} must be numeric for a score question`);
  }
  const normalized = normalizeFiniteNumber(answer, name);
  if (normalized < question.min || normalized > question.max) {
    fail(`${name} is outside the declared score range`);
  }
  return normalized;
}

export function createDecisionResult(
  definition: DecisionDefinition,
  input: DecisionResult,
): DecisionResult {
  const normalizedDefinition = createDecisionDefinition(definition);
  if (
    input.decisionClass !== normalizedDefinition.decisionClass ||
    input.schemaVersion !== normalizedDefinition.schemaVersion
  ) {
    fail("decision result does not match the declared decision schema");
  }

  const expected = Object.keys(normalizedDefinition.questions).sort();
  const actual = Object.keys(input.answers).sort();
  if (
    expected.length !== actual.length ||
    expected.some((key, index) => key !== actual[index])
  ) {
    fail("decision result must answer every declared question exactly once");
  }

  const answers: Record<string, DecisionAnswer> = {};
  for (const key of expected) {
    answers[key] = validateAnswer(
      normalizedDefinition.questions[key]!,
      input.answers[key]!,
      `answers.${key}`,
    );
  }

  const confidence =
    input.confidence === null
      ? null
      : normalizeFiniteNumber(input.confidence, "confidence");
  if (confidence !== null && (confidence < 0 || confidence > 1)) {
    fail("confidence must be null or between 0 and 1");
  }
  if (input.evidenceRefs.length > decisionLimits.maxEvidenceRefs) {
    fail("evidenceRefs exceeds maximum evidence reference count");
  }
  const evidenceRefs = input.evidenceRefs.map((ref, index) =>
    boundedInstruction(ref, `evidenceRefs[${index}]`),
  );

  return Object.freeze({
    decisionClass: input.decisionClass,
    schemaVersion: input.schemaVersion,
    answers: Object.freeze(answers),
    confidence,
    evidenceRefs: Object.freeze([...new Set(evidenceRefs)]),
  });
}

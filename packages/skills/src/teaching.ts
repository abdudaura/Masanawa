import {
  isCanonicalId,
  toInstant,
  type Instant,
  type RelationshipId,
  type SkillVersionId,
} from "@masanawa/contracts";

export const teachingLevels = [
  "beginner",
  "intermediate",
  "advanced",
  "unspecified",
] as const;
export type TeachingLevel = (typeof teachingLevels)[number];

export const teachingModalities = ["text", "voice"] as const;
export type TeachingModality = (typeof teachingModalities)[number];

export const teachingAssessmentKinds = [
  "practice",
  "formative",
  "verified-certification",
] as const;
export type TeachingAssessmentKind =
  (typeof teachingAssessmentKinds)[number];

export const teachingCheckpointStates = [
  "planned",
  "in-progress",
  "needs-reteaching",
  "ready-to-advance",
  "completed",
] as const;
export type TeachingCheckpointState =
  (typeof teachingCheckpointStates)[number];

export interface TeachingLearnerContext {
  readonly relationshipId: RelationshipId;
  readonly topic: string;
  readonly level: TeachingLevel;
  readonly goals: readonly string[];
  readonly language: string;
  readonly accessibilityPreferences: readonly string[];
  readonly preferredModalities: readonly TeachingModality[];
}

export interface TeachingResourceEvidence {
  readonly resourceKey: string;
  readonly title: string;
  readonly reference: string;
  readonly contentHash: string;
  readonly checkedAt: Instant;
}

export interface TeachingLessonStep {
  readonly stepKey: string;
  readonly title: string;
  readonly objective: string;
  readonly explanation: string;
  readonly examples: readonly string[];
  readonly workedSolutions: readonly string[];
  readonly exercisePrompts: readonly string[];
  readonly resourceKeys: readonly string[];
}

export interface TeachingLessonPlan {
  readonly skillVersionId: SkillVersionId;
  readonly learner: TeachingLearnerContext;
  readonly sequenceTitle: string;
  readonly steps: readonly TeachingLessonStep[];
  readonly resources: readonly TeachingResourceEvidence[];
  readonly uncertaintyNotes: readonly string[];
}

export interface TeachingAnswerEvaluation {
  readonly assessmentKind: TeachingAssessmentKind;
  readonly correct: boolean | null;
  readonly feedback: string;
  readonly misconception: string | null;
  readonly alternativeExplanation: string | null;
  readonly nextCheckpointState: TeachingCheckpointState;
}

export interface TeachingProgressHandoff {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly checkpointState: TeachingCheckpointState;
  readonly demonstratedUnderstanding: readonly string[];
  readonly misconceptionsToRevisit: readonly string[];
  readonly nextSteps: readonly string[];
  readonly recordedAt: Instant;
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;
const languagePattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function bounded(value: string, name: string, maxLength: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function boundedList(
  values: readonly string[],
  name: string,
  maxEntries: number,
  maxLength: number,
  allowEmpty = true,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maxEntries || (!allowEmpty && values.length === 0)) {
    throw new RangeError(`${name} is invalid`);
  }
  const normalized = values.map((value) => bounded(value, name, maxLength));
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze(normalized);
}

function normalizeKey(value: string, name: string): string {
  const normalized = bounded(value, name, 128).toLowerCase();
  if (!keyPattern.test(normalized)) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function oneOf<T extends string>(
  value: string,
  values: readonly T[],
  name: string,
): T {
  if (!values.includes(value as T)) throw new TypeError(`${name} is invalid`);
  return value as T;
}

export function normalizeTeachingLearnerContext(
  input: TeachingLearnerContext,
): TeachingLearnerContext {
  if (!isCanonicalId("relationship", input.relationshipId)) {
    throw new TypeError("teaching relationshipId is invalid");
  }
  const language = bounded(input.language, "teaching.language", 64);
  if (!languagePattern.test(language)) {
    throw new TypeError("teaching.language must be a BCP-47-like language tag");
  }
  if (!Array.isArray(input.preferredModalities) || input.preferredModalities.length < 1) {
    throw new RangeError("teaching.preferredModalities is invalid");
  }
  const preferredModalities = input.preferredModalities.map((value) =>
    oneOf(value, teachingModalities, "teaching.preferredModalities"),
  );
  if (new Set(preferredModalities).size !== preferredModalities.length) {
    throw new TypeError("teaching.preferredModalities must be unique");
  }
  return Object.freeze({
    relationshipId: input.relationshipId,
    topic: bounded(input.topic, "teaching.topic", 500),
    level: oneOf(input.level, teachingLevels, "teaching.level"),
    goals: boundedList(input.goals, "teaching.goals", 16, 500),
    language,
    accessibilityPreferences: boundedList(
      input.accessibilityPreferences,
      "teaching.accessibilityPreferences",
      16,
      500,
    ),
    preferredModalities: Object.freeze(preferredModalities),
  });
}

function normalizeResource(
  input: TeachingResourceEvidence,
): TeachingResourceEvidence {
  const contentHash = bounded(input.contentHash, "teaching.resource.contentHash", 71).toLowerCase();
  if (!sha256Pattern.test(contentHash)) {
    throw new TypeError("teaching.resource.contentHash must be sha256:<64 lowercase hex>");
  }
  return Object.freeze({
    resourceKey: normalizeKey(input.resourceKey, "teaching.resource.resourceKey"),
    title: bounded(input.title, "teaching.resource.title", 300),
    reference: bounded(input.reference, "teaching.resource.reference", 2000),
    contentHash,
    checkedAt: toInstant(input.checkedAt),
  });
}

function normalizeStep(input: TeachingLessonStep): TeachingLessonStep {
  return Object.freeze({
    stepKey: normalizeKey(input.stepKey, "teaching.step.stepKey"),
    title: bounded(input.title, "teaching.step.title", 300),
    objective: bounded(input.objective, "teaching.step.objective", 1000),
    explanation: bounded(input.explanation, "teaching.step.explanation", 12_000),
    examples: boundedList(input.examples, "teaching.step.examples", 16, 4000),
    workedSolutions: boundedList(
      input.workedSolutions,
      "teaching.step.workedSolutions",
      16,
      6000,
    ),
    exercisePrompts: boundedList(
      input.exercisePrompts,
      "teaching.step.exercisePrompts",
      32,
      2000,
    ),
    resourceKeys: Object.freeze(
      boundedList(input.resourceKeys, "teaching.step.resourceKeys", 32, 128).map((value) =>
        normalizeKey(value, "teaching.step.resourceKey"),
      ),
    ),
  });
}

export function normalizeTeachingLessonPlan(
  input: TeachingLessonPlan,
): TeachingLessonPlan {
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("teaching skillVersionId is invalid");
  }
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 128) {
    throw new RangeError("teaching.steps is invalid");
  }
  if (!Array.isArray(input.resources) || input.resources.length > 256) {
    throw new RangeError("teaching.resources is invalid");
  }
  const steps = input.steps.map(normalizeStep);
  const resources = input.resources.map(normalizeResource);
  const stepKeys = steps.map((step) => step.stepKey);
  const resourceKeys = resources.map((resource) => resource.resourceKey);
  if (new Set(stepKeys).size !== stepKeys.length) {
    throw new TypeError("teaching step keys must be unique");
  }
  if (new Set(resourceKeys).size !== resourceKeys.length) {
    throw new TypeError("teaching resource keys must be unique");
  }
  const resourceSet = new Set(resourceKeys);
  for (const step of steps) {
    for (const resourceKey of step.resourceKeys) {
      if (!resourceSet.has(resourceKey)) {
        throw new TypeError("teaching step references unknown resource evidence");
      }
    }
  }
  return Object.freeze({
    skillVersionId: input.skillVersionId,
    learner: normalizeTeachingLearnerContext(input.learner),
    sequenceTitle: bounded(input.sequenceTitle, "teaching.sequenceTitle", 300),
    steps: Object.freeze(steps),
    resources: Object.freeze(resources),
    uncertaintyNotes: boundedList(
      input.uncertaintyNotes,
      "teaching.uncertaintyNotes",
      32,
      2000,
    ),
  });
}

export function normalizeTeachingAnswerEvaluation(
  input: TeachingAnswerEvaluation,
): TeachingAnswerEvaluation {
  const assessmentKind = oneOf(
    input.assessmentKind,
    teachingAssessmentKinds,
    "teaching.assessmentKind",
  );
  if (assessmentKind === "verified-certification") {
    throw new TypeError(
      "Core Teaching cannot issue verified certification without a separate certified assessment workflow",
    );
  }
  if (input.correct !== null && typeof input.correct !== "boolean") {
    throw new TypeError("teaching.correct is invalid");
  }
  return Object.freeze({
    assessmentKind,
    correct: input.correct,
    feedback: bounded(input.feedback, "teaching.feedback", 6000),
    misconception:
      input.misconception === null
        ? null
        : bounded(input.misconception, "teaching.misconception", 2000),
    alternativeExplanation:
      input.alternativeExplanation === null
        ? null
        : bounded(input.alternativeExplanation, "teaching.alternativeExplanation", 6000),
    nextCheckpointState: oneOf(
      input.nextCheckpointState,
      teachingCheckpointStates,
      "teaching.nextCheckpointState",
    ),
  });
}

export function normalizeTeachingProgressHandoff(
  input: TeachingProgressHandoff,
): TeachingProgressHandoff {
  if (!isCanonicalId("relationship", input.relationshipId)) {
    throw new TypeError("teaching progress relationshipId is invalid");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("teaching progress skillVersionId is invalid");
  }
  return Object.freeze({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: normalizeKey(input.lessonStepKey, "teaching.progress.lessonStepKey"),
    checkpointState: oneOf(
      input.checkpointState,
      teachingCheckpointStates,
      "teaching.progress.checkpointState",
    ),
    demonstratedUnderstanding: boundedList(
      input.demonstratedUnderstanding,
      "teaching.progress.demonstratedUnderstanding",
      32,
      1000,
    ),
    misconceptionsToRevisit: boundedList(
      input.misconceptionsToRevisit,
      "teaching.progress.misconceptionsToRevisit",
      32,
      1000,
    ),
    nextSteps: boundedList(input.nextSteps, "teaching.progress.nextSteps", 32, 1000),
    recordedAt: toInstant(input.recordedAt),
  });
}

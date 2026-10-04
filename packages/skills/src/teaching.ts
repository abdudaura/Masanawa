import {
  isCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type Instant,
  type RelationshipId,
  type SkillId,
  type SkillVersionId,
} from "@masanawa/contracts";
import {
  normalizeSkillCertification,
  type SkillCertification,
} from "./certification.js";
import {
  normalizeSkillGuide,
  type SkillGuide,
  type SkillGuideResource,
} from "./guide.js";
import {
  normalizeSkillVersionDefinition,
  type SkillProvenance,
  type SkillVersion,
} from "./model.js";
import { normalizeSkillResourcePath } from "./manifest.js";

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

export interface TeachingContinuation {
  readonly currentStep: TeachingLessonStep;
  readonly nextStep: TeachingLessonStep | null;
  readonly sequenceCompleted: boolean;
  readonly reason:
    | "continue-current"
    | "reteach-current"
    | "advance"
    | "sequence-complete";
}

export interface TeachingLearnerPreferenceUpdate {
  readonly language?: string;
  readonly accessibilityPreferences?: readonly string[];
  readonly preferredModalities?: readonly TeachingModality[];
}

export const teachingExerciseKinds = [
  "free-response",
  "single-select",
  "multi-select",
] as const;
export type TeachingExerciseKind = (typeof teachingExerciseKinds)[number];

export interface TeachingExerciseOption {
  readonly optionKey: string;
  readonly label: string;
}

export interface TeachingExerciseCard {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly prompt: string;
  readonly kind: TeachingExerciseKind;
  readonly options: readonly TeachingExerciseOption[];
}

export interface TeachingSelectableExerciseRubric {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly kind: "single-select" | "multi-select";
  readonly allowedOptionKeys: readonly string[];
  readonly correctOptionKeys: readonly string[];
  readonly correctFeedback: string;
  readonly retryFeedback: string;
  readonly alternativeExplanation: string | null;
}

export interface TeachingSelectionSubmission {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly selectedOptionKeys: readonly string[];
}

export type TeachingSubjectReference =
  | Readonly<{
      referenceKey: string;
      kind: "resource";
      resourcePath: string;
      skillVersionId: null;
    }>
  | Readonly<{
      referenceKey: string;
      kind: "subskill";
      resourcePath: null;
      skillVersionId: SkillVersionId;
    }>;

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
  if (
    input.correct !== true &&
    (input.nextCheckpointState === "ready-to-advance" ||
      input.nextCheckpointState === "completed")
  ) {
    throw new TypeError(
      "teaching evaluation cannot advance without positive understanding evidence",
    );
  }
  if (
    input.correct === false &&
    input.nextCheckpointState !== "needs-reteaching" &&
    input.nextCheckpointState !== "in-progress"
  ) {
    throw new TypeError(
      "incorrect teaching evaluation must remain in progress or require reteaching",
    );
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

export function updateTeachingLearnerPreferences(
  current: TeachingLearnerContext,
  update: TeachingLearnerPreferenceUpdate,
): TeachingLearnerContext {
  const normalizedCurrent = normalizeTeachingLearnerContext(current);
  return normalizeTeachingLearnerContext({
    ...normalizedCurrent,
    language: update.language ?? normalizedCurrent.language,
    accessibilityPreferences:
      update.accessibilityPreferences ?? normalizedCurrent.accessibilityPreferences,
    preferredModalities:
      update.preferredModalities ?? normalizedCurrent.preferredModalities,
  });
}

export function resolveTeachingContinuation(
  plan: TeachingLessonPlan,
  progress: TeachingProgressHandoff,
): TeachingContinuation {
  const normalizedPlan = normalizeTeachingLessonPlan(plan);
  const normalizedProgress = normalizeTeachingProgressHandoff(progress);
  if (
    normalizedPlan.skillVersionId !== normalizedProgress.skillVersionId ||
    normalizedPlan.learner.relationshipId !== normalizedProgress.relationshipId
  ) {
    throw new TypeError(
      "teaching progress must match the lesson SkillVersion and Relationship",
    );
  }

  const index = normalizedPlan.steps.findIndex(
    (step) => step.stepKey === normalizedProgress.lessonStepKey,
  );
  if (index < 0) {
    throw new TypeError("teaching progress references an unknown lesson step");
  }

  const currentStep = normalizedPlan.steps[index]!;
  const candidate = normalizedPlan.steps[index + 1] ?? null;

  if (normalizedProgress.checkpointState === "needs-reteaching") {
    return Object.freeze({
      currentStep,
      nextStep: currentStep,
      sequenceCompleted: false,
      reason: "reteach-current" as const,
    });
  }

  if (
    normalizedProgress.checkpointState === "planned" ||
    normalizedProgress.checkpointState === "in-progress"
  ) {
    return Object.freeze({
      currentStep,
      nextStep: currentStep,
      sequenceCompleted: false,
      reason: "continue-current" as const,
    });
  }

  if (candidate !== null) {
    return Object.freeze({
      currentStep,
      nextStep: candidate,
      sequenceCompleted: false,
      reason: "advance" as const,
    });
  }

  return Object.freeze({
    currentStep,
    nextStep: null,
    sequenceCompleted: true,
    reason: "sequence-complete" as const,
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


export function normalizeTeachingExerciseCard(
  input: TeachingExerciseCard,
): TeachingExerciseCard {
  if (!isCanonicalId("relationship", input.relationshipId)) {
    throw new TypeError("teaching exercise relationshipId is invalid");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("teaching exercise skillVersionId is invalid");
  }
  const kind = oneOf(input.kind, teachingExerciseKinds, "teaching.exercise.kind");
  if (!Array.isArray(input.options) || input.options.length > 20) {
    throw new RangeError("teaching.exercise.options is invalid");
  }
  if (kind === "free-response" && input.options.length !== 0) {
    throw new TypeError("free-response teaching exercises cannot expose options");
  }
  if (kind !== "free-response" && input.options.length < 2) {
    throw new TypeError("selectable teaching exercises require at least two options");
  }
  const options = input.options.map((option) =>
    Object.freeze({
      optionKey: normalizeKey(option.optionKey, "teaching.exercise.optionKey"),
      label: bounded(option.label, "teaching.exercise.optionLabel", 1000),
    }),
  );
  if (new Set(options.map((option) => option.optionKey)).size !== options.length) {
    throw new TypeError("teaching exercise option keys must be unique");
  }
  return Object.freeze({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: normalizeKey(input.lessonStepKey, "teaching.exercise.lessonStepKey"),
    exerciseKey: normalizeKey(input.exerciseKey, "teaching.exercise.exerciseKey"),
    prompt: bounded(input.prompt, "teaching.exercise.prompt", 4000),
    kind,
    options: Object.freeze(options),
  });
}

export function normalizeTeachingSelectableExerciseRubric(
  input: TeachingSelectableExerciseRubric,
): TeachingSelectableExerciseRubric {
  if (!isCanonicalId("relationship", input.relationshipId)) {
    throw new TypeError("teaching rubric relationshipId is invalid");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("teaching rubric skillVersionId is invalid");
  }
  const kind = oneOf(
    input.kind,
    ["single-select", "multi-select"] as const,
    "teaching.rubric.kind",
  );
  const allowedOptionKeys = boundedList(
    input.allowedOptionKeys,
    "teaching.rubric.allowedOptionKeys",
    20,
    128,
    false,
  ).map((value) => normalizeKey(value, "teaching.rubric.allowedOptionKey"));
  const correctOptionKeys = boundedList(
    input.correctOptionKeys,
    "teaching.rubric.correctOptionKeys",
    20,
    128,
    false,
  ).map((value) => normalizeKey(value, "teaching.rubric.correctOptionKey"));

  if (new Set(allowedOptionKeys).size !== allowedOptionKeys.length) {
    throw new TypeError("teaching rubric allowed option keys must be unique");
  }
  if (new Set(correctOptionKeys).size !== correctOptionKeys.length) {
    throw new TypeError("teaching rubric correct option keys must be unique");
  }
  const allowed = new Set(allowedOptionKeys);
  if (correctOptionKeys.some((key) => !allowed.has(key))) {
    throw new TypeError("teaching rubric correct options must be allowed options");
  }
  if (kind === "single-select" && correctOptionKeys.length !== 1) {
    throw new TypeError("single-select teaching rubric requires one correct option");
  }
  if (kind === "multi-select" && correctOptionKeys.length < 1) {
    throw new TypeError("multi-select teaching rubric requires correct options");
  }

  return Object.freeze({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: normalizeKey(input.lessonStepKey, "teaching.rubric.lessonStepKey"),
    exerciseKey: normalizeKey(input.exerciseKey, "teaching.rubric.exerciseKey"),
    kind,
    allowedOptionKeys: Object.freeze([...allowedOptionKeys].sort()),
    correctOptionKeys: Object.freeze([...correctOptionKeys].sort()),
    correctFeedback: bounded(input.correctFeedback, "teaching.rubric.correctFeedback", 4000),
    retryFeedback: bounded(input.retryFeedback, "teaching.rubric.retryFeedback", 4000),
    alternativeExplanation:
      input.alternativeExplanation === null
        ? null
        : bounded(
            input.alternativeExplanation,
            "teaching.rubric.alternativeExplanation",
            6000,
          ),
  });
}

export function evaluateTeachingSelection(
  rubricInput: TeachingSelectableExerciseRubric,
  submission: TeachingSelectionSubmission,
): TeachingAnswerEvaluation {
  const rubric = normalizeTeachingSelectableExerciseRubric(rubricInput);
  if (
    rubric.relationshipId !== submission.relationshipId ||
    rubric.skillVersionId !== submission.skillVersionId ||
    rubric.lessonStepKey !==
      normalizeKey(submission.lessonStepKey, "teaching.submission.lessonStepKey") ||
    rubric.exerciseKey !==
      normalizeKey(submission.exerciseKey, "teaching.submission.exerciseKey")
  ) {
    throw new TypeError(
      "teaching selection submission must match rubric scope and exercise",
    );
  }
  if (!Array.isArray(submission.selectedOptionKeys)) {
    throw new TypeError("teaching submission selectedOptionKeys is invalid");
  }
  const selected = submission.selectedOptionKeys.map((key) =>
    normalizeKey(key, "teaching.submission.selectedOptionKey"),
  );
  if (new Set(selected).size !== selected.length) {
    throw new TypeError("teaching submission option keys must be unique");
  }
  if (rubric.kind === "single-select" && selected.length !== 1) {
    throw new TypeError("single-select teaching submission requires one option");
  }
  if (rubric.kind === "multi-select" && selected.length < 1) {
    throw new TypeError("multi-select teaching submission requires selected options");
  }
  const allowed = new Set(rubric.allowedOptionKeys);
  if (selected.some((key) => !allowed.has(key))) {
    throw new TypeError("teaching submission contains an unknown option");
  }

  const normalizedSelected = [...selected].sort();
  const correct =
    normalizedSelected.length === rubric.correctOptionKeys.length &&
    normalizedSelected.every(
      (key, index) => key === rubric.correctOptionKeys[index],
    );

  return normalizeTeachingAnswerEvaluation({
    assessmentKind: "formative",
    correct,
    feedback: correct ? rubric.correctFeedback : rubric.retryFeedback,
    misconception: correct
      ? null
      : "The selected option set does not yet match the target concept.",
    alternativeExplanation: correct ? null : rubric.alternativeExplanation,
    nextCheckpointState: correct ? "ready-to-advance" : "needs-reteaching",
  });
}

export function normalizeTeachingSubjectReference(
  input: TeachingSubjectReference,
): TeachingSubjectReference {
  const referenceKey = normalizeKey(
    input.referenceKey,
    "teaching.subjectReference.referenceKey",
  );
  if (input.kind === "resource") {
    if (input.skillVersionId !== null) {
      throw new TypeError("teaching resource reference cannot carry a SkillVersionId");
    }
    return Object.freeze({
      referenceKey,
      kind: "resource" as const,
      resourcePath: normalizeSkillResourcePath(input.resourcePath),
      skillVersionId: null,
    });
  }
  if (input.kind === "subskill") {
    if (input.resourcePath !== null) {
      throw new TypeError("teaching subskill reference cannot carry a resource path");
    }
    if (!isCanonicalId("skill-version", input.skillVersionId)) {
      throw new TypeError("teaching subskill SkillVersionId is invalid");
    }
    return Object.freeze({
      referenceKey,
      kind: "subskill" as const,
      resourcePath: null,
      skillVersionId: input.skillVersionId,
    });
  }
  throw new TypeError("teaching subject reference kind is invalid");
}


export const coreTeachingSkillKey = "core.teaching";

export const requiredCoreTeachingRehearsalCases = [
  "activation.teaching-request",
  "negative.non-teaching-request",
  "contract.language-switching",
  "contract.misconception-correction",
  "recovery.failed-understanding",
  "contract.relationship-continuity",
  "recovery.source-uncertainty",
  "contract.relationship-privacy",
  "contract.app-continuity",
  "contract.whatsapp-continuity",
  "contract.telegram-continuity",
  "contract.voice-text-parity",
] as const;

export interface CoreTeachingSkillBundleInput {
  readonly skillId: SkillId;
  readonly skillVersionId: SkillVersionId;
  readonly version: string;
  readonly provenance: SkillProvenance;
  readonly certification: SkillCertification;
  readonly certifiedGuideContentHash: string;
  readonly guideResources?: readonly SkillGuideResource[];
}

export interface CoreTeachingSkillBundle {
  readonly skillVersion: SkillVersion;
  readonly guide: SkillGuide;
}

function requireCoreTeachingCertification(
  certification: SkillCertification,
): void {
  const evidence = new Map(
    certification.cases.map((item) => [item.caseKey, item] as const),
  );
  for (const caseKey of requiredCoreTeachingRehearsalCases) {
    const item = evidence.get(caseKey);
    if (item === undefined || item.outcome !== "passed") {
      throw new TypeError(
        `Core Teaching certification requires passed rehearsal evidence for ${caseKey}`,
      );
    }
  }
}

const coreTeachingInstructions = `
Core principle:
Teach adaptively in manageable steps while preserving learner privacy, evidence quality,
and continuity. Teaching is not ordinary answer generation: establish what the learner is
trying to understand, teach it, check understanding, correct misconceptions, and leave a
clear next checkpoint.

Operating pattern:
1. Establish or infer topic, learner level, goals, language, accessibility preferences,
   and preferred text/voice modality. Do not force a long intake when the request is clear.
2. Propose a short adaptive sequence and begin with the smallest useful next concept.
3. Explain with concrete examples. For procedural or quantitative material, include
   worked solutions before asking the learner to generalize.
4. Ask bounded practice/formative questions and evaluate the learner's answer.
5. When an answer is wrong or uncertain, identify the misconception without shaming,
   explain it differently, and retry at an appropriate difficulty.
6. Advance only when the current checkpoint has enough evidence of understanding.
7. Preserve a Relationship-scoped progress handoff: demonstrated understanding,
   misconceptions to revisit, current checkpoint, and next steps.
8. If the learner changes language, preserve the same lesson state and terminology
   meaning rather than restarting or inventing a second learner profile.

Evidence and resources:
- Load subject resources or subskills progressively only when needed.
- For current, specialist, safety-sensitive, or source-dependent claims, use the
  appropriate evidence-capable Tool/Skill path when available.
- Never fabricate a quote, citation, curriculum requirement, or source.
- If evidence is missing or capability is insufficient, state the uncertainty and teach
  the stable underlying concept instead of guessing.

Assessment boundary:
- Core Teaching may provide practice and formative assessment.
- It must never represent a formative result as verified certification, examination
  authority, credential, or regulated qualification.
- Paid courses, exam preparation, and assessed credentials require separately approved
  Offers/workflows.

Channel and privacy boundary:
- App, WhatsApp, Telegram, and voice are presentation/transport surfaces for the same
  teaching state; never create channel-specific learner truth.
- Learning progress is private Relationship-scoped state. Do not promote it to shared
  Character or World truth.
- Skill guidance does not grant Tool authority, persistence authority, payment authority,
  or certification authority.
`.trim();

export function createCoreTeachingSkillGuide(
  skillVersionId: SkillVersionId,
  guideResources: readonly SkillGuideResource[] = [],
): SkillGuide {
  if (!isCanonicalId("skill-version", skillVersionId)) {
    throw new TypeError("Core Teaching SkillGuide SkillVersionId is invalid");
  }
  return normalizeSkillGuide({
    schemaVersion: 1,
    skillVersionId,
    triggerDescription:
      "Use when the user wants to learn, be taught, understand, practise, revise, or receive tutoring on a topic.",
    instructions: coreTeachingInstructions,
    resources: guideResources,
    discovery: {
      priority: 90,
      phrases: [
        "teach me",
        "tutor me",
        "help me understand",
        "explain step by step",
        "quiz me",
      ],
      allOf: [
        ["help", "learn"],
        ["explain", "practice"],
      ],
      anyOf: [
        "learn",
        "lesson",
        "practice",
        "study",
        "teach",
        "tutor",
        "understand",
      ],
      noneOf: [],
      minScore: 15,
    },
  });
}

export function createCoreTeachingSkillBundle(
  input: CoreTeachingSkillBundleInput,
): CoreTeachingSkillBundle {
  const guide = createCoreTeachingSkillGuide(
    input.skillVersionId,
    input.guideResources ?? [],
  );
  const expectedGuideHash = bounded(
    input.certifiedGuideContentHash,
    "coreTeaching.certifiedGuideContentHash",
    71,
  ).toLowerCase();
  if (!sha256Pattern.test(expectedGuideHash)) {
    throw new TypeError(
      "Core Teaching certifiedGuideContentHash must be sha256:<64 lowercase hex>",
    );
  }
  if (guide.contentHash !== expectedGuideHash) {
    throw new TypeError(
      "Core Teaching certification must bind the exact SkillGuide content hash",
    );
  }

  const certification = normalizeSkillCertification(
    input.certification,
    input.skillVersionId,
  );
  requireCoreTeachingCertification(certification);

  const skillVersion = normalizeSkillVersionDefinition({
    skillId: input.skillId,
    skillVersionId: input.skillVersionId,
    key: coreTeachingSkillKey,
    version: input.version,
    displayName: "Core Teaching",
    description:
      "Use for adaptive teaching, tutoring, explanation, guided practice, and learner understanding checks across broad topics.",
    activationExamples: [
      "Teach me quadratic equations from the beginning",
      "Explain this topic step by step and quiz me",
      "Help me understand this in Hausa",
      "Tutor me until I can solve this myself",
    ],
    negativeActivationExamples: [
      "Just chat with me casually",
      "Buy a data bundle for this phone number",
      "Send this message to my contact",
      "What is the current weather?",
    ],
    capabilities: [normalizeCapabilityKey("teaching.core")],
    requiredToolCapabilities: [],
    toolReferences: [],
    requiredAuthorityCapabilities: [],
    dependencies: [],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["relationshipId", "topic", "language"],
      properties: {
        relationshipId: { type: "string" },
        topic: { type: "string" },
        level: { type: "string" },
        goals: { type: "array" },
        language: { type: "string" },
        accessibilityPreferences: { type: "array" },
        preferredModalities: { type: "array" },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["lesson", "checkpoint"],
      properties: {
        lesson: { type: "object" },
        checkpoint: { type: "object" },
        formativeEvaluation: { type: ["object", "null"] },
      },
    },
    visibility: "model-visible",
    riskClass: "read-only",
    sideEffectClass: "none",
    sensitivity: "private",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode: "not-required",
    reconciliationMode: "none",
    timeoutMs: 120_000,
    provenance: input.provenance,
    certification,
  });

  return Object.freeze({ skillVersion, guide });
}

import {
  isCanonicalId,
  toInstant,
  type Instant,
  type RelationshipId,
  type RequestId,
  type SkillVersionId,
} from "@masanawa/contracts";
import { canonicalJson, fingerprintCanonicalJson } from "@masanawa/security";
import {
  evaluateTeachingSelection,
  normalizeTeachingExerciseCard,
  normalizeTeachingLessonPlan,
  normalizeTeachingProgressHandoff,
  normalizeTeachingSelectableExerciseRubric,
  resolveTeachingContinuation,
  type TeachingAnswerEvaluation,
  type TeachingContinuation,
  type TeachingExerciseCard,
  type TeachingLessonPlan,
  type TeachingLessonStep,
  type TeachingProgressHandoff,
  type TeachingSelectableExerciseRubric,
  coreTeachingSkillKey,
  type TeachingSelectionSubmission,
} from "./teaching.js";

export interface TeachingProgressKey {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
}

export interface TeachingRuntimeBinding {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly skillKey: typeof coreTeachingSkillKey;
  readonly guideContentHash: string;
}

export function createTeachingRuntimeBinding(input: {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly skillKey: string;
  readonly guideContentHash: string;
}): TeachingRuntimeBinding {
  assertScope(input.relationshipId, input.skillVersionId);
  if (input.skillKey !== coreTeachingSkillKey) {
    throw new TypeError("Teaching runtime binding requires core.teaching");
  }
  const guideContentHash = input.guideContentHash.trim().toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(guideContentHash)) {
    throw new TypeError("Teaching runtime guideContentHash is invalid");
  }
  return Object.freeze({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    skillKey: coreTeachingSkillKey,
    guideContentHash,
  });
}

export interface TeachingSelectionAttempt {
  readonly requestId: RequestId;
  readonly payloadHash: string;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly selectedOptionKeys: readonly string[];
  readonly evaluation: TeachingAnswerEvaluation;
  readonly progress: TeachingProgressHandoff;
  readonly recordedAt: Instant;
}

export interface TeachingProgressPort {
  load(key: TeachingProgressKey): Promise<TeachingProgressHandoff | null>;
  /**
   * Persist one exact selection attempt and its resulting progress atomically.
   * The implementation must treat requestId as the replay identity: identical
   * replay returns "replay"; changed payload under the same requestId fails.
   */
  commitSelectionAttempt(
    attempt: TeachingSelectionAttempt,
  ): Promise<"stored" | "replay">;
}

export type TeachingRuntimeProjection =
  | Readonly<{
      kind: "lesson-step";
      relationshipId: RelationshipId;
      skillVersionId: SkillVersionId;
      step: TeachingLessonStep;
      continuationReason: "start" | TeachingContinuation["reason"];
      sequenceCompleted: boolean;
    }>
  | Readonly<{
      kind: "exercise";
      relationshipId: RelationshipId;
      skillVersionId: SkillVersionId;
      card: TeachingExerciseCard;
    }>
  | Readonly<{
      kind: "feedback";
      relationshipId: RelationshipId;
      skillVersionId: SkillVersionId;
      exerciseKey: string;
      evaluation: TeachingAnswerEvaluation;
      continuation: TeachingContinuation;
      persistence: "stored" | "replay";
    }>;

export interface TeachingPresentationPort {
  publish(projection: TeachingRuntimeProjection): Promise<void>;
}

export interface TeachingRuntimeCoordinatorOptions {
  readonly progress: TeachingProgressPort;
  readonly presentation?: TeachingPresentationPort;
}

export function fingerprintTeachingSelectionAttempt(input: {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly selectedOptionKeys: readonly string[];
}): string {
  assertScope(input.relationshipId, input.skillVersionId);
  const payload = {
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: input.lessonStepKey.trim().toLowerCase(),
    exerciseKey: input.exerciseKey.trim().toLowerCase(),
    selectedOptionKeys: [...input.selectedOptionKeys]
      .map((value) => value.trim().toLowerCase())
      .sort(),
  };
  return `sha256:${fingerprintCanonicalJson(JSON.parse(canonicalJson(payload)))}`;
}

function assertBindingScope(
  binding: TeachingRuntimeBinding,
  relationshipId: RelationshipId,
  skillVersionId: SkillVersionId,
): void {
  if (
    binding.relationshipId !== relationshipId ||
    binding.skillVersionId !== skillVersionId
  ) {
    throw new TypeError(
      "Teaching runtime input must match the admitted Relationship and SkillVersion",
    );
  }
}

function assertScope(
  relationshipId: RelationshipId,
  skillVersionId: SkillVersionId,
): void {
  if (!isCanonicalId("relationship", relationshipId)) {
    throw new TypeError("Teaching runtime RelationshipId is invalid");
  }
  if (!isCanonicalId("skill-version", skillVersionId)) {
    throw new TypeError("Teaching runtime SkillVersionId is invalid");
  }
}

function firstLessonProjection(
  plan: TeachingLessonPlan,
): TeachingRuntimeProjection {
  const first = plan.steps[0];
  if (first === undefined) {
    throw new TypeError("Teaching runtime requires at least one lesson step");
  }
  return Object.freeze({
    kind: "lesson-step" as const,
    relationshipId: plan.learner.relationshipId,
    skillVersionId: plan.skillVersionId,
    step: first,
    continuationReason: "start" as const,
    sequenceCompleted: false,
  });
}

function continuationProjection(
  plan: TeachingLessonPlan,
  continuation: TeachingContinuation,
): TeachingRuntimeProjection {
  return Object.freeze({
    kind: "lesson-step" as const,
    relationshipId: plan.learner.relationshipId,
    skillVersionId: plan.skillVersionId,
    step: continuation.nextStep ?? continuation.currentStep,
    continuationReason: continuation.reason,
    sequenceCompleted: continuation.sequenceCompleted,
  });
}

export class TeachingRuntimeCoordinator {
  readonly #progress: TeachingProgressPort;
  readonly #presentation: TeachingPresentationPort | undefined;

  constructor(options: TeachingRuntimeCoordinatorOptions) {
    this.#progress = options.progress;
    this.#presentation = options.presentation;
  }

  async resume(
    binding: TeachingRuntimeBinding,
    planInput: TeachingLessonPlan,
  ): Promise<TeachingRuntimeProjection> {
    const plan = normalizeTeachingLessonPlan(planInput);
    assertBindingScope(
      binding,
      plan.learner.relationshipId,
      plan.skillVersionId,
    );
    const key = Object.freeze({
      relationshipId: plan.learner.relationshipId,
      skillVersionId: plan.skillVersionId,
    });
    const progress = await this.#progress.load(key);

    const projection =
      progress === null
        ? firstLessonProjection(plan)
        : continuationProjection(
            plan,
            resolveTeachingContinuation(plan, progress),
          );

    await this.#presentation?.publish(projection);
    return projection;
  }

  async presentExercise(
    binding: TeachingRuntimeBinding,
    cardInput: TeachingExerciseCard,
  ): Promise<TeachingRuntimeProjection> {
    const card = normalizeTeachingExerciseCard(cardInput);
    assertBindingScope(binding, card.relationshipId, card.skillVersionId);
    const projection = Object.freeze({
      kind: "exercise" as const,
      relationshipId: card.relationshipId,
      skillVersionId: card.skillVersionId,
      card,
    });
    await this.#presentation?.publish(projection);
    return projection;
  }

  async submitSelection(binding: TeachingRuntimeBinding, input: {
    readonly requestId: RequestId;
    readonly plan: TeachingLessonPlan;
    readonly rubric: TeachingSelectableExerciseRubric;
    readonly submission: TeachingSelectionSubmission;
    readonly recordedAt: Instant;
  }): Promise<TeachingRuntimeProjection> {
    if (!isCanonicalId("request", input.requestId)) {
      throw new TypeError("Teaching selection RequestId is invalid");
    }

    const plan = normalizeTeachingLessonPlan(input.plan);
    assertBindingScope(
      binding,
      plan.learner.relationshipId,
      plan.skillVersionId,
    );
    const rubric = normalizeTeachingSelectableExerciseRubric(input.rubric);
    assertBindingScope(binding, rubric.relationshipId, rubric.skillVersionId);
    assertScope(rubric.relationshipId, rubric.skillVersionId);

    if (
      plan.learner.relationshipId !== rubric.relationshipId ||
      plan.skillVersionId !== rubric.skillVersionId
    ) {
      throw new TypeError(
        "Teaching rubric must match the active lesson Relationship and SkillVersion",
      );
    }

    const evaluation = evaluateTeachingSelection(rubric, input.submission);
    const demonstratedUnderstanding = evaluation.correct
      ? Object.freeze([
          `Completed exercise ${rubric.exerciseKey} with positive understanding evidence`,
        ])
      : Object.freeze([] as string[]);
    const misconceptionsToRevisit =
      evaluation.misconception === null
        ? Object.freeze([] as string[])
        : Object.freeze([evaluation.misconception]);

    const progress = normalizeTeachingProgressHandoff({
      relationshipId: rubric.relationshipId,
      skillVersionId: rubric.skillVersionId,
      lessonStepKey: rubric.lessonStepKey,
      checkpointState: evaluation.nextCheckpointState,
      demonstratedUnderstanding,
      misconceptionsToRevisit,
      nextSteps:
        evaluation.correct === true
          ? ["Continue according to the lesson sequence"]
          : ["Reteach the current concept using a different explanation"],
      recordedAt: toInstant(input.recordedAt),
    });

    const payloadHash = fingerprintTeachingSelectionAttempt({
      relationshipId: rubric.relationshipId,
      skillVersionId: rubric.skillVersionId,
      lessonStepKey: rubric.lessonStepKey,
      exerciseKey: rubric.exerciseKey,
      selectedOptionKeys: input.submission.selectedOptionKeys,
    });

    const persistence = await this.#progress.commitSelectionAttempt(
      Object.freeze({
        requestId: input.requestId,
        payloadHash,
        relationshipId: rubric.relationshipId,
        skillVersionId: rubric.skillVersionId,
        lessonStepKey: rubric.lessonStepKey,
        exerciseKey: rubric.exerciseKey,
        selectedOptionKeys: Object.freeze([
          ...input.submission.selectedOptionKeys,
        ]),
        evaluation,
        progress,
        recordedAt: toInstant(input.recordedAt),
      }),
    );

    const continuation = resolveTeachingContinuation(plan, progress);
    const projection = Object.freeze({
      kind: "feedback" as const,
      relationshipId: rubric.relationshipId,
      skillVersionId: rubric.skillVersionId,
      exerciseKey: rubric.exerciseKey,
      evaluation,
      continuation,
      persistence,
    });
    await this.#presentation?.publish(projection);
    return projection;
  }
}

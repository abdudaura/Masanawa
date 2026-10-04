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
  type TeachingResourceEvidence,
  coreTeachingSkillKey,
  type TeachingSelectionSubmission,
} from "./teaching.js";

export const teachingArtifactKinds = [
  "diagram",
  "worksheet",
  "table",
  "image",
  "document",
] as const;
export type TeachingArtifactKind = (typeof teachingArtifactKinds)[number];

export interface TeachingArtifactPresentation {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly artifactKey: string;
  readonly kind: TeachingArtifactKind;
  readonly title: string;
  readonly reference: string;
  readonly mimeType: string;
  readonly contentHash: string;
  readonly altText: string;
}

export interface TeachingProgressKey {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
}

export interface TeachingStoredProgress {
  readonly planHash: string;
  readonly progress: TeachingProgressHandoff;
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

export interface TeachingSelectionActionBinding {
  readonly actionKey: string;
  readonly requestId: RequestId;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly rubric: TeachingSelectableExerciseRubric;
  readonly expiresAt: Instant;
  readonly bindingHash: string;
}

export interface TeachingOpaqueSelection {
  readonly actionKey: string;
  readonly selectedOptionKeys: readonly string[];
}

export interface TeachingSelectionAttempt {
  readonly requestId: RequestId;
  readonly payloadHash: string;
  readonly planHash: string;
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
  load(key: TeachingProgressKey): Promise<TeachingStoredProgress | null>;
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
      actionKey: string | null;
    }>
  | Readonly<{
      kind: "artifact";
      relationshipId: RelationshipId;
      skillVersionId: SkillVersionId;
      artifact: TeachingArtifactPresentation;
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

export interface TeachingEvidenceRequest {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly query: string;
  readonly purpose: "current-claim" | "specialist-claim" | "source-check";
}

export type TeachingEvidenceResult =
  | Readonly<{
      status: "verified";
      evidence: readonly TeachingResourceEvidence[];
      uncertaintyNote: null;
    }>
  | Readonly<{
      status: "insufficient";
      evidence: readonly TeachingResourceEvidence[];
      uncertaintyNote: string;
    }>;

export interface TeachingEvidencePort {
  resolve(request: TeachingEvidenceRequest): Promise<TeachingEvidenceResult>;
}

export interface TeachingPresentationPort {
  publish(projection: TeachingRuntimeProjection): Promise<void>;
}

export interface TeachingRuntimeCoordinatorOptions {
  readonly progress: TeachingProgressPort;
  readonly presentation?: TeachingPresentationPort;
  readonly evidence?: TeachingEvidencePort;
}

export function fingerprintTeachingLessonPlan(
  planInput: TeachingLessonPlan,
): string {
  const plan = normalizeTeachingLessonPlan(planInput);
  const pedagogicalIdentity = Object.freeze({
    skillVersionId: plan.skillVersionId,
    relationshipId: plan.learner.relationshipId,
    topic: plan.learner.topic,
    level: plan.learner.level,
    goals: plan.learner.goals,
    sequenceTitle: plan.sequenceTitle,
    steps: plan.steps,
    resources: plan.resources,
    uncertaintyNotes: plan.uncertaintyNotes,
  });
  return `sha256:${fingerprintCanonicalJson(
    JSON.parse(canonicalJson(pedagogicalIdentity)),
  )}`;
}

function teachingActionBindingPayload(input: {
  readonly actionKey: string;
  readonly requestId: RequestId;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly rubric: TeachingSelectableExerciseRubric;
  readonly expiresAt: Instant;
}) {
  return Object.freeze({
    actionKey: input.actionKey,
    requestId: input.requestId,
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: input.lessonStepKey,
    exerciseKey: input.exerciseKey,
    rubric: input.rubric,
    expiresAt: input.expiresAt,
  });
}

export function createTeachingSelectionActionBinding(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly actionKey: string;
  readonly requestId: RequestId;
  readonly rubric: TeachingSelectableExerciseRubric;
  readonly expiresAt: Instant;
}): TeachingSelectionActionBinding {
  if (!isCanonicalId("request", input.requestId)) {
    throw new TypeError("Teaching action RequestId is invalid");
  }
  const actionKey = input.actionKey.trim();
  if (
    actionKey.length < 8 ||
    actionKey.length > 256 ||
    !/^[A-Za-z0-9._:-]+$/u.test(actionKey)
  ) {
    throw new TypeError("Teaching action key is invalid");
  }

  const rubric = normalizeTeachingSelectableExerciseRubric(input.rubric);
  assertBindingScope(
    input.binding,
    rubric.relationshipId,
    rubric.skillVersionId,
  );
  const expiresAt = toInstant(input.expiresAt);
  if (Date.parse(expiresAt) <= Date.now()) {
    throw new TypeError("Teaching action binding must expire in the future");
  }

  const payload = teachingActionBindingPayload({
    actionKey,
    requestId: input.requestId,
    relationshipId: rubric.relationshipId,
    skillVersionId: rubric.skillVersionId,
    lessonStepKey: rubric.lessonStepKey,
    exerciseKey: rubric.exerciseKey,
    rubric,
    expiresAt,
  });
  const bindingHash =
    `sha256:${fingerprintCanonicalJson(JSON.parse(canonicalJson(payload)))}`;

  return Object.freeze({
    ...payload,
    bindingHash,
  });
}

export function resolveTeachingOpaqueSelection(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly selection: TeachingOpaqueSelection;
  readonly now: Instant;
}): {
  readonly requestId: RequestId;
  readonly rubric: TeachingSelectableExerciseRubric;
  readonly submission: TeachingSelectionSubmission;
} {
  const expectedPayload = teachingActionBindingPayload({
    actionKey: input.action.actionKey,
    requestId: input.action.requestId,
    relationshipId: input.action.relationshipId,
    skillVersionId: input.action.skillVersionId,
    lessonStepKey: input.action.lessonStepKey,
    exerciseKey: input.action.exerciseKey,
    rubric: input.action.rubric,
    expiresAt: input.action.expiresAt,
  });
  const expectedHash =
    `sha256:${fingerprintCanonicalJson(
      JSON.parse(canonicalJson(expectedPayload)),
    )}`;
  if (input.action.bindingHash !== expectedHash) {
    throw new TypeError("Teaching action binding hash does not match payload");
  }
  assertBindingScope(
    input.binding,
    input.action.relationshipId,
    input.action.skillVersionId,
  );
  if (input.selection.actionKey !== input.action.actionKey) {
    throw new TypeError("Teaching selection action key does not match binding");
  }
  if (Date.parse(toInstant(input.now)) > Date.parse(input.action.expiresAt)) {
    throw new TypeError("Teaching action binding has expired");
  }

  return Object.freeze({
    requestId: input.action.requestId,
    rubric: input.action.rubric,
    submission: Object.freeze({
      relationshipId: input.action.relationshipId,
      skillVersionId: input.action.skillVersionId,
      lessonStepKey: input.action.lessonStepKey,
      exerciseKey: input.action.exerciseKey,
      selectedOptionKeys: Object.freeze([...input.selection.selectedOptionKeys]),
    }),
  });
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

function normalizeTeachingArtifactPresentation(
  input: TeachingArtifactPresentation,
): TeachingArtifactPresentation {
  assertScope(input.relationshipId, input.skillVersionId);
  const artifactKey = input.artifactKey.trim().toLowerCase();
  const lessonStepKey = input.lessonStepKey.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(artifactKey)) {
    throw new TypeError("Teaching artifact key is invalid");
  }
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(lessonStepKey)) {
    throw new TypeError("Teaching artifact lessonStepKey is invalid");
  }
  if (!(teachingArtifactKinds as readonly string[]).includes(input.kind)) {
    throw new TypeError("Teaching artifact kind is invalid");
  }
  const title = input.title.trim();
  const reference = input.reference.trim();
  const mimeType = input.mimeType.trim().toLowerCase();
  const altText = input.altText.trim();
  const contentHash = input.contentHash.trim().toLowerCase();
  if (title.length < 1 || title.length > 300) {
    throw new TypeError("Teaching artifact title is invalid");
  }
  if (reference.length < 1 || reference.length > 2000) {
    throw new TypeError("Teaching artifact reference is invalid");
  }
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(mimeType)) {
    throw new TypeError("Teaching artifact mimeType is invalid");
  }
  if (altText.length < 1 || altText.length > 2000) {
    throw new TypeError("Teaching artifact altText is invalid");
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(contentHash)) {
    throw new TypeError("Teaching artifact contentHash is invalid");
  }
  return Object.freeze({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey,
    artifactKey,
    kind: input.kind,
    title,
    reference,
    mimeType,
    contentHash,
    altText,
  });
}

export class TeachingRuntimeCoordinator {
  readonly #progress: TeachingProgressPort;
  readonly #presentation: TeachingPresentationPort | undefined;
  readonly #evidence: TeachingEvidencePort | undefined;

  constructor(options: TeachingRuntimeCoordinatorOptions) {
    this.#progress = options.progress;
    this.#presentation = options.presentation;
    this.#evidence = options.evidence;
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
    const stored = await this.#progress.load(key);
    const planHash = fingerprintTeachingLessonPlan(plan);

    if (stored !== null && stored.planHash !== planHash) {
      throw new TypeError(
        "Teaching durable progress belongs to a different lesson plan",
      );
    }

    const projection =
      stored === null
        ? firstLessonProjection(plan)
        : continuationProjection(
            plan,
            resolveTeachingContinuation(plan, stored.progress),
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
      actionKey: null,
    });
    await this.#presentation?.publish(projection);
    return projection;
  }

  async presentBoundExercise(
    binding: TeachingRuntimeBinding,
    cardInput: TeachingExerciseCard,
    action: TeachingSelectionActionBinding,
  ): Promise<TeachingRuntimeProjection> {
    const card = normalizeTeachingExerciseCard(cardInput);
    assertBindingScope(binding, card.relationshipId, card.skillVersionId);

    if (
      action.relationshipId !== card.relationshipId ||
      action.skillVersionId !== card.skillVersionId ||
      action.lessonStepKey !== card.lessonStepKey ||
      action.exerciseKey !== card.exerciseKey
    ) {
      throw new TypeError(
        "Teaching exercise card must match the server action binding scope",
      );
    }

    const expectedAction = createTeachingSelectionActionBinding({
      binding,
      actionKey: action.actionKey,
      requestId: action.requestId,
      rubric: action.rubric,
      expiresAt: action.expiresAt,
    });
    if (expectedAction.bindingHash !== action.bindingHash) {
      throw new TypeError("Teaching action binding hash does not match payload");
    }

    if (card.kind !== action.rubric.kind) {
      throw new TypeError(
        "Teaching exercise card kind must match the server rubric",
      );
    }
    const visible = [...card.options.map((option) => option.optionKey)].sort();
    const allowed = [...action.rubric.allowedOptionKeys].sort();
    if (
      visible.length !== allowed.length ||
      visible.some((key, index) => key !== allowed[index])
    ) {
      throw new TypeError(
        "Teaching exercise card options must match the server rubric",
      );
    }

    const projection = Object.freeze({
      kind: "exercise" as const,
      relationshipId: card.relationshipId,
      skillVersionId: card.skillVersionId,
      card,
      actionKey: action.actionKey,
    });
    await this.#presentation?.publish(projection);
    return projection;
  }

  async presentArtifact(
    binding: TeachingRuntimeBinding,
    artifactInput: TeachingArtifactPresentation,
  ): Promise<TeachingRuntimeProjection> {
    const artifact = normalizeTeachingArtifactPresentation(artifactInput);
    assertBindingScope(
      binding,
      artifact.relationshipId,
      artifact.skillVersionId,
    );
    const projection = Object.freeze({
      kind: "artifact" as const,
      relationshipId: artifact.relationshipId,
      skillVersionId: artifact.skillVersionId,
      artifact,
    });
    await this.#presentation?.publish(projection);
    return projection;
  }

  async resolveEvidence(
    binding: TeachingRuntimeBinding,
    requestInput: TeachingEvidenceRequest,
  ): Promise<TeachingEvidenceResult> {
    assertBindingScope(
      binding,
      requestInput.relationshipId,
      requestInput.skillVersionId,
    );
    const lessonStepKey = requestInput.lessonStepKey.trim().toLowerCase();
    const query = requestInput.query.trim();
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(lessonStepKey)) {
      throw new TypeError("Teaching evidence lessonStepKey is invalid");
    }
    if (query.length < 1 || query.length > 4000) {
      throw new TypeError("Teaching evidence query is invalid");
    }
    if (
      !(
        ["current-claim", "specialist-claim", "source-check"] as readonly string[]
      ).includes(requestInput.purpose)
    ) {
      throw new TypeError("Teaching evidence purpose is invalid");
    }

    if (this.#evidence === undefined) {
      return Object.freeze({
        status: "insufficient" as const,
        evidence: Object.freeze([] as TeachingResourceEvidence[]),
        uncertaintyNote:
          "No evidence-capable Teaching integration is available for this claim.",
      });
    }

    const result = await this.#evidence.resolve(
      Object.freeze({
        relationshipId: requestInput.relationshipId,
        skillVersionId: requestInput.skillVersionId,
        lessonStepKey,
        query,
        purpose: requestInput.purpose,
      }),
    );
    if (!Array.isArray(result.evidence) || result.evidence.length > 64) {
      throw new TypeError("Teaching evidence result is invalid");
    }

    const evidence = result.evidence.map((item) => {
      const resourceKey = item.resourceKey.trim().toLowerCase();
      const title = item.title.trim();
      const reference = item.reference.trim();
      const contentHash = item.contentHash.trim().toLowerCase();
      if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(resourceKey)) {
        throw new TypeError("Teaching evidence resourceKey is invalid");
      }
      if (title.length < 1 || title.length > 300) {
        throw new TypeError("Teaching evidence title is invalid");
      }
      if (reference.length < 1 || reference.length > 2000) {
        throw new TypeError("Teaching evidence reference is invalid");
      }
      if (!/^sha256:[0-9a-f]{64}$/u.test(contentHash)) {
        throw new TypeError("Teaching evidence contentHash is invalid");
      }
      return Object.freeze({
        resourceKey,
        title,
        reference,
        contentHash,
        checkedAt: toInstant(item.checkedAt),
      });
    });

    if (result.status === "verified") {
      if (evidence.length < 1 || result.uncertaintyNote !== null) {
        throw new TypeError(
          "Verified Teaching evidence requires evidence and no uncertainty note",
        );
      }
      return Object.freeze({
        status: "verified" as const,
        evidence: Object.freeze(evidence),
        uncertaintyNote: null,
      });
    }
    if (result.status !== "insufficient") {
      throw new TypeError("Teaching evidence status is invalid");
    }
    const uncertaintyNote = result.uncertaintyNote.trim();
    if (uncertaintyNote.length < 1 || uncertaintyNote.length > 2000) {
      throw new TypeError(
        "Insufficient Teaching evidence requires an uncertainty note",
      );
    }
    return Object.freeze({
      status: "insufficient" as const,
      evidence: Object.freeze(evidence),
      uncertaintyNote,
    });
  }

  async submitOpaqueSelection(input: {
    readonly binding: TeachingRuntimeBinding;
    readonly action: TeachingSelectionActionBinding;
    readonly selection: TeachingOpaqueSelection;
    readonly plan: TeachingLessonPlan;
    readonly now: Instant;
  }): Promise<TeachingRuntimeProjection> {
    const resolved = resolveTeachingOpaqueSelection({
      binding: input.binding,
      action: input.action,
      selection: input.selection,
      now: input.now,
    });
    return this.submitSelection(input.binding, {
      requestId: resolved.requestId,
      plan: input.plan,
      rubric: resolved.rubric,
      submission: resolved.submission,
      recordedAt: input.now,
    });
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

    const planHash = fingerprintTeachingLessonPlan(plan);
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
        planHash,
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

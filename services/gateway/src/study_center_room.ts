import {
  normalizeTeachingLessonPlan,
  resolveTeachingContinuation,
  type TeachingArtifactPresentation,
  type TeachingLessonPlan,
  type TeachingMultiSelectStage,
  type TeachingRuntimeProjection,
  type TeachingStoredProgress,
} from "@masanawa/skills";

export type StudyContinuationWire =
  | "continue"
  | "reteach"
  | "advance"
  | "complete";

export interface StudyPresentationCapabilitiesProjection {
  readonly textEnabled: boolean;
  readonly voiceEnabled: boolean;
}

export interface StudyProgressProjection {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly continuation: StudyContinuationWire;
  readonly canResume: boolean;
}

export interface StudyOptionProjection {
  readonly selectionId: string;
  readonly label: string;
  readonly selected: boolean;
}

export interface StudyArtifactProjection {
  readonly artifactId: string;
  readonly title: string;
  readonly kind: string;
  readonly altText: string;
}

export type StudyCardKindWire =
  | "lesson"
  | "single-select"
  | "multi-select"
  | "free-response"
  | "feedback";

export interface StudyCardProjection {
  readonly kind: StudyCardKindWire;
  readonly title: string;
  readonly body: string;
  readonly actionToken: string | null;
  readonly revision: number;
  readonly options: readonly StudyOptionProjection[];
  readonly artifacts: readonly StudyArtifactProjection[];
  readonly feedbackPositive?: boolean;
}

export interface StudyCenterRoomProjection {
  readonly title: string;
  readonly subtitle: string;
  readonly topic: string;
  readonly language: string;
  readonly capabilities: StudyPresentationCapabilitiesProjection;
  readonly progress: StudyProgressProjection;
  readonly card: StudyCardProjection | null;
}

export type StudyInteractionProjection =
  | Readonly<{
      kind: "single-select";
      actionToken: string;
      revision: number;
      selectionIds: Readonly<Record<string, string>>;
    }>
  | Readonly<{
      kind: "multi-select";
      actionToken: string;
      stage: TeachingMultiSelectStage;
      selectionIds: Readonly<Record<string, string>>;
    }>
  | Readonly<{
      kind: "free-response";
      actionToken: string;
      revision: number;
    }>;

export interface StudyCenterProjectionInput {
  readonly plan: TeachingLessonPlan;
  readonly storedProgress: TeachingStoredProgress | null;
  readonly runtime: TeachingRuntimeProjection | null;
  readonly interaction?: StudyInteractionProjection;
  readonly relatedArtifacts?: readonly TeachingArtifactPresentation[];
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const result = value.trim();
  if (result.length < 1 || result.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return result;
}

function continuationWire(
  reason:
    | "continue-current"
    | "reteach-current"
    | "advance"
    | "sequence-complete",
): StudyContinuationWire {
  switch (reason) {
    case "continue-current":
      return "continue";
    case "reteach-current":
      return "reteach";
    case "advance":
      return "advance";
    case "sequence-complete":
      return "complete";
  }
}

function progressProjection(
  plan: TeachingLessonPlan,
  stored: TeachingStoredProgress | null,
): StudyProgressProjection {
  if (stored === null) {
    return Object.freeze({
      completedSteps: 0,
      totalSteps: plan.steps.length,
      continuation: "continue" as const,
      canResume: false,
    });
  }

  const continuation = resolveTeachingContinuation(plan, stored.progress);
  const index = plan.steps.findIndex(
    (step) => step.stepKey === stored.progress.lessonStepKey,
  );
  if (index < 0) {
    throw new TypeError("Stored Teaching progress references an unknown step");
  }

  const completedSteps =
    continuation.reason === "sequence-complete"
      ? plan.steps.length
      : continuation.reason === "advance"
        ? Math.min(plan.steps.length, index + 1)
        : index;

  return Object.freeze({
    completedSteps,
    totalSteps: plan.steps.length,
    continuation: continuationWire(continuation.reason),
    canResume: true,
  });
}

function artifactProjection(
  plan: TeachingLessonPlan,
  artifact: TeachingArtifactPresentation,
): StudyArtifactProjection {
  if (
    artifact.relationshipId !== plan.learner.relationshipId ||
    artifact.skillVersionId !== plan.skillVersionId
  ) {
    throw new TypeError(
      "Teaching artifact does not match Study Center Relationship and SkillVersion",
    );
  }
  return Object.freeze({
    artifactId: bounded(artifact.artifactKey, "artifactKey", 256),
    title: bounded(artifact.title, "artifact.title", 1000),
    kind: bounded(artifact.kind, "artifact.kind", 128),
    altText: artifact.altText.trim().slice(0, 4000),
  });
}

function checkRuntimeScope(
  plan: TeachingLessonPlan,
  runtime: TeachingRuntimeProjection,
): void {
  if (
    runtime.relationshipId !== plan.learner.relationshipId ||
    runtime.skillVersionId !== plan.skillVersionId
  ) {
    throw new TypeError(
      "Teaching runtime projection does not match Study Center plan scope",
    );
  }
}

function interactionForExercise(
  runtime: Extract<TeachingRuntimeProjection, { kind: "exercise" }>,
  interaction: StudyInteractionProjection | undefined,
): StudyInteractionProjection {
  if (interaction === undefined) {
    throw new TypeError("Interactive Study exercise requires an opaque action projection");
  }
  if (interaction.kind !== runtime.card.kind) {
    throw new TypeError("Study interaction kind does not match Teaching exercise kind");
  }
  bounded(interaction.actionToken, "actionToken", 512);

  if (runtime.card.kind === "single-select") {
    if (runtime.actionKey === null || runtime.actionKey !== interaction.actionToken) {
      throw new TypeError(
        "Study single-select action token must match bound Teaching action",
      );
    }
    if (!Number.isSafeInteger(interaction.revision) || interaction.revision < 0) {
      throw new TypeError("Study action revision is invalid");
    }
  }

  if (runtime.card.kind === "multi-select") {
    if (
      runtime.actionKey === null ||
      runtime.actionKey !== interaction.actionToken ||
      interaction.kind !== "multi-select" ||
      interaction.stage.actionKey !== runtime.actionKey
    ) {
      throw new TypeError(
        "Study multi-select action must match bound Teaching action and stage",
      );
    }
  }

  if (runtime.card.kind === "free-response") {
    if (interaction.kind !== "free-response") {
      throw new TypeError("Study free-response action projection is required");
    }
    if (!Number.isSafeInteger(interaction.revision) || interaction.revision < 0) {
      throw new TypeError("Study free-response revision is invalid");
    }
  }

  return interaction;
}

function optionsForExercise(
  runtime: Extract<TeachingRuntimeProjection, { kind: "exercise" }>,
  interaction: StudyInteractionProjection,
): readonly StudyOptionProjection[] {
  if (runtime.card.kind === "free-response") return Object.freeze([]);
  if (interaction.kind === "free-response") {
    throw new TypeError("Selectable Teaching exercise cannot use free-response action");
  }

  const keys = runtime.card.options.map((option) => option.optionKey);
  const supplied = Object.keys(interaction.selectionIds);
  if (
    supplied.length !== keys.length ||
    keys.some((key) => !supplied.includes(key))
  ) {
    throw new TypeError(
      "Study selection ids must cover every visible Teaching option exactly",
    );
  }

  const ids = keys.map((key) =>
    bounded(interaction.selectionIds[key]!, "selectionId", 512),
  );
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("Study selection ids must be unique");
  }

  const selected =
    interaction.kind === "multi-select"
      ? new Set(interaction.stage.selectedOptionKeys)
      : new Set<string>();

  return Object.freeze(
    runtime.card.options.map((option) =>
      Object.freeze({
        selectionId: interaction.selectionIds[option.optionKey]!,
        label: option.label,
        selected: selected.has(option.optionKey),
      }),
    ),
  );
}

function exerciseCard(
  plan: TeachingLessonPlan,
  runtime: Extract<TeachingRuntimeProjection, { kind: "exercise" }>,
  interactionInput: StudyInteractionProjection | undefined,
  artifacts: readonly StudyArtifactProjection[],
): StudyCardProjection {
  const interaction = interactionForExercise(runtime, interactionInput);
  const options = optionsForExercise(runtime, interaction);
  const revision =
    interaction.kind === "multi-select"
      ? interaction.stage.revision
      : interaction.revision;

  return Object.freeze({
    kind: runtime.card.kind,
    title: "Practice",
    body: runtime.card.prompt,
    actionToken: interaction.actionToken,
    revision,
    options,
    artifacts,
  });
}

function cardProjection(
  plan: TeachingLessonPlan,
  runtime: TeachingRuntimeProjection | null,
  interaction: StudyInteractionProjection | undefined,
  relatedArtifacts: readonly TeachingArtifactPresentation[],
): StudyCardProjection | null {
  const artifacts = Object.freeze(
    relatedArtifacts.map((artifact) => artifactProjection(plan, artifact)),
  );

  if (runtime === null) return null;
  checkRuntimeScope(plan, runtime);

  switch (runtime.kind) {
    case "lesson-step":
      return Object.freeze({
        kind: "lesson" as const,
        title: runtime.step.title,
        body: runtime.step.explanation,
        actionToken: null,
        revision: 0,
        options: Object.freeze([]),
        artifacts,
      });

    case "exercise":
      return exerciseCard(plan, runtime, interaction, artifacts);

    case "artifact": {
      const artifact = artifactProjection(plan, runtime.artifact);
      return Object.freeze({
        kind: "lesson" as const,
        title: artifact.title,
        body: artifact.altText,
        actionToken: null,
        revision: 0,
        options: Object.freeze([]),
        artifacts: Object.freeze([artifact]),
      });
    }

    case "feedback":
      return Object.freeze({
        kind: "feedback" as const,
        title: "Feedback",
        body: runtime.evaluation.feedback,
        actionToken: null,
        revision: 0,
        options: Object.freeze([]),
        artifacts,
        feedbackPositive:
          runtime.evaluation.correct === true ||
          runtime.evaluation.nextCheckpointState === "ready-to-advance" ||
          runtime.evaluation.nextCheckpointState === "completed",
      });
  }
}

export function projectStudyCenterRoom(
  input: StudyCenterProjectionInput,
): StudyCenterRoomProjection {
  const plan = normalizeTeachingLessonPlan(input.plan);

  if (
    input.storedProgress !== null &&
    (
      input.storedProgress.progress.relationshipId !== plan.learner.relationshipId ||
      input.storedProgress.progress.skillVersionId !== plan.skillVersionId
    )
  ) {
    throw new TypeError("Stored Teaching progress does not match Study Center plan");
  }

  const modalities = new Set(plan.learner.preferredModalities);
  const capabilities = Object.freeze({
    textEnabled: modalities.has("text"),
    voiceEnabled: modalities.has("voice"),
  });
  if (!capabilities.textEnabled && !capabilities.voiceEnabled) {
    throw new TypeError("Study Center requires text or voice presentation");
  }

  return Object.freeze({
    title: "Study Center",
    subtitle:
      input.storedProgress === null
        ? "Start learning with guided lessons and practice."
        : "Continue where you stopped.",
    topic: plan.learner.topic,
    language: plan.learner.language,
    capabilities,
    progress: progressProjection(plan, input.storedProgress),
    card: cardProjection(
      plan,
      input.runtime,
      input.interaction,
      input.relatedArtifacts ?? Object.freeze([]),
    ),
  });
}

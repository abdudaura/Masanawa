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
  normalizeTeachingAnswerEvaluation,
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

export interface TeachingAdmissionEvidence {
  readonly revisionPin: {
    readonly schemaVersion: 1;
    readonly rootSkillVersionId: SkillVersionId;
    readonly orderedVersions: readonly {
      readonly ordinal: number;
      readonly skillVersionId: SkillVersionId;
      readonly key: string;
      readonly version: string;
      readonly definitionHash: string;
    }[];
    readonly contentHash: string;
  };
}

export function createTeachingRuntimeBindingFromAdmission(input: {
  readonly relationshipId: RelationshipId;
  readonly admission: TeachingAdmissionEvidence;
  readonly guideContentHash: string;
}): TeachingRuntimeBinding {
  const pin = input.admission.revisionPin;
  const root = pin.rootSkillVersionId;
  if (pin.schemaVersion !== 1 || !isCanonicalId("skill-version", root)) {
    throw new TypeError("Teaching admission revision pin is invalid");
  }
  if (
    !Array.isArray(pin.orderedVersions) ||
    pin.orderedVersions.length < 1 ||
    pin.orderedVersions.length > 65_536
  ) {
    throw new TypeError("Teaching admission revision pin entries are invalid");
  }

  const seen = new Set<SkillVersionId>();
  pin.orderedVersions.forEach((entry, ordinal) => {
    if (
      entry.ordinal !== ordinal ||
      !isCanonicalId("skill-version", entry.skillVersionId) ||
      typeof entry.key !== "string" ||
      entry.key.trim().length < 1 ||
      typeof entry.version !== "string" ||
      entry.version.trim().length < 1 ||
      typeof entry.definitionHash !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(entry.definitionHash.toLowerCase()) ||
      seen.has(entry.skillVersionId)
    ) {
      throw new TypeError("Teaching admission revision pin entries are invalid");
    }
    seen.add(entry.skillVersionId);
  });

  const expectedPinHash = `sha256:${fingerprintCanonicalJson({
    schemaVersion: 1,
    rootSkillVersionId: root,
    orderedVersions: pin.orderedVersions,
  })}`;
  if (
    typeof pin.contentHash !== "string" ||
    pin.contentHash.toLowerCase() !== expectedPinHash
  ) {
    throw new TypeError(
      "Teaching admission revision pin hash does not match its contents",
    );
  }

  const rootEntry = pin.orderedVersions.at(-1);
  if (
    rootEntry === undefined ||
    rootEntry.skillVersionId !== root ||
    rootEntry.key !== coreTeachingSkillKey
  ) {
    throw new TypeError(
      "Teaching admission must pin core.teaching as the exact root SkillVersion",
    );
  }

  return createTeachingRuntimeBinding({
    relationshipId: input.relationshipId,
    skillVersionId: root,
    skillKey: rootEntry.key,
    guideContentHash: input.guideContentHash,
  });
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

export interface TeachingFreeResponseBinding {
  readonly requestId: RequestId;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly cardHash: string;
  readonly expiresAt: Instant;
  readonly bindingHash: string;
}

export interface TeachingFreeResponseAttempt {
  readonly requestId: RequestId;
  readonly payloadHash: string;
  readonly planHash: string;
  readonly cardHash: string;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly responseText: string;
  readonly evaluation: TeachingAnswerEvaluation;
  readonly progress: TeachingProgressHandoff;
  readonly recordedAt: Instant;
}

export interface TeachingOpaqueSelection {
  readonly actionKey: string;
  readonly selectedOptionKeys: readonly string[];
}

export interface TeachingChannelSelectionBinding {
  readonly callbackToken: string;
  readonly actionKey: string;
  readonly actionBindingHash: string;
  readonly optionKey: string;
  readonly expiresAt: Instant;
  readonly bindingHash: string;
}

export interface TeachingChannelOption {
  readonly optionKey: string;
  readonly label: string;
  readonly selectionId: string;
}

export interface TeachingChannelSingleSelectProjection {
  readonly prompt: string;
  readonly options: readonly TeachingChannelOption[];
  readonly bindings: readonly TeachingChannelSelectionBinding[];
  readonly expiresAt: Instant;
}

export function createTeachingChannelSelectionBinding(input: {
  readonly action: TeachingSelectionActionBinding;
  readonly callbackToken: string;
  readonly optionKey: string;
}): TeachingChannelSelectionBinding {
  const callbackToken = input.callbackToken.trim();
  if (
    callbackToken.length < 8 ||
    callbackToken.length > 64 ||
    !/^[A-Za-z0-9_-]+$/u.test(callbackToken)
  ) {
    throw new TypeError("Teaching channel callback token is invalid");
  }
  const optionKey = input.optionKey.trim().toLowerCase();
  if (!input.action.rubric.allowedOptionKeys.includes(optionKey)) {
    throw new TypeError(
      "Teaching channel option must be allowed by the server rubric",
    );
  }
  const payload = Object.freeze({
    callbackToken,
    actionKey: input.action.actionKey,
    actionBindingHash: input.action.bindingHash,
    optionKey,
    expiresAt: input.action.expiresAt,
  });
  return Object.freeze({
    ...payload,
    bindingHash:
      `sha256:${fingerprintCanonicalJson(JSON.parse(canonicalJson(payload)))}`,
  });
}

export function createTeachingChannelSingleSelectProjection(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly card: TeachingExerciseCard;
  readonly action: TeachingSelectionActionBinding;
  readonly callbackTokens: Readonly<Record<string, string>>;
}): TeachingChannelSingleSelectProjection {
  const card = normalizeTeachingExerciseCard(input.card);
  assertBindingScope(input.binding, card.relationshipId, card.skillVersionId);

  if (
    card.kind !== "single-select" ||
    input.action.rubric.kind !== "single-select"
  ) {
    throw new TypeError(
      "Teaching channel option projection supports single-select only",
    );
  }
  if (
    input.action.relationshipId !== card.relationshipId ||
    input.action.skillVersionId !== card.skillVersionId ||
    input.action.lessonStepKey !== card.lessonStepKey ||
    input.action.exerciseKey !== card.exerciseKey
  ) {
    throw new TypeError(
      "Teaching channel card must match the server action binding scope",
    );
  }
  const visible = [...card.options.map((option) => option.optionKey)].sort();
  const allowed = [...input.action.rubric.allowedOptionKeys].sort();
  if (
    visible.length !== allowed.length ||
    visible.some((key, index) => key !== allowed[index])
  ) {
    throw new TypeError(
      "Teaching channel card options must match the server rubric",
    );
  }

  const suppliedKeys = Object.keys(input.callbackTokens).sort();
  if (
    suppliedKeys.length !== visible.length ||
    suppliedKeys.some((key, index) => key !== visible[index])
  ) {
    throw new TypeError(
      "Teaching channel callback tokens must cover every visible option exactly",
    );
  }

  const seenTokens = new Set<string>();
  const bindings = card.options.map((option) => {
    const callbackToken = input.callbackTokens[option.optionKey];
    if (callbackToken === undefined) {
      throw new TypeError("Teaching channel callback token is missing");
    }
    if (!seenTokens.add(callbackToken)) {
      throw new TypeError("Teaching channel callback tokens must be unique");
    }
    return createTeachingChannelSelectionBinding({
      action: input.action,
      callbackToken,
      optionKey: option.optionKey,
    });
  });
  const byOption = new Map(
    bindings.map((entry) => [entry.optionKey, entry] as const),
  );
  const options = card.options.map((option) => {
    const channelBinding = byOption.get(option.optionKey);
    if (channelBinding === undefined) {
      throw new TypeError("Teaching channel callback binding is missing");
    }
    return Object.freeze({
      optionKey: option.optionKey,
      label: option.label,
      selectionId: channelBinding.callbackToken,
    });
  });

  return Object.freeze({
    prompt: card.prompt,
    options: Object.freeze(options),
    bindings: Object.freeze(bindings),
    expiresAt: input.action.expiresAt,
  });
}

export function resolveTeachingChannelSelection(input: {
  readonly selectionId: string;
  readonly binding: TeachingChannelSelectionBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly now: Instant;
}): TeachingOpaqueSelection {
  const expectedPayload = Object.freeze({
    callbackToken: input.binding.callbackToken,
    actionKey: input.binding.actionKey,
    actionBindingHash: input.binding.actionBindingHash,
    optionKey: input.binding.optionKey,
    expiresAt: input.binding.expiresAt,
  });
  const expectedHash =
    `sha256:${fingerprintCanonicalJson(
      JSON.parse(canonicalJson(expectedPayload)),
    )}`;
  if (input.binding.bindingHash !== expectedHash) {
    throw new TypeError(
      "Teaching channel selection binding hash does not match payload",
    );
  }
  if (input.selectionId !== input.binding.callbackToken) {
    throw new TypeError(
      "Teaching channel selection id does not match binding",
    );
  }
  if (
    input.action.actionKey !== input.binding.actionKey ||
    input.action.bindingHash !== input.binding.actionBindingHash ||
    input.action.expiresAt !== input.binding.expiresAt
  ) {
    throw new TypeError(
      "Teaching channel selection does not match the exact action binding",
    );
  }
  if (Date.parse(toInstant(input.now)) > Date.parse(input.binding.expiresAt)) {
    throw new TypeError("Teaching channel selection binding has expired");
  }
  return Object.freeze({
    actionKey: input.binding.actionKey,
    selectedOptionKeys: Object.freeze([input.binding.optionKey]),
  });
}


export interface TeachingMultiSelectStage {
  readonly actionKey: string;
  readonly actionBindingHash: string;
  readonly state: "collecting" | "committed";
  readonly selectedOptionKeys: readonly string[];
  readonly revision: number;
  readonly expiresAt: Instant;
  readonly stageHash: string;
}

export type TeachingMultiSelectStageCommand =
  | Readonly<{ kind: "toggle"; optionKey: string }>
  | Readonly<{ kind: "commit" }>;

function multiSelectStagePayload(input: {
  readonly actionKey: string;
  readonly actionBindingHash: string;
  readonly state: "collecting" | "committed";
  readonly selectedOptionKeys: readonly string[];
  readonly revision: number;
  readonly expiresAt: Instant;
}) {
  return Object.freeze({
    actionKey: input.actionKey,
    actionBindingHash: input.actionBindingHash,
    state: input.state,
    selectedOptionKeys: Object.freeze([...input.selectedOptionKeys]),
    revision: input.revision,
    expiresAt: input.expiresAt,
  });
}

function hashMultiSelectStage(input: ReturnType<typeof multiSelectStagePayload>): string {
  return `sha256:${fingerprintCanonicalJson(
    JSON.parse(canonicalJson(input)),
  )}`;
}

function assertMultiSelectAction(
  binding: TeachingRuntimeBinding,
  action: TeachingSelectionActionBinding,
): void {
  assertBindingScope(binding, action.relationshipId, action.skillVersionId);
  if (action.rubric.kind !== "multi-select") {
    throw new TypeError("Teaching staged selection requires a multi-select rubric");
  }
  const expected = createTeachingSelectionActionBinding({
    binding,
    actionKey: action.actionKey,
    requestId: action.requestId,
    rubric: action.rubric,
    expiresAt: action.expiresAt,
  });
  if (expected.bindingHash !== action.bindingHash) {
    throw new TypeError("Teaching multi-select action binding hash does not match payload");
  }
}

export function validateTeachingMultiSelectStage(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
}): TeachingMultiSelectStage {
  assertMultiSelectAction(input.binding, input.action);
  const stage = input.stage;
  if (
    stage.actionKey !== input.action.actionKey ||
    stage.actionBindingHash !== input.action.bindingHash ||
    stage.expiresAt !== input.action.expiresAt
  ) {
    throw new TypeError("Teaching multi-select stage does not match the exact action binding");
  }
  if (
    stage.state !== "collecting" &&
    stage.state !== "committed"
  ) {
    throw new TypeError("Teaching multi-select stage state is invalid");
  }
  if (
    !Number.isSafeInteger(stage.revision) ||
    stage.revision < 0 ||
    stage.revision > 10_000
  ) {
    throw new TypeError("Teaching multi-select stage revision is invalid");
  }
  if (
    !Array.isArray(stage.selectedOptionKeys) ||
    stage.selectedOptionKeys.length > input.action.rubric.allowedOptionKeys.length
  ) {
    throw new TypeError("Teaching multi-select staged options are invalid");
  }

  const selected = stage.selectedOptionKeys.map((value) =>
    value.trim().toLowerCase()
  );
  if (
    new Set(selected).size !== selected.length ||
    selected.some(
      (optionKey) => !input.action.rubric.allowedOptionKeys.includes(optionKey),
    )
  ) {
    throw new TypeError("Teaching multi-select staged options are invalid");
  }
  const canonicalSelected = [...selected].sort();
  if (
    selected.some((optionKey, index) => optionKey !== canonicalSelected[index])
  ) {
    throw new TypeError("Teaching multi-select staged options must be canonical");
  }
  if (stage.state === "committed" && selected.length === 0) {
    throw new TypeError("Committed Teaching multi-select stage cannot be empty");
  }

  const payload = multiSelectStagePayload({
    actionKey: stage.actionKey,
    actionBindingHash: stage.actionBindingHash,
    state: stage.state,
    selectedOptionKeys: canonicalSelected,
    revision: stage.revision,
    expiresAt: stage.expiresAt,
  });
  if (stage.stageHash !== hashMultiSelectStage(payload)) {
    throw new TypeError("Teaching multi-select stage hash does not match payload");
  }
  return Object.freeze({
    ...payload,
    stageHash: stage.stageHash,
  });
}

export function createTeachingMultiSelectStage(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
}): TeachingMultiSelectStage {
  assertMultiSelectAction(input.binding, input.action);
  const payload = multiSelectStagePayload({
    actionKey: input.action.actionKey,
    actionBindingHash: input.action.bindingHash,
    state: "collecting",
    selectedOptionKeys: Object.freeze([] as string[]),
    revision: 0,
    expiresAt: input.action.expiresAt,
  });
  return Object.freeze({
    ...payload,
    stageHash: hashMultiSelectStage(payload),
  });
}

export function applyTeachingMultiSelectStageCommand(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly command: TeachingMultiSelectStageCommand;
  readonly now: Instant;
}):
  | Readonly<{
      kind: "staged";
      stage: TeachingMultiSelectStage;
    }>
  | Readonly<{
      kind: "committed";
      stage: TeachingMultiSelectStage;
      selection: TeachingOpaqueSelection;
    }> {
  const stage = validateTeachingMultiSelectStage(input);
  if (Date.parse(toInstant(input.now)) > Date.parse(stage.expiresAt)) {
    throw new TypeError("Teaching multi-select stage has expired");
  }

  if (input.command.kind === "commit") {
    if (stage.selectedOptionKeys.length === 0) {
      throw new TypeError("Teaching multi-select requires at least one selected option");
    }
    if (stage.state === "committed") {
      return Object.freeze({
        kind: "committed" as const,
        stage,
        selection: Object.freeze({
          actionKey: stage.actionKey,
          selectedOptionKeys: Object.freeze([...stage.selectedOptionKeys]),
        }),
      });
    }
    const payload = multiSelectStagePayload({
      actionKey: stage.actionKey,
      actionBindingHash: stage.actionBindingHash,
      state: "committed",
      selectedOptionKeys: stage.selectedOptionKeys,
      revision: stage.revision + 1,
      expiresAt: stage.expiresAt,
    });
    const committed = Object.freeze({
      ...payload,
      stageHash: hashMultiSelectStage(payload),
    });
    return Object.freeze({
      kind: "committed" as const,
      stage: committed,
      selection: Object.freeze({
        actionKey: committed.actionKey,
        selectedOptionKeys: Object.freeze([...committed.selectedOptionKeys]),
      }),
    });
  }

  if (stage.state !== "collecting") {
    throw new TypeError("Committed Teaching multi-select stage cannot be changed");
  }
  const optionKey = input.command.optionKey.trim().toLowerCase();
  if (!input.action.rubric.allowedOptionKeys.includes(optionKey)) {
    throw new TypeError("Teaching multi-select toggle option is not allowed");
  }
  const selected = new Set(stage.selectedOptionKeys);
  if (selected.has(optionKey)) selected.delete(optionKey);
  else selected.add(optionKey);
  const selectedOptionKeys = Object.freeze([...selected].sort());
  const payload = multiSelectStagePayload({
    actionKey: stage.actionKey,
    actionBindingHash: stage.actionBindingHash,
    state: "collecting",
    selectedOptionKeys,
    revision: stage.revision + 1,
    expiresAt: stage.expiresAt,
  });
  const nextStage = Object.freeze({
    ...payload,
    stageHash: hashMultiSelectStage(payload),
  });
  return Object.freeze({
    kind: "staged" as const,
    stage: nextStage,
  });
}

export interface TeachingChannelMultiSelectBinding {
  readonly callbackToken: string;
  readonly actionKey: string;
  readonly actionBindingHash: string;
  readonly stageHash: string;
  readonly stageRevision: number;
  readonly command: "toggle" | "commit";
  readonly optionKey: string | null;
  readonly expiresAt: Instant;
  readonly bindingHash: string;
}

export interface TeachingChannelMultiSelectOption {
  readonly optionKey: string;
  readonly label: string;
  readonly selected: boolean;
  readonly selectionId: string;
}

export interface TeachingChannelMultiSelectProjection {
  readonly prompt: string;
  readonly options: readonly TeachingChannelMultiSelectOption[];
  readonly commitSelectionId: string;
  readonly selectedOptionKeys: readonly string[];
  readonly stageRevision: number;
  readonly bindings: readonly TeachingChannelMultiSelectBinding[];
  readonly expiresAt: Instant;
}

function createTeachingChannelMultiSelectBinding(input: {
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly callbackToken: string;
  readonly command: "toggle" | "commit";
  readonly optionKey: string | null;
}): TeachingChannelMultiSelectBinding {
  const callbackToken = input.callbackToken.trim();
  if (
    callbackToken.length < 8 ||
    callbackToken.length > 64 ||
    !/^[A-Za-z0-9_-]+$/u.test(callbackToken)
  ) {
    throw new TypeError("Teaching channel multi-select callback token is invalid");
  }
  if (
    input.command === "toggle" &&
    (input.optionKey === null ||
      !input.action.rubric.allowedOptionKeys.includes(input.optionKey))
  ) {
    throw new TypeError("Teaching channel multi-select toggle option is invalid");
  }
  if (input.command === "commit" && input.optionKey !== null) {
    throw new TypeError("Teaching channel multi-select commit cannot carry an option");
  }
  const payload = Object.freeze({
    callbackToken,
    actionKey: input.action.actionKey,
    actionBindingHash: input.action.bindingHash,
    stageHash: input.stage.stageHash,
    stageRevision: input.stage.revision,
    command: input.command,
    optionKey: input.optionKey,
    expiresAt: input.action.expiresAt,
  });
  return Object.freeze({
    ...payload,
    bindingHash: `sha256:${fingerprintCanonicalJson(
      JSON.parse(canonicalJson(payload)),
    )}`,
  });
}

export function createTeachingChannelMultiSelectProjection(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly card: TeachingExerciseCard;
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly callbackTokens: Readonly<Record<string, string>>;
  readonly commitToken: string;
}): TeachingChannelMultiSelectProjection {
  const card = normalizeTeachingExerciseCard(input.card);
  assertBindingScope(input.binding, card.relationshipId, card.skillVersionId);
  assertMultiSelectAction(input.binding, input.action);
  const stage = validateTeachingMultiSelectStage({
    binding: input.binding,
    action: input.action,
    stage: input.stage,
  });
  if (stage.state !== "collecting") {
    throw new TypeError("Committed Teaching multi-select cannot be projected for editing");
  }
  if (
    card.kind !== "multi-select" ||
    input.action.relationshipId !== card.relationshipId ||
    input.action.skillVersionId !== card.skillVersionId ||
    input.action.lessonStepKey !== card.lessonStepKey ||
    input.action.exerciseKey !== card.exerciseKey
  ) {
    throw new TypeError("Teaching channel multi-select card does not match action scope");
  }
  const visible = [...card.options.map((option) => option.optionKey)].sort();
  const allowed = [...input.action.rubric.allowedOptionKeys].sort();
  if (
    visible.length !== allowed.length ||
    visible.some((optionKey, index) => optionKey !== allowed[index])
  ) {
    throw new TypeError("Teaching channel multi-select card options must match rubric");
  }
  const suppliedKeys = Object.keys(input.callbackTokens).sort();
  if (
    suppliedKeys.length !== allowed.length ||
    suppliedKeys.some((optionKey, index) => optionKey !== allowed[index])
  ) {
    throw new TypeError("Teaching channel multi-select callback tokens are incomplete");
  }

  const bindings = card.options.map((option) =>
    createTeachingChannelMultiSelectBinding({
      action: input.action,
      stage,
      callbackToken: input.callbackTokens[option.optionKey]!,
      command: "toggle",
      optionKey: option.optionKey,
    })
  );
  const commitBinding = createTeachingChannelMultiSelectBinding({
    action: input.action,
    stage,
    callbackToken: input.commitToken,
    command: "commit",
    optionKey: null,
  });
  const allBindings = Object.freeze([...bindings, commitBinding]);
  if (new Set(allBindings.map((item) => item.callbackToken)).size !== allBindings.length) {
    throw new TypeError("Teaching channel multi-select callback tokens must be unique");
  }

  return Object.freeze({
    prompt: card.prompt,
    options: Object.freeze(
      card.options.map((option, index) =>
        Object.freeze({
          optionKey: option.optionKey,
          label: option.label,
          selected: stage.selectedOptionKeys.includes(option.optionKey),
          selectionId: bindings[index]!.callbackToken,
        }),
      ),
    ),
    commitSelectionId: commitBinding.callbackToken,
    selectedOptionKeys: Object.freeze([...stage.selectedOptionKeys]),
    stageRevision: stage.revision,
    bindings: allBindings,
    expiresAt: stage.expiresAt,
  });
}

export function resolveTeachingChannelMultiSelectCommand(input: {
  readonly selectionId: string;
  readonly binding: TeachingChannelMultiSelectBinding;
  readonly runtimeBinding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly now: Instant;
}): TeachingMultiSelectStageCommand {
  const stage = validateTeachingMultiSelectStage({
    binding: input.runtimeBinding,
    action: input.action,
    stage: input.stage,
  });
  const payload = Object.freeze({
    callbackToken: input.binding.callbackToken,
    actionKey: input.binding.actionKey,
    actionBindingHash: input.binding.actionBindingHash,
    stageHash: input.binding.stageHash,
    stageRevision: input.binding.stageRevision,
    command: input.binding.command,
    optionKey: input.binding.optionKey,
    expiresAt: input.binding.expiresAt,
  });
  const expectedHash = `sha256:${fingerprintCanonicalJson(
    JSON.parse(canonicalJson(payload)),
  )}`;
  if (input.binding.bindingHash !== expectedHash) {
    throw new TypeError("Teaching channel multi-select binding hash does not match payload");
  }
  if (
    input.selectionId !== input.binding.callbackToken ||
    input.binding.actionKey !== input.action.actionKey ||
    input.binding.actionBindingHash !== input.action.bindingHash ||
    input.binding.stageHash !== stage.stageHash ||
    input.binding.stageRevision !== stage.revision ||
    input.binding.expiresAt !== stage.expiresAt
  ) {
    throw new TypeError("Teaching channel multi-select callback is stale or mismatched");
  }
  if (Date.parse(toInstant(input.now)) > Date.parse(stage.expiresAt)) {
    throw new TypeError("Teaching channel multi-select callback has expired");
  }
  if (input.binding.command === "commit") {
    if (input.binding.optionKey !== null) {
      throw new TypeError("Teaching channel multi-select commit binding is invalid");
    }
    return Object.freeze({ kind: "commit" as const });
  }
  if (
    input.binding.optionKey === null ||
    !input.action.rubric.allowedOptionKeys.includes(input.binding.optionKey)
  ) {
    throw new TypeError("Teaching channel multi-select option binding is invalid");
  }
  return Object.freeze({
    kind: "toggle" as const,
    optionKey: input.binding.optionKey,
  });
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
  commitFreeResponseAttempt(
    attempt: TeachingFreeResponseAttempt,
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
      actionExpiresAt: Instant | null;
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

function teachingFreeResponseBindingPayload(input: {
  readonly requestId: RequestId;
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly cardHash: string;
  readonly expiresAt: Instant;
}) {
  return Object.freeze({
    requestId: input.requestId,
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: input.lessonStepKey,
    exerciseKey: input.exerciseKey,
    cardHash: input.cardHash,
    expiresAt: input.expiresAt,
  });
}

export function createTeachingFreeResponseBinding(input: {
  readonly binding: TeachingRuntimeBinding;
  readonly requestId: RequestId;
  readonly card: TeachingExerciseCard;
  readonly expiresAt: Instant;
}): TeachingFreeResponseBinding {
  if (!isCanonicalId("request", input.requestId)) {
    throw new TypeError("Teaching free-response RequestId is invalid");
  }
  const card = normalizeTeachingExerciseCard(input.card);
  assertBindingScope(input.binding, card.relationshipId, card.skillVersionId);
  if (card.kind !== "free-response") {
    throw new TypeError(
      "Teaching free-response binding requires a free-response exercise card",
    );
  }
  const cardHash =
    `sha256:${fingerprintCanonicalJson(JSON.parse(canonicalJson(card)))}`;
  const expiresAt = toInstant(input.expiresAt);
  const payload = teachingFreeResponseBindingPayload({
    requestId: input.requestId,
    relationshipId: card.relationshipId,
    skillVersionId: card.skillVersionId,
    lessonStepKey: card.lessonStepKey,
    exerciseKey: card.exerciseKey,
    cardHash,
    expiresAt,
  });
  return Object.freeze({
    ...payload,
    bindingHash:
      `sha256:${fingerprintCanonicalJson(JSON.parse(canonicalJson(payload)))}`,
  });
}

export function fingerprintTeachingFreeResponseAttempt(input: {
  readonly relationshipId: RelationshipId;
  readonly skillVersionId: SkillVersionId;
  readonly lessonStepKey: string;
  readonly exerciseKey: string;
  readonly cardHash: string;
  readonly responseText: string;
}): string {
  assertScope(input.relationshipId, input.skillVersionId);
  const responseText = input.responseText.trim();
  if (responseText.length < 1 || responseText.length > 16_384) {
    throw new TypeError("Teaching free-response text is invalid");
  }
  const cardHash = input.cardHash.trim().toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(cardHash)) {
    throw new TypeError("Teaching free-response cardHash is invalid");
  }
  return `sha256:${fingerprintCanonicalJson({
    relationshipId: input.relationshipId,
    skillVersionId: input.skillVersionId,
    lessonStepKey: input.lessonStepKey.trim().toLowerCase(),
    exerciseKey: input.exerciseKey.trim().toLowerCase(),
    cardHash,
    responseText,
  })}`;
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
      actionExpiresAt: null,
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
      actionExpiresAt: action.expiresAt,
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

  async submitFreeResponse(input: {
    readonly binding: TeachingRuntimeBinding;
    readonly exercise: TeachingFreeResponseBinding;
    readonly plan: TeachingLessonPlan;
    readonly responseText: string;
    readonly evaluation: TeachingAnswerEvaluation;
    readonly now: Instant;
  }): Promise<TeachingRuntimeProjection> {
    const expectedPayload = teachingFreeResponseBindingPayload({
      requestId: input.exercise.requestId,
      relationshipId: input.exercise.relationshipId,
      skillVersionId: input.exercise.skillVersionId,
      lessonStepKey: input.exercise.lessonStepKey,
      exerciseKey: input.exercise.exerciseKey,
      cardHash: input.exercise.cardHash,
      expiresAt: input.exercise.expiresAt,
    });
    const expectedHash =
      `sha256:${fingerprintCanonicalJson(
        JSON.parse(canonicalJson(expectedPayload)),
      )}`;
    if (input.exercise.bindingHash !== expectedHash) {
      throw new TypeError(
        "Teaching free-response binding hash does not match payload",
      );
    }
    assertBindingScope(
      input.binding,
      input.exercise.relationshipId,
      input.exercise.skillVersionId,
    );
    if (Date.parse(toInstant(input.now)) > Date.parse(input.exercise.expiresAt)) {
      throw new TypeError("Teaching free-response binding has expired");
    }

    const plan = normalizeTeachingLessonPlan(input.plan);
    assertBindingScope(
      input.binding,
      plan.learner.relationshipId,
      plan.skillVersionId,
    );
    if (
      !plan.steps.some(
        (step) => step.stepKey === input.exercise.lessonStepKey,
      )
    ) {
      throw new TypeError(
        "Teaching free-response exercise references an unknown lesson step",
      );
    }

    const responseText = input.responseText.trim();
    if (responseText.length < 1 || responseText.length > 16_384) {
      throw new TypeError("Teaching free-response text is invalid");
    }
    const evaluation = normalizeTeachingAnswerEvaluation(input.evaluation);
    const progress = normalizeTeachingProgressHandoff({
      relationshipId: input.exercise.relationshipId,
      skillVersionId: input.exercise.skillVersionId,
      lessonStepKey: input.exercise.lessonStepKey,
      checkpointState: evaluation.nextCheckpointState,
      demonstratedUnderstanding:
        evaluation.correct === true
          ? Object.freeze([
              `Completed free-response exercise ${input.exercise.exerciseKey} with positive understanding evidence`,
            ])
          : Object.freeze([] as string[]),
      misconceptionsToRevisit:
        evaluation.misconception === null
          ? Object.freeze([] as string[])
          : Object.freeze([evaluation.misconception]),
      nextSteps:
        evaluation.correct === true
          ? ["Continue according to the lesson sequence"]
          : evaluation.correct === false
            ? ["Reteach the current concept using a different explanation"]
            : ["Continue formative assessment of the current concept"],
      recordedAt: toInstant(input.now),
    });

    const planHash = fingerprintTeachingLessonPlan(plan);
    const payloadHash = fingerprintTeachingFreeResponseAttempt({
      relationshipId: input.exercise.relationshipId,
      skillVersionId: input.exercise.skillVersionId,
      lessonStepKey: input.exercise.lessonStepKey,
      exerciseKey: input.exercise.exerciseKey,
      cardHash: input.exercise.cardHash,
      responseText,
    });
    const persistence = await this.#progress.commitFreeResponseAttempt(
      Object.freeze({
        requestId: input.exercise.requestId,
        payloadHash,
        planHash,
        cardHash: input.exercise.cardHash,
        relationshipId: input.exercise.relationshipId,
        skillVersionId: input.exercise.skillVersionId,
        lessonStepKey: input.exercise.lessonStepKey,
        exerciseKey: input.exercise.exerciseKey,
        responseText,
        evaluation,
        progress,
        recordedAt: toInstant(input.now),
      }),
    );

    const continuation = resolveTeachingContinuation(plan, progress);
    const projection = Object.freeze({
      kind: "feedback" as const,
      relationshipId: input.exercise.relationshipId,
      skillVersionId: input.exercise.skillVersionId,
      exerciseKey: input.exercise.exerciseKey,
      evaluation,
      continuation,
      persistence,
    });
    await this.#presentation?.publish(projection);
    return projection;
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

import {
  isCanonicalId,
  type RelationshipId,
  type SkillVersionId,
} from "@masanawa/contracts";
import {
  normalizeTeachingLearnerContext,
  normalizeTeachingLessonPlan,
  teachingLevels,
  teachingModalities,
  type TeachingLearnerContext,
  type TeachingLessonPlan,
  type TeachingLessonStep,
  type TeachingLevel,
  type TeachingModality,
  type TeachingResourceEvidence,
} from "./teaching.js";

export type TeachingIntakeSource = "explicit" | "inferred";

export interface TeachingInferredValue<T> {
  readonly value: T;
  readonly confidence: number;
}

export interface TeachingAdaptiveIntake {
  readonly relationshipId: RelationshipId;
  readonly explicit: Readonly<{
    readonly topic?: string;
    readonly level?: TeachingLevel;
    readonly goals?: readonly string[];
    readonly language?: string;
    readonly accessibilityPreferences?: readonly string[];
    readonly preferredModalities?: readonly TeachingModality[];
  }>;
  readonly inferred?: Readonly<{
    readonly topic?: TeachingInferredValue<string>;
    readonly level?: TeachingInferredValue<TeachingLevel>;
    readonly goals?: TeachingInferredValue<readonly string[]>;
    readonly language?: TeachingInferredValue<string>;
    readonly accessibilityPreferences?: TeachingInferredValue<readonly string[]>;
    readonly preferredModalities?: TeachingInferredValue<
      readonly TeachingModality[]
    >;
  }>;
}

export type TeachingClarificationField =
  | "topic"
  | "level"
  | "goals"
  | "language";

export interface TeachingClarificationQuestion {
  readonly field: TeachingClarificationField;
  readonly prompt: string;
  readonly required: boolean;
}

export interface TeachingAdaptiveResolution {
  readonly ready: boolean;
  readonly learner: TeachingLearnerContext | null;
  readonly assumptions: readonly string[];
  readonly clarificationQuestions: readonly TeachingClarificationQuestion[];
}

export interface TeachingSequenceProposal {
  readonly sequenceTitle: string;
  readonly steps: readonly TeachingLessonStep[];
  readonly rationale: string;
  readonly uncertaintyNotes: readonly string[];
}

const inferenceThreshold = 0.7;

function confidence(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${name}.confidence is invalid`);
  }
  return value;
}

function inferred<T>(
  candidate: TeachingInferredValue<T> | undefined,
  name: string,
): T | undefined {
  if (candidate === undefined) return undefined;
  return confidence(candidate.confidence, name) >= inferenceThreshold
    ? candidate.value
    : undefined;
}

function normalizedStrings(
  value: readonly string[] | undefined,
  name: string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 16) {
    throw new TypeError(`${name} is invalid`);
  }
  const normalized = value.map((item) => {
    if (typeof item !== "string") throw new TypeError(`${name} is invalid`);
    const clean = item.trim().replace(/\s+/gu, " ");
    if (!clean || clean.length > 500) {
      throw new TypeError(`${name} is invalid`);
    }
    return clean;
  });
  return Object.freeze([...new Set(normalized)]);
}

function normalizedModalities(
  value: readonly TeachingModality[] | undefined,
): readonly TeachingModality[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) {
    throw new TypeError("preferredModalities is invalid");
  }
  const normalized = value.map((item) => {
    if (!teachingModalities.includes(item)) {
      throw new TypeError("preferredModalities is invalid");
    }
    return item;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError("preferredModalities must be unique");
  }
  return Object.freeze(normalized);
}

function normalizedLevel(
  value: TeachingLevel | undefined,
): TeachingLevel | undefined {
  if (value === undefined) return undefined;
  if (!teachingLevels.includes(value)) {
    throw new TypeError("level is invalid");
  }
  return value;
}

function normalizedText(
  value: string | undefined,
  name: string,
  max: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const clean = value.trim().replace(/\s+/gu, " ");
  if (!clean || clean.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return clean;
}

function assumed(
  assumptions: string[],
  source: TeachingIntakeSource,
  field: string,
): void {
  if (source === "inferred") assumptions.push(`${field} inferred from learner context`);
}

export function resolveTeachingAdaptiveIntake(
  input: TeachingAdaptiveIntake,
): TeachingAdaptiveResolution {
  if (!isCanonicalId("relationship", input.relationshipId)) {
    throw new TypeError("relationshipId is invalid");
  }

  const assumptions: string[] = [];
  const questions: TeachingClarificationQuestion[] = [];
  const explicit = input.explicit ?? {};
  const inferredInput = input.inferred ?? {};

  const explicitTopic = normalizedText(explicit.topic, "topic", 500);
  const inferredTopic = normalizedText(
    inferred(inferredInput.topic, "topic"),
    "topic",
    500,
  );
  const topic = explicitTopic ?? inferredTopic;
  if (!topic) {
    questions.push(Object.freeze({
      field: "topic" as const,
      prompt: "What would you like to learn?",
      required: true,
    }));
  } else {
    assumed(assumptions, explicitTopic ? "explicit" : "inferred", "topic");
  }

  const explicitLevel = normalizedLevel(explicit.level);
  const inferredLevel = normalizedLevel(
    inferred(inferredInput.level, "level"),
  );
  const level = explicitLevel ?? inferredLevel ?? "unspecified";
  if (!explicitLevel && inferredLevel) {
    assumed(assumptions, "inferred", "level");
  }

  const explicitGoals = normalizedStrings(explicit.goals, "goals");
  const inferredGoals = normalizedStrings(
    inferred(inferredInput.goals, "goals"),
    "goals",
  );
  const goals =
    explicitGoals ??
    inferredGoals ??
    (topic ? Object.freeze([`Understand ${topic} clearly`]) : Object.freeze([]));
  if (!explicitGoals && inferredGoals) {
    assumed(assumptions, "inferred", "goals");
  }
  if (!explicitGoals && !inferredGoals && topic) {
    assumptions.push("goal defaulted to clear understanding");
  }

  const explicitLanguage = normalizedText(explicit.language, "language", 64);
  const inferredLanguage = normalizedText(
    inferred(inferredInput.language, "language"),
    "language",
    64,
  );
  const language = explicitLanguage ?? inferredLanguage ?? "en";
  if (!explicitLanguage && inferredLanguage) {
    assumed(assumptions, "inferred", "language");
  }
  if (!explicitLanguage && !inferredLanguage) {
    assumptions.push("language defaulted to en");
  }

  const explicitAccessibility = normalizedStrings(
    explicit.accessibilityPreferences,
    "accessibilityPreferences",
  );
  const inferredAccessibility = normalizedStrings(
    inferred(
      inferredInput.accessibilityPreferences,
      "accessibilityPreferences",
    ),
    "accessibilityPreferences",
  );
  const accessibilityPreferences =
    explicitAccessibility ?? inferredAccessibility ?? Object.freeze([]);
  if (!explicitAccessibility && inferredAccessibility) {
    assumed(assumptions, "inferred", "accessibility preferences");
  }

  const explicitModalities = normalizedModalities(explicit.preferredModalities);
  const inferredModalities = normalizedModalities(
    inferred(inferredInput.preferredModalities, "preferredModalities"),
  );
  const preferredModalities =
    explicitModalities ?? inferredModalities ?? Object.freeze(["text"] as const);
  if (!explicitModalities && inferredModalities) {
    assumed(assumptions, "inferred", "preferred modalities");
  }

  if (!topic) {
    return Object.freeze({
      ready: false,
      learner: null,
      assumptions: Object.freeze(assumptions),
      clarificationQuestions: Object.freeze(questions.slice(0, 2)),
    });
  }

  const learner = normalizeTeachingLearnerContext({
    relationshipId: input.relationshipId,
    topic,
    level,
    goals,
    language,
    accessibilityPreferences,
    preferredModalities,
  });

  return Object.freeze({
    ready: true,
    learner,
    assumptions: Object.freeze(assumptions),
    clarificationQuestions: Object.freeze([]),
  });
}

function proposalList(
  value: readonly string[],
  name: string,
  maxEntries: number,
  maxLength: number,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maxEntries) {
    throw new TypeError(`${name} is invalid`);
  }
  const normalized = value.map((item) => {
    const clean = normalizedText(item, name, maxLength);
    if (clean === undefined) throw new TypeError(`${name} is invalid`);
    return clean;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze(normalized);
}

function proposalKey(value: string, name: string): string {
  const clean = normalizedText(value, name, 128)!.toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(clean)) {
    throw new TypeError(`${name} is invalid`);
  }
  return clean;
}

function normalizeProposalStep(input: TeachingLessonStep): TeachingLessonStep {
  return Object.freeze({
    stepKey: proposalKey(input.stepKey, "stepKey"),
    title: normalizedText(input.title, "step.title", 300)!,
    objective: normalizedText(input.objective, "step.objective", 1000)!,
    explanation: normalizedText(input.explanation, "step.explanation", 12_000)!,
    examples: proposalList(input.examples, "step.examples", 16, 4000),
    workedSolutions: proposalList(
      input.workedSolutions,
      "step.workedSolutions",
      16,
      6000,
    ),
    exercisePrompts: proposalList(
      input.exercisePrompts,
      "step.exercisePrompts",
      32,
      2000,
    ),
    resourceKeys: Object.freeze(
      proposalList(input.resourceKeys, "step.resourceKeys", 32, 128).map(
        (value) => proposalKey(value, "step.resourceKey"),
      ),
    ),
  });
}

export function normalizeTeachingSequenceProposal(
  input: TeachingSequenceProposal,
): TeachingSequenceProposal {
  const sequenceTitle = normalizedText(
    input.sequenceTitle,
    "sequenceTitle",
    300,
  )!;
  const rationale = normalizedText(input.rationale, "rationale", 2000)!;
  if (
    !Array.isArray(input.steps) ||
    input.steps.length < 1 ||
    input.steps.length > 24
  ) {
    throw new TypeError("steps are invalid");
  }
  if (
    !Array.isArray(input.uncertaintyNotes) ||
    input.uncertaintyNotes.length > 16
  ) {
    throw new TypeError("uncertaintyNotes are invalid");
  }

  const steps = input.steps.map(normalizeProposalStep);
  if (new Set(steps.map((step) => step.stepKey)).size !== steps.length) {
    throw new TypeError("step keys must be unique");
  }

  return Object.freeze({
    sequenceTitle,
    steps: Object.freeze(steps),
    rationale,
    uncertaintyNotes: proposalList(
      input.uncertaintyNotes,
      "uncertaintyNotes",
      16,
      2000,
    ),
  });
}

export function materializeTeachingLessonPlan(input: {
  readonly skillVersionId: SkillVersionId;
  readonly resolution: TeachingAdaptiveResolution;
  readonly proposal: TeachingSequenceProposal;
  readonly resources?: readonly TeachingResourceEvidence[];
}): TeachingLessonPlan {
  if (!input.resolution.ready || input.resolution.learner === null) {
    throw new Error("Teaching intake requires clarification before planning");
  }
  const proposal = normalizeTeachingSequenceProposal(input.proposal);
  return normalizeTeachingLessonPlan({
    skillVersionId: input.skillVersionId,
    learner: input.resolution.learner,
    sequenceTitle: proposal.sequenceTitle,
    steps: proposal.steps,
    resources: input.resources ?? [],
    uncertaintyNotes: Object.freeze([
      ...proposal.uncertaintyNotes,
      ...input.resolution.assumptions,
    ]),
  });
}


export interface TeachingPlanProposalPort {
  propose(input: {
    readonly learner: TeachingLearnerContext;
    readonly assumptions: readonly string[];
    readonly availableResourceKeys: readonly string[];
    readonly maximumSteps: number;
  }): Promise<TeachingSequenceProposal>;
}

export type TeachingAdaptivePlannerResult =
  | Readonly<{
      kind: "clarification";
      questions: readonly TeachingClarificationQuestion[];
      assumptions: readonly string[];
    }>
  | Readonly<{
      kind: "plan";
      plan: TeachingLessonPlan;
      rationale: string;
      assumptions: readonly string[];
    }>;

export function createTeachingAdaptivePlanner(input: {
  readonly proposalPort: TeachingPlanProposalPort;
  readonly maximumSteps?: number;
}) {
  const maximumSteps = input.maximumSteps ?? 8;
  if (
    !Number.isSafeInteger(maximumSteps) ||
    maximumSteps < 1 ||
    maximumSteps > 24
  ) {
    throw new RangeError("maximumSteps is invalid");
  }

  return Object.freeze({
    async propose(request: {
      readonly skillVersionId: SkillVersionId;
      readonly intake: TeachingAdaptiveIntake;
      readonly resources?: readonly TeachingResourceEvidence[];
    }): Promise<TeachingAdaptivePlannerResult> {
      const resolution = resolveTeachingAdaptiveIntake(request.intake);
      if (!resolution.ready || resolution.learner === null) {
        return Object.freeze({
          kind: "clarification" as const,
          questions: resolution.clarificationQuestions,
          assumptions: resolution.assumptions,
        });
      }

      const resources = Object.freeze([...(request.resources ?? [])]);
      const availableResourceKeys = Object.freeze(
        resources.map((resource) =>
          proposalKey(resource.resourceKey, "resourceKey"),
        ),
      );
      if (new Set(availableResourceKeys).size !== availableResourceKeys.length) {
        throw new TypeError("resource keys must be unique");
      }
      const rawProposal = await input.proposalPort.propose({
        learner: resolution.learner,
        assumptions: resolution.assumptions,
        availableResourceKeys,
        maximumSteps,
      });
      const proposal = normalizeTeachingSequenceProposal(rawProposal);
      if (proposal.steps.length > maximumSteps) {
        throw new Error(
          "Teaching proposal exceeded the admitted adaptive sequence bound",
        );
      }

      const plan = materializeTeachingLessonPlan({
        skillVersionId: request.skillVersionId,
        resolution,
        proposal,
        resources,
      });

      return Object.freeze({
        kind: "plan" as const,
        plan,
        rationale: proposal.rationale,
        assumptions: resolution.assumptions,
      });
    },
  });
}

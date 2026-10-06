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

export function normalizeTeachingSequenceProposal(
  input: TeachingSequenceProposal,
): TeachingSequenceProposal {
  const sequenceTitle = normalizedText(
    input.sequenceTitle,
    "sequenceTitle",
    300,
  )!;
  const rationale = normalizedText(input.rationale, "rationale", 2000)!;
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 24) {
    throw new TypeError("steps are invalid");
  }
  if (!Array.isArray(input.uncertaintyNotes) || input.uncertaintyNotes.length > 16) {
    throw new TypeError("uncertaintyNotes are invalid");
  }

  const provisional = normalizeTeachingLessonPlan({
    skillVersionId: "skill-version_00000000000000000000000000" as SkillVersionId,
    learner: {
      relationshipId: "relationship_00000000000000000000000000" as RelationshipId,
      topic: "placeholder",
      level: "unspecified",
      goals: [],
      language: "en",
      accessibilityPreferences: [],
      preferredModalities: ["text"],
    },
    sequenceTitle,
    steps: input.steps,
    resources: [],
    uncertaintyNotes: input.uncertaintyNotes,
  });

  return Object.freeze({
    sequenceTitle: provisional.sequenceTitle,
    steps: provisional.steps,
    rationale,
    uncertaintyNotes: provisional.uncertaintyNotes,
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

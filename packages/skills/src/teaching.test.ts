import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  normalizeTeachingAnswerEvaluation,
  normalizeTeachingLessonPlan,
  normalizeTeachingProgressHandoff,
  type TeachingLessonPlan,
} from "./teaching.js";

function plan(): TeachingLessonPlan {
  return {
    skillVersionId: createCanonicalId("skill-version"),
    learner: {
      relationshipId: createCanonicalId("relationship"),
      topic: "Quadratic equations",
      level: "beginner",
      goals: ["Solve quadratic equations confidently"],
      language: "ha",
      accessibilityPreferences: ["Prefer short steps"],
      preferredModalities: ["text", "voice"],
    },
    sequenceTitle: "Quadratics from first principles",
    steps: [
      {
        stepKey: "factor-basics",
        title: "Factoring basics",
        objective: "Recognize a factorable quadratic.",
        explanation: "Connect multiplication of binomials to reversing the process.",
        examples: ["x² + 5x + 6"],
        workedSolutions: ["(x + 2)(x + 3)"],
        exercisePrompts: ["Factor x² + 7x + 12"],
        resourceKeys: ["quadratics-reference"],
      },
    ],
    resources: [
      {
        resourceKey: "quadratics-reference",
        title: "Reviewed quadratics reference",
        reference: "resource://teaching/math/quadratics/v1",
        contentHash: `sha256:${"a".repeat(64)}`,
        checkedAt: toInstant("2026-10-04T00:00:00.000Z"),
      },
    ],
    uncertaintyNotes: [],
  };
}

describe("Core Teaching contracts", () => {
  it("normalizes an adaptive plan with exact Skill and Relationship scope", () => {
    const normalized = normalizeTeachingLessonPlan(plan());
    expect(normalized.learner.topic).toBe("Quadratic equations");
    expect(normalized.steps[0]?.resourceKeys).toEqual(["quadratics-reference"]);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.learner)).toBe(true);
    expect(Object.isFrozen(normalized.steps)).toBe(true);
  });

  it("rejects lesson resources without provenance evidence", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        resources: [{ ...input.resources[0]!, contentHash: "unknown" }],
      }),
    ).toThrow(/contentHash/);
  });

  it("rejects steps that cite undeclared resources", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        steps: [{ ...input.steps[0]!, resourceKeys: ["missing-reference"] }],
      }),
    ).toThrow(/unknown resource evidence/);
  });

  it("keeps Core assessment formative and cannot mint certification", () => {
    expect(
      normalizeTeachingAnswerEvaluation({
        assessmentKind: "formative",
        correct: false,
        feedback: "The middle term needs both factors.",
        misconception: "Chose factors whose sum is not the middle coefficient.",
        alternativeExplanation: "Use a product-and-sum table before writing brackets.",
        nextCheckpointState: "needs-reteaching",
      }).nextCheckpointState,
    ).toBe("needs-reteaching");

    expect(() =>
      normalizeTeachingAnswerEvaluation({
        assessmentKind: "verified-certification",
        correct: true,
        feedback: "Passed.",
        misconception: null,
        alternativeExplanation: null,
        nextCheckpointState: "completed",
      }),
    ).toThrow(/separate certified assessment workflow/);
  });

  it("creates a bounded Relationship-scoped progress handoff rather than a second store", () => {
    const input = plan();
    const progress = normalizeTeachingProgressHandoff({
      relationshipId: input.learner.relationshipId,
      skillVersionId: input.skillVersionId,
      lessonStepKey: "factor-basics",
      checkpointState: "ready-to-advance",
      demonstratedUnderstanding: ["Can identify factor pairs"],
      misconceptionsToRevisit: [],
      nextSteps: ["Practice one harder example"],
      recordedAt: toInstant("2026-10-04T12:00:00.000Z"),
    });
    expect(progress.relationshipId).toBe(input.learner.relationshipId);
    expect(Object.isFrozen(progress.nextSteps)).toBe(true);
  });

  it("requires at least one delivery modality and a valid language tag", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        learner: { ...input.learner, preferredModalities: [] },
      }),
    ).toThrow(/preferredModalities/);
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        learner: { ...input.learner, language: "not a language tag!" },
      }),
    ).toThrow(/language/);
  });
});
